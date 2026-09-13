export function EventFlowSteps({ compact = false }: { compact?: boolean }) {
  const steps = [
    'Antena y Espectro: mira TV y ruido del recinto.',
    'Escaneo: di cuántos equipos (BLX K12, guitarra, bajo…) y calcula las frecuencias más limpias.',
    'Pon grupo/canal a mano en cada receptor, o escribe lo que escaneó el BLX (ej. C6).',
    'Panel: enciende los transmisores. Verde = canal bueno; rojo = interferencia o cortes.',
    'Si uno falla, reescanea ese. Si fallan varios, reescanea todos.',
  ]

  if (compact) {
    return (
      <p className="text-[11px] leading-relaxed text-rf-muted">
        Evento: espectro → asignar en Escaneo o escribir C6 del receptor →
        monitorear → reescanear el que falle (o todos).
      </p>
    )
  }

  return (
    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-300">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  )
}
