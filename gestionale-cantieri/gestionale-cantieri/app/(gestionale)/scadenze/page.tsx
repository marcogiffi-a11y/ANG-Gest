'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

export default function ScadenzePage() {
  const [sals, setSals] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.from('sal').select('*, progetti(numero_ordine, clienti(ragione_sociale))')
      .not('data_prevista', 'is', null)
      .not('stato', 'in', '("fatturato","pagato")')
      .order('data_prevista', { ascending: true })
      .then(({ data }) => setSals(data || []))
  }, [])

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
  const oggi = new Date(); oggi.setHours(0,0,0,0)

  function urgenza(data: string) {
    const d = new Date(data); d.setHours(0,0,0,0)
    const diff = Math.ceil((d.getTime() - oggi.getTime()) / (1000*60*60*24))
    if (diff < 0) return { label: 'SCADUTA', color: '#dc2626', bg: '#fef2f2' }
    if (diff <= 7) return { label: `${diff}gg`, color: '#ea580c', bg: '#fff7ed' }
    if (diff <= 30) return { label: `${diff}gg`, color: '#92400e', bg: '#fef3c7' }
    return { label: `${diff}gg`, color: '#475569', bg: '#f1f5f9' }
  }

  return (
    <>
      <Topbar title="Scadenze" subtitle="Calendario SAL da gestire" />
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'hidden' }}>
          {sals.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 12 }}>Nessuna scadenza imminente 🎉</div>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            {sals.length > 0 && <thead><tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['Data', 'Cliente / Progetto', 'SAL', 'Descrizione', 'Importo', 'Mancano', 'Stato'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>}
            <tbody>
              {sals.map(s => {
                const u = urgenza(s.data_prevista)
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #fafafa', background: u.color === '#dc2626' ? '#fef2f2' : 'white' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: u.color }}>{new Date(s.data_prevista).toLocaleDateString('it-IT')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{s.progetti?.clienti?.ragione_sociale}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.progetti?.numero_ordine}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>SAL {s.numero}</td>
                    <td style={{ padding: '10px 12px' }}>{s.descrizione}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{fmt(s.importo)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: u.bg, color: u.color }}>{u.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e' }}>
                        {s.stato === 'da_emettere' ? 'Da emettere' : 'In attesa'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
