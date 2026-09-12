from __future__ import annotations

import ctypes
import os
from pathlib import Path

from sdr_server.models import DeviceInfo

_CANDIDATE_LIBS = (
    "librtlsdr.dylib",
    "librtlsdr.0.dylib",
    "librtlsdr.so",
    "librtlsdr.so.0",
    "rtlsdr.dll",
)

_BREW_PATHS = (
    Path("/opt/homebrew/lib"),
    Path("/usr/local/lib"),
    Path("/opt/local/lib"),
)


def load_librtlsdr() -> ctypes.CDLL | None:
    env = os.environ.get("RTLSDR_LIB")
    names: list[str] = []
    if env:
        names.append(env)
    for folder in _BREW_PATHS:
        for name in _CANDIDATE_LIBS:
            candidate = folder / name
            if candidate.exists():
                names.append(str(candidate))
    names.extend(_CANDIDATE_LIBS)

    seen: set[str] = set()
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        try:
            return ctypes.CDLL(name)
        except OSError:
            continue
    return None


def _usb_strings(lib: ctypes.CDLL, index: int) -> tuple[str, str, str]:
    manufact = ctypes.create_string_buffer(256)
    product = ctypes.create_string_buffer(256)
    serial = ctypes.create_string_buffer(256)
    lib.rtlsdr_get_device_usb_strings.argtypes = [
        ctypes.c_uint32,
        ctypes.c_char_p,
        ctypes.c_char_p,
        ctypes.c_char_p,
    ]
    lib.rtlsdr_get_device_usb_strings.restype = ctypes.c_int
    rc = lib.rtlsdr_get_device_usb_strings(index, manufact, product, serial)
    if rc != 0:
        return "", "", ""
    return (
        manufact.value.decode("utf-8", errors="replace"),
        product.value.decode("utf-8", errors="replace"),
        serial.value.decode("utf-8", errors="replace"),
    )


def list_rtl_devices() -> list[DeviceInfo]:
    lib = load_librtlsdr()
    if lib is None:
        return []

    lib.rtlsdr_get_device_count.restype = ctypes.c_uint32
    count = int(lib.rtlsdr_get_device_count())
    devices: list[DeviceInfo] = []
    lib.rtlsdr_get_device_name.argtypes = [ctypes.c_uint32]
    lib.rtlsdr_get_device_name.restype = ctypes.c_char_p

    for index in range(count):
        raw_name = lib.rtlsdr_get_device_name(index)
        name = raw_name.decode("utf-8", errors="replace") if raw_name else f"RTL-SDR #{index}"
        vendor, product, serial = _usb_strings(lib, index)
        label = product or name or f"RTL-SDR #{index}"
        if serial:
            label = f"{label} ({serial})"
        devices.append(
            DeviceInfo(
                index=index,
                driver="rtl-sdr",
                vendor=vendor or None,
                product=product or None,
                serial=serial or None,
                name=label,
            )
        )
    return devices


def librtlsdr_available() -> bool:
    return load_librtlsdr() is not None
