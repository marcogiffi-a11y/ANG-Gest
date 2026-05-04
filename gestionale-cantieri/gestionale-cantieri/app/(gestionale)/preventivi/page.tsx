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

const STATO_CFG: Record<string, { bg: string; color: string; label: string }> = {
  bozza:     { bg: '#f1f5f9', color: '#475569', label: 'Bozza' },
  inviato:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Inviato' },
  in_attesa: { bg: '#fef3c7', color: '#92400e', label: 'In attesa' },
  accettato: { bg: '#dcfce7', color: '#166534', label: 'Accettato' },
  rifiutato: { bg: '#fee2e2', color: '#991b1b', label: 'Rifiutato' },
  scaduto:   { bg: '#f1f5f9', color: '#94a3b8', label: 'Scaduto' },
}

export default function PreventiviPage() {
  const supabase = createClient()
  const [preventivi,     setPreventivi]     = useState<any[]>([])
  const [loading,        setLoading]        = useState(true)
  const [cerca,          setCerca]          = useState('')
  const [filtroStato,    setFiltroStato]    = useState('')
  const [filtroServizio, setFiltroServizio] = useState('')
  const [deleting,       setDeleting]       = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('preventivi')
      .select('*, clienti(ragione_sociale, nome, cognome, tipo_cliente, portafogli(nome)), preventivo_voci(importo)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPreventivi(data || [])
        setLoading(false)
      })
  }, [])

  const nomeCliente = (c: any) => {
    if (!c) return '—'
    if (c.tipo_cliente === 'persona_fisica') return `${c.nome || ''} ${c.cognome || ''}`.trim() || '—'
    return c.ragione_sociale || '—'
  }

  const totaleVoci = (voci: any[]) =>
    (voci || []).reduce((acc: number, v: any) => acc + (v.importo || 0), 0)

  async function eliminaPreventivo(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Eliminare questo preventivo?\nOperazione irreversibile.')) return
    setDeleting(id)
    await supabase.from('preventivi').delete().eq('id', id)
    setPreventivi(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  const filtered = preventivi.filter(p => {
    const q          = cerca.toLowerCase()
    const match      = !q ||
      p.numero_offerta?.toLowerCase().includes(q) ||
      nomeCliente(p.clienti).toLowerCase().includes(q) ||
      p.oggetto?.toLowerCase().includes(q)
    const matchStato    = !filtroStato    || p.stato === filtroStato
    const matchServizio = !filtroServizio || p.tipo_servizio === filtroServizio
    return match && matchStato && matchServizio
  })

  const totaleImporti    = filtered.reduce((acc, p) => acc + totaleVoci(p.preventivo_voci), 0)
  const countAccettati   = filtered.filter(p => p.stato === 'accettato').length
  const countInviati     = filtered.filter(p => p.stato === 'inviato' || p.stato === 'in_attesa').length

  return (
    <>
      <Topbar title="Preventivi" subtitle="Tutti i preventivi emessi" />
      <div style={{ padding: '20px 24px' }}>

        {/* KPI strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Totale preventivi', value: filtered.length,    color: '#1e3a5f' },
            { label: 'Valore totale',     value: fmt(totaleImporti), color: '#6ab04c' },
            { label: 'In attesa / inviati', value: countInviati,     color: '#92400e' },
            { label: 'Accettati',         value: countAccettati,     color: '#166534' },
          ].map(k => (
            <div key={k.label} style={{ flex: 1, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Filtri */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <input
            value={cerca} onChange={e => setCerca(e.target.value)}
            placeholder="🔍  Cerca per n° offerta, cliente, oggetto..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}>
            <option value="">Tutti gli stati</option>
            {Object.entries(STATO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filtroServizio} onChange={e => setFiltroServizio(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}>
            <option value="">Tutti i servizi</option>
            <option value="ingegneria">Ingegneria</option>
            <option value="fornitura_posa">Fornitura e Posa</option>
          </select>
          <Link href="/preventivo/nuovo" style={{ padding: '8px 16px', borderRadius: 7, background: '#6ab04c', color: 'white', fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            + Nuovo preventivo
          </Link>
        </div>

        {/* Tabella */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                {['N° Offerta', 'Cliente', 'Portafoglio', 'Servizio', 'Oggetto', 'Importo', 'Data', 'Validità', 'Stato', 'Azioni'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Caricamento...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  Nessun preventivo trovato.{' '}
                  <Link href="/preventivo/nuovo" style={{ color: '#6ab04c' }}>Crea il primo →</Link>
                </td></tr>
              )}
              {filtered.map(p => {
                const st    = STATO_CFG[p.stato] || STATO_CFG.bozza
                const tot   = totaleVoci(p.preventivo_voci)
                const isDel = deleting === p.id

                // Data scadenza
                const dataEmissione = p.data_emissione ? new Date(p.data_emissione) : null
                const dataScadenza  = dataEmissione && p.validita_giorni
                  ? new Date(dataEmissione.getTime() + p.validita_giorni * 86400000)
                  : null
                const isScaduto = dataScadenza && dataScadenza < new Date() && !['accettato', 'rifiutato'].includes(p.stato)

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>

                    {/* N° offerta */}
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#1e3a5f', fontFamily: 'monospace', fontSize: 12 }}>{p.numero_offerta || '—'}</div>
                      <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 1 }}>
                        {p.tipo_servizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura/Posa'}
                      </div>
                    </td>

                    {/* Cliente */}
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{nomeCliente(p.clienti)}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>
                        {p.tipo_cliente === 'privato' ? '👤 Privato' : p.tipo_cliente === 'ente' ? '🏛 Ente' : '🏢 Altro'}
                      </div>
                    </td>

                    {/* Portafoglio */}
                    <td style={{ padding: '11px 12px', color: '#64748b' }}>{p.clienti?.portafogli?.nome || '—'}</td>

                    {/* Servizio */}
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: p.tipo_servizio === 'ingegneria' ? '#dbeafe' : '#fef3c7',
                        color:      p.tipo_servizio === 'ingegneria' ? '#1d4ed8' : '#92400e' }}>
                        {p.tipo_servizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura/Posa'}
                      </span>
                    </td>

                    {/* Oggetto */}
                    <td style={{ padding: '11px 12px', maxWidth: 200 }}>
                      <div style={{ color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                        {p.oggetto || <span style={{ color: '#cbd5e1' }}>—</span>}
                      </div>
                    </td>

                    {/* Importo */}
                    <td style={{ padding: '11px 12px', fontWeight: 600, color: '#1e3a5f' }}>
                      {tot > 0 ? fmt(tot) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>

                    {/* Data emissione */}
                    <td style={{ padding: '11px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {fmtData(p.data_emissione)}
                    </td>

                    {/* Validità / scadenza */}
                    <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                      {dataScadenza ? (
                        <div style={{ fontSize: 11, color: isScaduto ? '#991b1b' : '#64748b', fontWeight: isScaduto ? 700 : 400 }}>
                          {isScaduto ? '⚠ ' : ''}{fmtData(dataScadenza.toISOString())}
                        </div>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>{p.validita_giorni ? `${p.validita_giorni}gg` : '—'}</span>
                      )}
                    </td>

                    {/* Stato */}
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>

                    {/* Azioni */}
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <Link
                          href={`/preventivo/${p.id}`}
                          style={{ fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
                            background: '#eff6ff', color: '#1d4ed8', textDecoration: 'none',
                            border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}
                        >
                          ✏ Modifica
                        </Link>
                        <button
                          onClick={e => eliminaPreventivo(p.id, e)}
                          disabled={isDel}
                          title="Elimina preventivo"
                          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #fecaca',
                            background: isDel ? '#f1f5f9' : '#fee2e2',
                            color: isDel ? '#94a3b8' : '#991b1b',
                            fontSize: 10, fontWeight: 600, cursor: isDel ? 'not-allowed' : 'pointer' }}
                        >
                          {isDel ? '...' : '🗑'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 24, fontSize: 12, color: '#64748b' }}>
            <span>{filtered.length} preventivi</span>
            {totaleImporti > 0 && <span style={{ fontWeight: 700, color: '#1e3a5f' }}>Valore totale: {fmt(totaleImporti)}</span>}
          </div>
        )}

      </div>
    </>
  )
}
