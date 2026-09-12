from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from starlette.websockets import WebSocketState
from fastapi.middleware.cors import CORSMiddleware

from sdr_server import __version__
from sdr_server.config import settings
from sdr_server.devices import librtlsdr_available, list_rtl_devices
from sdr_server.hub import hub

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("sdr_server")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await hub.start_pump()
    log.info("RF SDR server %s en http://%s:%s", __version__, settings.host, settings.port)
    yield
    await hub.shutdown()


app = FastAPI(title="RF SDR server", version=__version__, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_origin_regex=r"https?://(127\.0\.0\.1|localhost|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
def root() -> str:
    return (
        "<!doctype html><meta charset='utf-8'><title>RF SDR</title>"
        "<body style='font-family:system-ui;background:#0b1017;color:#e2e8f0;"
        "padding:2rem;line-height:1.5'>"
        "<p>Esto es el <strong>backend</strong> del SDR (:8787), no la app.</p>"
        "<p>Abre la interfaz en "
        "<a href='http://localhost:5173/' style='color:#5eead4'>"
        "http://localhost:5173/</a></p>"
        "</body>"
    )


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "rf-sdr-server", "version": __version__}


@app.get("/devices")
def devices() -> dict[str, Any]:
    rtl = list_rtl_devices()
    return {
        "librtlsdr": librtlsdr_available(),
        "mode": "rtl-sdr" if rtl else "mock",
        "devices": [d.model_dump() for d in rtl],
    }


@app.get("/status")
def status() -> dict[str, Any]:
    return hub.snapshot()


@app.websocket("/spectrum")
async def spectrum_socket(ws: WebSocket) -> None:
    await hub.connect(ws)
    try:
        while ws.client_state == WebSocketState.CONNECTED:
            raw = await ws.receive_json()
            if isinstance(raw, dict):
                await hub.handle(ws, raw)
    except WebSocketDisconnect:
        pass
    except RuntimeError:
        pass
    except Exception:
        log.exception("WebSocket cerrado por error")
    finally:
        hub.disconnect(ws)


def run() -> None:
    uvicorn.run(
        "sdr_server.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level="info",
    )
