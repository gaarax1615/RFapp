# RF SDR server

Backend **local** para RF Monitor. Abre el SDR (o un generador de prueba) y manda frames de espectro por WebSocket. No se empaqueta: dos terminales en tu Mac.

```
SDR (USB) → Python :8787 → Vite :5173 → React
```

## Requisitos

- Python 3.9+
- Opcional, para dongle real: [Homebrew](https://brew.sh) y `librtlsdr`

```bash
brew install librtlsdr
```

El serial del dongle se ve con:

```bash
rtl_test
```

## Arranque

Desde la raíz del workspace (Frontend + Backend):

```bash
./start.sh
```

O solo este servidor:

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python -m sdr_server
```

Queda en `http://127.0.0.1:8787` (solo localhost).

En **Ajustes → Fuente de espectro**, pulsa *Buscar de nuevo* y elige **Backend local**. Si hay RTL-SDR, también aparece como disponible.

## API

| Ruta | Uso |
|---|---|
| `GET /health` | ¿Está vivo? |
| `GET /devices` | Dongles y seriales |
| `GET /status` | Captura actual |
| `WS /spectrum` | Frames (`SpectrumFrame`) |

Mensaje de arranque (la UI lo envía sola):

```json
{
  "type": "start",
  "startFrequencyMhz": 470,
  "endFrequencyMhz": 698,
  "binCount": 2048,
  "updateRateHz": 25,
  "preferDevice": "auto",
  "serial": null
}
```

`preferDevice`: `auto` usa RTL si hay dongle; si no, espectro de prueba. `rtl-sdr` exige hardware.

## Serial y ganancia

```bash
export RF_SDR_SERIAL=00000001
export RF_SDR_GAIN=auto
python -m sdr_server
```

O copia `.env.example` a `.env` y exporta las variables a mano. `RF_SDR_MOCK=1` fuerza el generador aunque el dongle esté enchufado.

## Notas

- Un RTL-SDR típico ve ~2.4 MHz a la vez. El servidor barre 470–698 MHz por hops; el waterfall se va rellenando.
- El proceso no escucha en la red. Vite hace de proxy (`/sdr-api`, `/sdr-ws`) si abres la UI desde otro dispositivo en la LAN.
- HackRF aún no está implementado.
