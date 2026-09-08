export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-1 flex-col p-5 md:p-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-rf-muted uppercase">
        Módulo
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-lg text-sm text-rf-muted">{description}</p>
      <div className="mt-8 rounded-lg border border-dashed border-rf-border bg-rf-panel/50 p-8 text-center">
        <p className="font-mono text-sm text-rf-cyan">Próxima fase Beta 1</p>
        <p className="mt-2 text-sm text-rf-muted">
          Arquitectura y contratos listos — interfaz pendiente.
        </p>
      </div>
    </div>
  )
}
