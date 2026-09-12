import { MockSpectrumSource } from './MockSpectrumSource'
import { RTLSDRSource } from './RTLSDRSource'
import { HackRFSource } from './HackRFSource'
import { RemoteSpectrumSource } from './RemoteSpectrumSource'
import type { SpectrumSource } from '@/types/spectrum'

export type SpectrumSourceKind = 'mock' | 'rtl-sdr' | 'hackrf' | 'remote'

export function createSpectrumSource(kind: SpectrumSourceKind = 'mock'): SpectrumSource {
  switch (kind) {
    case 'rtl-sdr':
      return new RemoteSpectrumSource({ preferDevice: 'rtl-sdr' })
    case 'hackrf':
      return new HackRFSource()
    case 'remote':
      return new RemoteSpectrumSource({ preferDevice: 'auto' })
    case 'mock':
    default:
      return new MockSpectrumSource()
  }
}

export { MockSpectrumSource, RTLSDRSource, HackRFSource, RemoteSpectrumSource }
export type { RemotePreferDevice, RemoteSpectrumOptions } from './RemoteSpectrumSource'
export {
  detectSpectrumHardware,
  type DetectedHardwareOption,
} from './detectSpectrumHardware'
