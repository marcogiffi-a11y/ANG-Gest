'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import Link from 'next/link'

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const fmtData = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ProgettiPage() {
  const supabase = createClient()
  const [progetti, setProgetti] = useState<any[]>([])
  const [risorse, setRisorse] = useState<any[]>([])
  const [tipologie, setTipologie] = useState<any[]>([])
  const [filtro, setFiltro] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  useEffect(() => {
    supabase
      .from('progetti')
      .select('*, clienti(ragione_sociale, portafogli(nome)), sal(stato)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setProgetti(data || []))

    supabase.from('risorse').select('*').order('nome')
      .then(({ data }) => setRisorse(data || []))

    supabase.from('tipologie_servizio').select('*').order('nome')
      .then(({ data }) => setTipologie(data || []))
  }, [])

  async function updateProgetto(id: string, field: string, value: string) {
    await supabase.from('progetti').update({ [field]: value || null }).eq('id', id)
    setProgetti(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const filtered = progetti.filter(p => {
    const q = filtro.toLowerCase()
    const match = !q || p.clienti?.ragione_sociale?.toLowerCase().includes(q) || p.numero_ordine?.toLowerCase().includes(q)
    const cat = !filtroCategoria || p.tipo_servizio === filtroCategoria
    return match && cat
  })

  function getSalStats(sals: any[]) {
    if (!sals?.length) return { completati: 0, totali: 0 }
    return { completati: sals.filter(s => ['fatturato', 'pagato'].includes(s.stato)).length, totali: sals.length }
  }

  const statoColor: Record<string, string> = {
    bozza: '#f1f5f9', attivo: '#dbeafe', completato: '#dcfce7', sospeso: '#fef3c7'
  }
  const statoText: Record<string, string> = {
    bozza: '#475569', attivo: '#1d4ed8', completato: '#166534', sospeso: '#92400e'
  }
  const statoLabel: Record<string, string> = {
    bozza: 'Bozza', attivo: 'In corso', completato: 'Completato', sospeso: 'Sospeso'
  }

  const selectStyle: React.CSSProperties = {
    fontSize: 11, padding: '3px 6px', borderRadius: 5,
    border: '1px solid #e2e8f0', background: 'white',
    color: '#334155', cursor: 'pointer', width: '100%', maxWidth: 130
  }

  const colHeaders = [
    'Oggetto Commessa', 'Data Inizio', 'Cliente', 'Portafoglio',
    'Categoria', 'Servizio', 'Importo', 'SAL', 'Stato', 'Risorsa', 'Data di Chiusura'
  ]

  return (
    <>
      <Topbar title="Progetti" subtitle="Tutti i progetti" />
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="🔍  Cerca cliente, ordine..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}>
            <option value="">Tutte le categorie</option>
            <option value="ingegneria">Ingegneria</option>
            <option value="fornitura_posa">Fornitura e Posa</option>
          </select>
          <Link href="/ordine/nuovo" style={{ padding: '8px 16px', borderRadius: 7, background: '#3b82f6', color: 'white', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            + Nuovo ordine
          </Link>
        </div>

        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {colHeaders.map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'left',
                    fontSize: 10, color: '#94a3b8', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={colHeaders.length} style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 12 }}>
                  Nessun progetto trovato. <Link href="/ordine/nuovo" style={{ color: '#3b82f6' }}>Crea il primo →</Link>
                </td></tr>
              )}
              {filtered.map(p => {
                const sal = getSalStats(p.sal)
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #fafafa' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>

                    {/* Oggetto Commessa */}
                    <td style={{ padding: '10px 12px', cursor: 'pointer' }}
                      onClick={() => window.location.href = `/progetti/${p.id}`}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.clienti?.ragione_sociale}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{p.numero_ordine}</div>
                    </td>

                    {/* Data Inizio — dal created_at */}
                    <td style={{ padding: '10px 12px', color: '#475569', whiteSpace: 'nowrap', cursor: 'pointer' }}
                      onClick={() => window.location.href = `/progetti/${p.id}`}>
                      {fmtData(p.created_at)}
                    </td>

                    {/* Cliente */}
                    <td style={{ padding: '10px 12px', color: '#334155', cursor: 'pointer' }}
                      onClick={() => window.location.href = `/progetti/${p.id}`}>
                      {p.clienti?.ragione_sociale || '—'}
                    </td>

                    {/* Portafoglio */}
                    <td style={{ padding: '10px 12px', color: '#64748b', cursor: 'pointer' }}
                      onClick={() => window.location.href = `/progetti/${p.id}`}>
                      {p.clienti?.portafogli?.nome || '—'}
                    </td>

                    {/* Categoria */}
                    <td style={{ padding: '10px 12px', cursor: 'pointer' }}
                      onClick={() => window.location.href = `/progetti/${p.id}`}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: p.tipo_servizio === 'ingegneria' ? '#dbeafe' : '#fef3c7',
                        color: p.tipo_servizio === 'ingegneria' ? '#1d4ed8' : '#92400e'
                      }}>
                        {p.tipo_servizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura/Posa'}
                      </span>
                    </td>

                    {/* Servizio — dropdown da tipologie_servizio */}
                    <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                      <select
                        style={selectStyle}
                        value={p.servizio || ''}
                        onChange={e => updateProgetto(p.id, 'servizio', e.target.value)}
                      >
                        <option value="">—</option>
                        {tipologie.map(t => (
                          <option key={t.id} value={t.nome}>{t.nome}</option>
                        ))}
                      </select>
                    </td>

                    {/* Importo */}
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e3a5f', cursor: 'pointer' }}
                      onClick={() => window.location.href = `/progetti/${p.id}`}>
                      {fmt(p.importo_netto)}
                    </td>

                    {/* SAL */}
                    <td style={{ padding: '10px 12px', color: '#64748b', cursor: 'pointer' }}
                      onClick={() => window.location.href = `/progetti/${p.id}`}>
                      {sal.completati}/{sal.totali}
                    </td>

                    {/* Stato */}
                    <td style={{ padding: '10px 12px', cursor: 'pointer' }}
                      onClick={() => window.location.href = `/progetti/${p.id}`}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: statoColor[p.stato] || '#f1f5f9',
                        color: statoText[p.stato] || '#475569'
                      }}>
                        {statoLabel[p.stato] || p.stato}
                      </span>
                    </td>

                    {/* Risorsa — dropdown da risorse */}
                    <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                      <select
                        style={selectStyle}
                        value={p.risorsa || ''}
                        onChange={e => updateProgetto(p.id, 'risorsa', e.target.value)}
                      >
                        <option value="">—</option>
                        {risorse.map(r => (
                          <option key={r.id} value={r.nome}>{r.nome}</option>
                        ))}
                      </select>
                    </td>

                    {/* Data di Chiusura */}
                    <td style={{ padding: '10px 12px', color: '#475569', whiteSpace: 'nowrap', cursor: 'pointer' }}
                      onClick={() => window.location.href = `/progetti/${p.id}`}>
                      {fmtData(p.data_chiusura)}
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
