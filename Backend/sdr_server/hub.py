from __future__ import annotations

import asyncio
import logging
import queue
import threading
import time
from typing import Any

from fastapi import WebSocket

from sdr_server.config import settings
from sdr_server.models import ClientMessage, SpectrumConfigIn, frame_payload, status_payload
from sdr_server.sources.base import CaptureConfig, CaptureStatus, SpectrumCapture
from sdr_server.sources.factory import create_capture

log = logging.getLogger("sdr_server")


def _same_capture(a: SpectrumConfigIn, b: SpectrumConfigIn) -> bool:
    return (
        abs(a.start_frequency_mhz - b.start_frequency_mhz) < 1e-4
        and abs(a.end_frequency_mhz - b.end_frequency_mhz) < 1e-4
        and a.bin_count == b.bin_count
        and (a.gain or settings.gain) == (b.gain or settings.gain)
        and (a.serial or "") == (b.serial or "")
        and (a.prefer_device or "auto") == (b.prefer_device or "auto")
    )


def _to_capture_config(cfg: SpectrumConfigIn) -> CaptureConfig:
    return CaptureConfig(
        start_mhz=cfg.start_frequency_mhz,
        end_mhz=cfg.end_frequency_mhz,
        bin_count=cfg.bin_count,
        update_rate_hz=cfg.update_rate_hz,
        serial=cfg.serial or settings.serial,
        gain=cfg.gain or settings.gain,
    )


class SpectrumHub:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._frames: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=2)
        self._audio: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=48)
        self._listen_frame_at = 0.0
        self._worker: threading.Thread | None = None
        self._stop = threading.Event()
        self._source: SpectrumCapture | None = None
        self._config = SpectrumConfigIn()
        self._status = CaptureStatus(
            state="disconnected",
            device_name=None,
            message="Backend local en espera",
            mode="idle",
        )
        self._lock = threading.Lock()
        self._pump_task: asyncio.Task[None] | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._idle_handle: asyncio.TimerHandle | None = None

    def snapshot(self) -> dict[str, Any]:
        st = self._status
        return {
            "state": st.state,
            "deviceName": st.device_name,
            "message": st.message,
            "serial": st.serial,
            "mode": st.mode,
            "clients": len(self._clients),
            "config": {
                "startFrequencyMhz": self._config.start_frequency_mhz,
                "endFrequencyMhz": self._config.end_frequency_mhz,
                "binCount": self._config.bin_count,
                "updateRateHz": self._config.update_rate_hz,
            },
        }

    async def start_pump(self) -> None:
        self._loop = asyncio.get_running_loop()
        if self._pump_task is None or self._pump_task.done():
            self._pump_task = asyncio.create_task(self._pump(), name="sdr-pump")

    async def shutdown(self) -> None:
        self._stop_worker()
        if self._pump_task:
            self._pump_task.cancel()
            self._offer({"type": "_shutdown"})
            try:
                await self._pump_task
            except asyncio.CancelledError:
                pass
            self._pump_task = None
        for ws in list(self._clients):
            try:
                await ws.close()
            except Exception:
                pass
        self._clients.clear()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._cancel_idle_stop()
        self._clients.add(ws)
        await ws.send_json(self._status_message())

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)
        if not self._clients:
            self._arm_idle_stop()

    async def handle(self, ws: WebSocket, raw: dict[str, Any]) -> None:
        msg = ClientMessage.model_validate(raw)
        if msg.type == "stop":
            return
        if msg.type == "listen":
            start = msg.start_frequency_mhz
            end = msg.end_frequency_mhz
            if start is None or end is None:
                return
            center = (start + end) / 2.0
            span = abs(end - start)
            demod = msg.demod or "auto"
            if self._source is not None:
                self._source.set_listen(center, span, demod)
                log.info("Escucha %s en %.3f MHz", demod.upper(), center)
            return
        if msg.type == "listenStop":
            if self._source is not None:
                self._source.set_listen(None)
            return

        prev = self._config
        merged = self._merge_config(msg)
        already = (
            self._source is not None
            and self._worker is not None
            and self._worker.is_alive()
            and _same_capture(prev, merged)
        )
        if already:
            await ws.send_json(self._status_message())
            return
        if self._source is not None:
            self._source.set_listen(None)
        try:
            status = self._ensure_running(merged)
        except Exception as exc:
            log.exception("No se pudo arrancar la captura")
            await ws.send_json({"type": "error", "message": str(exc)})
            await ws.send_json(
                status_payload(
                    state="error",
                    device_name=None,
                    message=str(exc),
                    mode="error",
                )
            )
            return
        self._status = status
        await self._broadcast(self._status_message())

    def _merge_config(self, msg: ClientMessage) -> SpectrumConfigIn:
        current = self._config
        data = current.model_dump(by_alias=True)
        incoming = msg.model_dump(by_alias=True, exclude_none=True)
        incoming.pop("type", None)
        data.update(incoming)
        self._config = SpectrumConfigIn.model_validate(data)
        return self._config

    def _arm_idle_stop(self) -> None:
        loop = self._loop
        if loop is None:
            self._stop_worker()
            return
        self._cancel_idle_stop()
        self._idle_handle = loop.call_later(2.0, self._idle_stop)

    def _idle_stop(self) -> None:
        if not self._clients:
            self._stop_worker()

    def _cancel_idle_stop(self) -> None:
        if self._idle_handle is not None:
            self._idle_handle.cancel()
            self._idle_handle = None

    def _ensure_running(self, cfg: SpectrumConfigIn) -> CaptureStatus:
        self._cancel_idle_stop()
        with self._lock:
            prefer = cfg.prefer_device or "auto"
            need_new = self._source is None
            if self._source is not None and prefer == "rtl-sdr" and self._status.mode != "rtl-sdr":
                need_new = True

            if need_new:
                if self._source is not None:
                    self._source.close()
                self._source = create_capture(prefer)
                status = self._source.open(_to_capture_config(cfg))
            else:
                status = self._source.configure(_to_capture_config(cfg))

            self._status = status
            if self._worker is None or not self._worker.is_alive():
                self._stop.clear()
                self._worker = threading.Thread(
                    target=self._run_worker,
                    name="sdr-capture",
                    daemon=True,
                )
                self._worker.start()
            return status

    def _run_worker(self) -> None:
        while not self._stop.is_set():
            source = self._source
            if source is None:
                break
            try:
                ts, power = source.next_frame()
            except Exception as exc:
                log.exception("Error en captura")
                self._offer(
                    status_payload(
                        state="error",
                        device_name=self._status.device_name,
                        message=str(exc),
                        serial=self._status.serial,
                        mode=self._status.mode,
                    )
                )
                break
            st = source.status()
            if st.state != self._status.state or st.message != self._status.message:
                self._status = st
                self._offer(
                    status_payload(
                        state=st.state,
                        device_name=st.device_name,
                        message=st.message,
                        serial=st.serial,
                        mode=st.mode,
                    )
                )
            # Vacía toda la cola de audio: no dejar trozos atrasados (eso = faltaba data).
            while True:
                audio = source.take_audio()
                if not audio:
                    break
                self._offer_audio(audio)
            listening = source.is_listening()
            now = time.monotonic()
            # Mientras escuchas: RTA/cascada siguen vivos (~12 fps). Audio tiene prioridad.
            if listening and (now - self._listen_frame_at) < 0.08:
                continue
            if listening:
                self._listen_frame_at = now
            cfg = self._config
            self._offer(
                frame_payload(
                    timestamp_ms=ts,
                    start_mhz=cfg.start_frequency_mhz,
                    end_mhz=cfg.end_frequency_mhz,
                    power_db=power.astype(float).tolist(),
                    hop_meta=source.hop_meta(),
                )
            )

    def _stop_worker(self) -> None:
        self._stop.set()
        with self._lock:
            if self._source is not None:
                try:
                    self._source.close()
                except Exception:
                    log.exception("Error al cerrar la fuente")
                self._source = None
            worker = self._worker
            self._worker = None
        if worker and worker.is_alive() and worker is not threading.current_thread():
            worker.join(timeout=2.0)
        self._status = CaptureStatus(
            state="disconnected",
            device_name=None,
            message="Backend local en espera",
            mode="idle",
        )

    def _offer_audio(self, payload: dict[str, Any]) -> None:
        try:
            self._audio.put_nowait(payload)
        except queue.Full:
            try:
                self._audio.get_nowait()
            except queue.Empty:
                pass
            try:
                self._audio.put_nowait(payload)
            except queue.Full:
                pass

    def _offer(self, payload: dict[str, Any]) -> None:
        try:
            self._frames.put_nowait(payload)
        except queue.Full:
            try:
                self._frames.get_nowait()
            except queue.Empty:
                pass
            try:
                self._frames.put_nowait(payload)
            except queue.Full:
                pass

    def _take_frame(self) -> dict[str, Any] | None:
        try:
            return self._audio.get_nowait()
        except queue.Empty:
            pass
        try:
            return self._frames.get(timeout=0.05)
        except queue.Empty:
            return None

    async def _pump(self) -> None:
        while True:
            payload = await asyncio.to_thread(self._take_frame)
            if payload is None or payload.get("type") == "_shutdown":
                continue
            await self._broadcast(payload)

    async def _broadcast(self, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._clients):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    def _status_message(self) -> dict[str, Any]:
        st = self._status
        return status_payload(
            state=st.state,
            device_name=st.device_name,
            message=st.message,
            serial=st.serial,
            mode=st.mode,
        )


hub = SpectrumHub()
