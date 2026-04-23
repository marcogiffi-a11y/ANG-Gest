'use client'
import Topbar from '@/components/Topbar'

export default function UtentiPage() {
  return (
    <>
      <Topbar title="Utenti" subtitle="Gestione accessi" />
      <div style={{ padding: '20px 24px', maxWidth: 640 }}>
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Gestione utenti</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, marginBottom: 16 }}>
            Gli utenti possono registrarsi autonomamente dalla pagina di login usando la propria email o il proprio account Google.
            Tutti gli utenti registrati hanno accesso completo al gestionale.
          </div>
          <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: 8, border: '1px solid #dbeafe', fontSize: 12, color: '#1d4ed8' }}>
            ℹ️ Per una gestione avanzata dei ruoli (admin, operatore, visualizzatore), contatta il supporto tecnico per l'attivazione.
          </div>
          <div style={{ marginTop: 16 }}>
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, background: '#3b82f6', color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
              Gestisci utenti su Supabase →
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
