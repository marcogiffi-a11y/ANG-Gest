'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

export default function ClientiPage() {
  const [clienti, setClienti] = useState<any[]>([])
  const supabase = createClient()
  useEffect(() => {
    supabase.from('clienti').select('*, portafogli(nome), progetti(id)').order('ragione_sociale')
      .then(({ data }) => setClienti(data || []))
  }, [])
  return (
    <>
      <Topbar title="Clienti" subtitle="Anagrafica clienti" />
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['Cliente', 'P.IVA / C.F.', 'Portafoglio', 'Referente', 'Email', 'N. Progetti'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {clienti.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nessun cliente. I clienti vengono creati durante la creazione di un ordine.</td></tr>}
              {clienti.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #fafafa' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1d4ed8', flexShrink: 0 }}>
                        {c.ragione_sociale.slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{c.ragione_sociale}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{c.piva || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{c.portafogli?.nome || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#334155' }}>{c.referente || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#3b82f6' }}>{c.email || '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.progetti?.length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
