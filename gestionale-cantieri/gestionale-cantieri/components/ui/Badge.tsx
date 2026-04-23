type BadgeVariant = 'blue' | 'green' | 'amber' | 'red' | 'gray'

const variants: Record<BadgeVariant, string> = {
  blue:  'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700',
  red:   'bg-red-50 text-red-700',
  gray:  'bg-slate-100 text-slate-500',
}

export function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${variants[variant]}`}>
      {children}
    </span>
  )
}

export function salStatoBadge(stato: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    in_attesa:   { label: 'In attesa',   variant: 'gray'  },
    da_emettere: { label: 'Da emettere', variant: 'amber' },
    fatturato:   { label: 'Fatturato',   variant: 'blue'  },
    pagato:      { label: 'Pagato',      variant: 'green' },
  }
  const s = map[stato] || { label: stato, variant: 'gray' as BadgeVariant }
  return <Badge variant={s.variant}>{s.label}</Badge>
}

export function progettoStatoBadge(stato: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    bozza:      { label: 'Bozza',      variant: 'gray'  },
    attivo:     { label: 'In corso',   variant: 'blue'  },
    completato: { label: 'Completato', variant: 'green' },
    sospeso:    { label: 'Sospeso',    variant: 'amber' },
  }
  const s = map[stato] || { label: stato, variant: 'gray' as BadgeVariant }
  return <Badge variant={s.variant}>{s.label}</Badge>
}
