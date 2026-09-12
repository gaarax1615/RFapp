# RF Monitor

Aplicación local/offline para monitoreo y coordinación de frecuencias RF en eventos en vivo.

## Stack (Beta 1)

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Zustand + React Router
- Canvas 2D propio (`SpectrumRenderer` / `WaterfallRenderer`)
- Datos simulados vía `MockSpectrumSource` / `MockChannelMetricsSource`
- Persistencia local: `JsonDeviceRepository` (localStorage)

## Desarrollo

Frontend + Backend (RTL-SDR) a la vez:

```bash
./start.sh
```

O solo esta UI:

```bash
npm install
npm run dev
```

Abre `http://127.0.0.1:5173`. En Ajustes elige **Backend local**. Detalles: `Backend/README.md`.

## Módulos

| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard KPIs |
| `/spectrum` | Spectrum + waterfall + marcadores |
| `/devices` | CRUD de dispositivos RF |
| `/monitor` | Tarjetas de canal |
| `/monitor/:id` | Detalle (RF/Noise/SNR, mini-spectrum, historial) |
| `/alerts` | AlertService |
| `/settings` | Fuente, rango, prep LAN/audio |

## Arquitectura

- `src/hardware` — adapters (SpectrumSource, audio, metrics)
- `src/services` — lógica de aplicación
- `src/repositories` — almacenamiento
- `src/modules` — pantallas UI
- `src/types` — contratos tipados

La UI no depende de hardware concreto. Cambiar de mock a RTL-SDR/HackRF se hace en `createAppServices`.

## Próximo

HackRF en el backend Python · demodulación de audio real.
