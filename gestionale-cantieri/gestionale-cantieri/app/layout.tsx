import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ANG Gest — Athena Next Gen',
  description: 'Gestione progetti, ordini, SAL e fatturazione',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
