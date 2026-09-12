from fastapi.testclient import TestClient

from sdr_server.main import app


def test_health_and_devices():
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        body = health.json()
        assert body["ok"] is True
        assert body["service"] == "rf-sdr-server"

        devices = client.get("/devices")
        assert devices.status_code == 200
        data = devices.json()
        assert "devices" in data
        assert data["mode"] in {"rtl-sdr", "mock"}


def test_spectrum_websocket_mock_frame():
    with TestClient(app) as client:
        with client.websocket_connect("/spectrum") as ws:
            hello = ws.receive_json()
            assert hello["type"] == "status"
            ws.send_json(
                {
                    "type": "start",
                    "startFrequencyMhz": 400,
                    "endFrequencyMhz": 500,
                    "binCount": 256,
                    "updateRateHz": 40,
                    "preferDevice": "mock",
                }
            )
            status = ws.receive_json()
            assert status["type"] in {"status", "error"}
            if status["type"] == "error":
                raise AssertionError(status.get("message"))
            assert status["state"] in {"simulated", "connected"}

            frame = ws.receive_json()
            assert frame["type"] == "frame"
            assert len(frame["powerDb"]) == 256
            assert frame["startFrequencyMhz"] == 400
            assert frame["endFrequencyMhz"] == 500
