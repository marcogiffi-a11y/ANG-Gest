'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

const STATI_COLOR: Record<string, { bg: string; color: string }> = {
  in_attesa:   { bg: '#f1f5f9', color: '#475569' },
  da_emettere: { bg: '#fef3c7', color: '#92400e' },
  fatturato:   { bg: '#dbeafe', color: '#1d4ed8' },
  pagato:      { bg: '#dcfce7', color: '#166534' },
}
const STATI_LABEL: Record<string, string> = { in_attesa: 'In attesa', da_emettere: 'Da emettere', fatturato: 'Fatturato', pagato: 'Pagato' }

export default function FatturePage() {
  const [sals, setSals] = useState<any[]>([])
  const [filtroStato, setFiltroStato] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('sal').select('*, progetti(numero_ordine, importo_netto, iva_percentuale, clienti(ragione_sociale))').order('data_prevista', { ascending: true })
      .then(({ data }) => setSals(data || []))
  }, [])

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

  const filtered = filtroStato ? sals.filter(s => s.stato === filtroStato) : sals
  const daFatturare = sals.filter(s => s.stato === 'da_emettere')
  const fatturati = sals.filter(s => ['fatturato', 'pagato'].includes(s.stato))

  async function aggiornaStato(salId: string, stato: string) {
    await supabase.from('sal').update({ stato }).eq('id', salId)
    setSals(prev => prev.map(s => s.id === salId ? { ...s, stato } : s))
  }

  return (
    <>
      <Topbar title="Fatture & SAL" subtitle="Piano di fatturazione" />
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Da emettere', value: daFatturare.length, sub: fmt(daFatturare.reduce((a, s) => a + s.importo, 0)), color: '#fef3c7', text: '#92400e' },
            { label: 'Fatturati (anno)', value: fatturati.length, sub: fmt(fatturati.reduce((a, s) => a + s.importo, 0)), color: '#dbeafe', text: '#1d4ed8' },
            { label: 'Totale SAL', value: sals.length, sub: fmt(sals.reduce((a, s) => a + s.importo, 0)), color: '#f8fafc', text: '#475569' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: s.text, marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Tutti i SAL</div>
            <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11 }}>
              <option value="">Tutti gli stati</option>
              <option value="da_emettere">Da emettere</option>
              <option value="in_attesa">In attesa</option>
              <option value="fatturato">Fatturato</option>
              <option value="pagato">Pagato</option>
            </select>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Cliente / Progetto', 'SAL', 'Descrizione', 'Scadenza', 'Imponibile', `IVA`, 'Totale lordo', 'Stato'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nessun SAL trovato</td></tr>}
              {filtered.map(s => {
                const iva = (s.progetti?.iva_percentuale || 22)
                const totale = s.importo * (1 + iva / 100)
                const scadenzaDate = s.data_prevista ? new Date(s.data_prevista) : null
                const scaduta = scadenzaDate && scadenzaDate < new Date() && s.stato === 'da_emettere'
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #fafafa' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{s.progetti?.clienti?.ragione_sociale}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.progetti?.numero_ordine}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>SAL {s.numero}</td>
                    <td style={{ padding: '10px 12px' }}>{s.descrizione}</td>
                    <td style={{ padding: '10px 12px', color: scaduta ? '#dc2626' : '#64748b', fontWeight: scaduta ? 700 : 400 }}>
                      {scadenzaDate ? scadenzaDate.toLocaleDateString('it-IT') : '—'}
                      {scaduta && <div style={{ fontSize: 9, color: '#dc2626' }}>SCADUTA</div>}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{fmt(s.importo)}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{iva}%</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{fmt(totale)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <select value={s.stato} onChange={e => aggiornaStato(s.id, e.target.value)} style={{
                        fontSize: 10, padding: '3px 7px', borderRadius: 20, border: 'none', fontWeight: 600, cursor: 'pointer',
                        background: STATI_COLOR[s.stato]?.bg, color: STATI_COLOR[s.stato]?.color
                      }}>
                        {Object.entries(STATI_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
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
