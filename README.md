# RF Monitor

App local para ver espectro, coordinar inalámbricos (BLX / IEM) y monitorear canales. Frontend (Vite) + backend Python (RTL-SDR).

La raíz de este repo **es el frontend**. El servidor SDR está en `Backend/`.

## Qué necesitas

- macOS o Linux
- [Node.js 20+](https://nodejs.org/) (`node -v`)
- [Python 3.9+](https://www.python.org/) (`python3 --version`)
- Git

Para un **RTL-SDR de verdad** (Nooelec, etc.) en macOS:

```bash
brew install librtlsdr
```

Comprueba el dongle:

```bash
rtl_test
```

Sin dongle también arranca: el backend usa espectro de prueba.

## Levantar el proyecto

```bash
git clone https://github.com/gaarax1615/RFapp.git
cd RFapp
chmod +x start.sh
./start.sh
```

La primera vez crea el `.venv` de Python, instala el backend y hace `npm install`. Luego deja:

| Qué | URL |
|-----|-----|
| UI | http://localhost:5173/ |
| Backend | http://127.0.0.1:8787 |

Abre **solo** `http://localhost:5173/` (no el 8787).

En la app:

1. **Ajustes → Buscar de nuevo**
2. Elige **Backend local** o **RTL-SDR** si aparece el serial
3. **Escaneo**: equipos del evento (p. ej. BLX K12 + IEM) → inventario → **Buscar óptimas**
4. Pon grupo/canal a mano en el receptor → **Actualizar frecuencias** → **Panel**

Para parar: `Ctrl+C` en la terminal del `start.sh`.

## Si `./start.sh` falla

Instala a mano y arranca en **dos terminales**.

**Terminal 1 — backend**

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e .
python -m sdr_server
```

**Terminal 2 — frontend**

```bash
npm install
npm run dev
```

Misma UI: http://localhost:5173/

## Dongle y ganancia

Opcional, en `Backend/.env` (copia `Backend/.env.example`):

```bash
RF_SDR_SERIAL=         # vacío = primer dongle
RF_SDR_GAIN=28.0
RF_SDR_MOCK=0          # 1 = ignorar el dongle y usar prueba
```

Después de cambiar Python hay que **reiniciar** el backend (`Ctrl+C` y otra vez `./start.sh`). Vite recarga el frontend solo.

## Rutas de la UI

| Ruta | Uso |
|------|-----|
| `/` | Espectro + cascada |
| `/panel` | Cards de monitoreo |
| `/scan` | Inventario y frecuencias óptimas |
| `/devices` | Dispositivos guardados |
| `/monitor` | Monitor de canales |
| `/alerts` | Alertas |
| `/settings` | SDR, kit del evento, rango |

## Notas

- Un RTL solo ve ~2 MHz a la vez; el rango del kit se barre a saltos.
- La cascada va a color a propósito (saturación). El resto de la UI es blanco y negro.
- El backend solo escucha en localhost. No subas `.env` ni `.venv`.
