import {
  createSpectrumSource,
  detectSpectrumHardware,
  type DetectedHardwareOption,
  type SpectrumSourceKind,
} from '@/hardware/spectrum'
import type { SpectrumService } from '@/services/SpectrumService'
import { STORAGE_KEYS } from '@/utils/constants'

/**
 * Selección y detección de fuente de espectro.
 * La UI no instancia drivers directamente.
 */
export class HardwareService {
  private options: DetectedHardwareOption[] = []
  private selectedKind: SpectrumSourceKind = 'mock'
  private listeners = new Set<(state: HardwareSelectionState) => void>()

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEYS.spectrumSource)
    if (saved === 'mock' || saved === 'rtl-sdr' || saved === 'hackrf' || saved === 'remote') {
      this.selectedKind = saved
    }
  }

  getSelectedKind(): SpectrumSourceKind {
    return this.selectedKind
  }

  getOptions(): DetectedHardwareOption[] {
    return [...this.options]
  }

  getState(): HardwareSelectionState {
    return {
      selectedKind: this.selectedKind,
      options: this.getOptions(),
    }
  }

  subscribe(listener: (state: HardwareSelectionState) => void): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  async refresh(): Promise<DetectedHardwareOption[]> {
    this.options = await detectSpectrumHardware()
    this.notify()
    return this.getOptions()
  }

  async select(
    kind: SpectrumSourceKind,
    spectrum: SpectrumService,
  ): Promise<void> {
    if (this.options.length === 0) {
      await this.refresh()
    }

    const option = this.options.find((o) => o.kind === kind)
    if (!option) {
      throw new Error('Fuente de hardware desconocida')
    }
    if (!option.available) {
      throw new Error(
        `${option.label} no está disponible. Conecta el hardware o usa Simulado.`,
      )
    }

    const source = createSpectrumSource(kind)
    await spectrum.setSource(source, spectrum.getConfig())
    this.selectedKind = kind
    localStorage.setItem(STORAGE_KEYS.spectrumSource, kind)
    this.notify()
  }

  private notify(): void {
    const state = this.getState()
    for (const listener of this.listeners) listener(state)
  }
}

export interface HardwareSelectionState {
  selectedKind: SpectrumSourceKind
  options: DetectedHardwareOption[]
}
