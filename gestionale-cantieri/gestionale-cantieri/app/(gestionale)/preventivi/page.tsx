'use client'
import Topbar from '@/components/Topbar'

export default function PreventiviPage() {
  return (
    <>
      <Topbar title="Preventivi" subtitle="Gestione preventivi" />
      <div style={{ padding: '20px 24px' }}>
        <div style={{
          background: 'white',
          borderRadius: 10,
          border: '1px solid #e5e7eb',
          padding: '60px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: '#94a3b8',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40 }}>📝</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>Sezione Preventivi</div>
          <div style={{ fontSize: 13, maxWidth: 360 }}>
            Questa sezione è in fase di sviluppo.<br />
            Presto potrai creare e gestire i preventivi direttamente da qui.
          </div>
        </div>
      </div>
    </>
  )
}
