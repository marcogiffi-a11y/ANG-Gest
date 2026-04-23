'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

export default function DocumentiPage() {
  const [documenti, setDocumenti] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.from('documenti').select('*, progetti(numero_ordine, clienti(ragione_sociale))').order('created_at', { ascending: false })
      .then(({ data }) => setDocumenti(data || []))
  }, [])

  return (
    <>
      <Topbar title="Documenti" subtitle="Archivio documentale" />
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'hidden' }}>
          {documenti.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 12 }}>Nessun documento. I documenti vengono caricati durante la creazione degli ordini.</div>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            {documenti.length > 0 && <thead><tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['Documento', 'Progetto', 'Tipo', 'Data caricamento', 'Dimensione', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>}
            <tbody>
              {documenti.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid #fafafa' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>📄</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{d.nome}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 500 }}>{d.progetti?.clienti?.ragione_sociale}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{d.progetti?.numero_ordine}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{d.tipo || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{new Date(d.created_at).toLocaleDateString('it-IT')}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{d.dimensione ? `${Math.round(d.dimensione / 1024)} KB` : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11, textDecoration: 'none', color: '#475569' }}>↓ Scarica</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
