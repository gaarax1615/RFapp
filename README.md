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

```bash
npm install
npm run dev
```

Abre la URL de Vite (p. ej. `http://127.0.0.1:5173`).

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

Tauri 2 scaffold · servidor LAN Axum · drivers SDR reales.
