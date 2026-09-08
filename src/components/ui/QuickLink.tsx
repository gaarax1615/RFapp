import { Link } from 'react-router-dom'

interface QuickLinkProps {
  to: string
  title: string
  description: string
}

export function QuickLink({ to, title, description }: QuickLinkProps) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-rf-border bg-rf-panel p-4 transition-colors hover:border-rf-cyan/50 hover:bg-rf-elevated"
    >
      <p className="font-medium text-rf-text group-hover:text-rf-cyan">{title}</p>
      <p className="mt-1 text-sm text-rf-muted">{description}</p>
    </Link>
  )
}
