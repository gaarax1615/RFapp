from sdr_server.sources.base import CaptureConfig
from sdr_server.sources.mock import MockCapture


def test_mock_frame_shape():
    cap = MockCapture()
    cap.open(CaptureConfig(470, 698, 256, 50))
    ts, power = cap.next_frame()
    assert ts > 0
    assert power.shape == (256,)
    assert power.dtype.str.endswith("f4")
    assert power.min() > -180
    assert power.max() < 20
    cap.close()
