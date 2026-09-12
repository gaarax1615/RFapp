import type { SpectrumFrame } from '@/types/spectrum'
import type { SpectrumService } from '@/services/SpectrumService'
import { SpectrumRenderer } from './SpectrumRenderer'
import { WaterfallRenderer } from '@/modules/waterfall/WaterfallRenderer'

/**
 * Un solo flujo de espectro/cascada para todas las pantallas.
 * El dongle no se vuelve a sintonizar al ir al Panel.
 */
export class SpectrumTunnel {
  readonly rta = new SpectrumRenderer()
  readonly waterfall = new WaterfallRenderer()
  private unsub: (() => void) | null = null
  private view = { w: 1280, h: 360 }

  bind(spectrum: SpectrumService): void {
    this.unsub?.()
    this.unsub = spectrum.subscribe((frame) => {
      this.waterfall.ingest(frame, this.view.w, this.view.h)
    })
  }

  unbind(): void {
    this.unsub?.()
    this.unsub = null
  }

  setViewSize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width))
    const h = Math.max(1, Math.floor(height))
    if (w === this.view.w && h === this.view.h) return
    this.view = { w, h }
    this.waterfall.ensureSize(w, h)
  }

  present(canvas: HTMLCanvasElement): void {
    this.waterfall.present(canvas, this.view.w, this.view.h)
  }

  reset(): void {
    this.rta.resetTraces()
    this.waterfall.reset()
  }
}
