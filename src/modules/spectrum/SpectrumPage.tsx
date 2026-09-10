import { SpectrumAnalyzer } from './SpectrumAnalyzer'

export function SpectrumPage() {
  return (
    <div className="flex h-full min-h-0 flex-col pt-4">
      <SpectrumAnalyzer showWaterfall solo />
    </div>
  )
}
