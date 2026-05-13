'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import Link from 'next/link'

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

const STATO_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  bozza:      { bg: '#f1f5f9', color: '#475569', label: 'Bozza' },
  attivo:     { bg: '#dbeafe', color: '#1d4ed8', label: 'In corso' },
  completato: { bg: '#dcfce7', color: '#166534', label: 'Completato' },
  sospeso:    { bg: '#fef3c7', color: '#92400e', label: 'Sospeso' },
}

export default function FornituraePosaPage() {
  const supabase = createClient()
  const [ordini,      setOrdini]      = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [cerca,       setCerca]       = useState('')
  const [filtroStato, setFiltroStato] = useState('')
  const [deleting,    setDeleting]    = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('progetti')
      .select('*, clienti(ragione_sociale, nome, cognome, tipo_cliente, portafogli(nome)), sal(id, numero, importo, stato, data_prevista)')
      .eq('tipo_servizio', 'fornitura_posa')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrdini(data || [])
        setLoading(false)
      })
  }, [])

  const nomeCliente = (c: any) => {
    if (!c) return '—'
    if (c.tipo_cliente === 'persona_fisica') return `${c.nome || ''} ${c.cognome || ''}`.trim() || '—'
    return c.ragione_sociale || '—'
  }

  const importoLordo = (p: any) => {
    const cassa      = p.importo_netto * (p.cassa_percentuale / 100)
    const imponibile = p.importo_netto + cassa
    return imponibile * (1 + p.iva_percentuale / 100)
  }

  const salSommario = (sals: any[]) => {
    if (!sals?.length) return { totale: 0, fatturato: 0, pagato: 0, daEmettere: 0 }
    return {
      totale:     sals.length,
      fatturato:  sals.filter(s => s.stato === 'fatturato').length,
      pagato:     sals.filter(s => s.stato === 'pagato').length,
      daEmettere: sals.filter(s => s.stato === 'da_emettere').length,
    }
  }

  async function eliminaOrdine(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Eliminare questo ordine e tutti i SAL associati?\nOperazione irreversibile.')) return
    setDeleting(id)
    await supabase.from('progetti').delete().eq('id', id)
    setOrdini(prev => prev.filter(o => o.id !== id))
    setDeleting(null)
  }

  const filtered = ordini.filter(o => {
    const q          = cerca.toLowerCase()
    const matchCerca = !q ||
      o.numero_ordine?.toLowerCase().includes(q) ||
      nomeCliente(o.clienti).toLowerCase().includes(q) ||
      o.numero_offerta?.toLowerCase().includes(q)
    const matchStato = !filtroStato || o.stato === filtroStato
    return matchCerca && matchStato
  })

  const totaleImporti = filtered.reduce((acc, o) => acc + (o.importo_netto || 0), 0)

  return (
    <>
      <Topbar title="Fornitura e Posa" subtitle="Ordini di fornitura e posa impianti" />
      <div style={{ padding: '20px 24px' }}>

        {/* KPI strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Ordini totali',  value: filtered.length,                                       color: '#92400e' },
            { label: 'Valore netto',   value: fmt(totaleImporti),                                    color: '#6ab04c' },
            { label: 'In corso',       value: filtered.filter(o => o.stato === 'attivo').length,     color: '#1d4ed8' },
            { label: 'Completati',     value: filtered.filter(o => o.stato === 'completato').length, color: '#166534' },
          ].map(k => (
            <div key={k.label} style={{ flex: 1, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Badge categoria */}
        <div style={{ marginBottom: 14 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20,
            background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d'
          }}>
            🔧 Fornitura / Posa
          </span>
        </div>

        {/* Filtri */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <input
            value={cerca} onChange={e => setCerca(e.target.value)}
            placeholder="🔍  Cerca per n° ordine, offerta, cliente..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}>
            <option value="">Tutti gli stati</option>
            <option value="bozza">Bozza</option>
            <option value="attivo">In corso</option>
            <option value="completato">Completato</option>
            <option value="sospeso">Sospeso</option>
          </select>
          <Link href="/ordine/nuovo" style={{
            padding: '8px 16px', borderRadius: 7, background: '#f59e0b', color: 'white',
            fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap'
          }}>
            + Nuovo ordine F/P
          </Link>
        </div>

        {/* Tabella */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fcd34d' }}>
                {['N° Ordine', 'Cliente', 'Portafoglio', 'Importo netto', 'Importo lordo', 'SAL', 'Stato', 'Azioni'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Caricamento...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  Nessun ordine di fornitura e posa trovato.{' '}
                  <Link href="/ordine/nuovo" style={{ color: '#f59e0b' }}>Crea il primo →</Link>
                </td></tr>
              )}
              {filtered.map(o => {
                const sal   = salSommario(o.sal)
                const st    = STATO_STYLE[o.stato] || STATO_STYLE.bozza
                const lordo = importoLordo(o)
                const isDel = deleting === o.id
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fffbeb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>

                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#92400e', fontFamily: 'monospace', fontSize: 12 }}>{o.numero_ordine}</div>
                      {o.numero_offerta && <div style={{ fontSize: 10, color: '#94a3b8' }}>Off. {o.numero_offerta}</div>}
                      <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 1 }}>{fmtData(o.created_at)}</div>
                    </td>

                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{nomeCliente(o.clienti)}</div>
                    </td>

                    <td style={{ padding: '11px 12px', color: '#64748b' }}>{o.clienti?.portafogli?.nome || '—'}</td>

                    <td style={{ padding: '11px 12px', fontWeight: 600, color: '#1e3a5f' }}>{fmt(o.importo_netto)}</td>

                    <td style={{ padding: '11px 12px', color: '#475569' }}>{fmt(lordo)}</td>

                    <td style={{ padding: '11px 12px' }}>
                      {sal.totale === 0 ? (
                        <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ fontSize: 11, color: '#475569' }}>{sal.pagato + sal.fatturato}/{sal.totale} emessi</div>
                          {sal.daEmettere > 0 && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#fef3c7', color: '#92400e', width: 'fit-content' }}>
                              {sal.daEmettere} da emettere
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '11px 12px' }}>
                      <select
                        value={o.stato || 'attivo'}
                        onChange={async e => {
                          const nuovoStato = e.target.value
                          await supabase.from('progetti').update({ stato: nuovoStato }).eq('id', o.id)
                          setOrdini(prev => prev.map(x => x.id === o.id ? { ...x, stato: nuovoStato } : x))
                        }}
                        style={{
                          fontSize: 11, fontWeight: 700,
                          padding: '4px 22px 4px 9px', borderRadius: 20,
                          border: `1px solid ${st.color}40`,
                          background: st.bg, color: st.color,
                          cursor: 'pointer', outline: 'none',
                          appearance: 'none' as any,
                          backgroundImage: "url(data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27%3E%3Cpath d=%27M0 0l5 6 5-6z%27 fill=%27%2364748b%27/%3E%3C/svg%3E)",
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 7px center',
                        }}
                      >
                        {Object.entries(STATO_STYLE).map(([k, v]) => (
                          <option key={k} value={k}>{(v as any).label}</option>
                        ))}
                      </select>
                    </td>

                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <Link
                          href={`/cantiere/${o.id}`}
                          style={{ fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
                            background: '#fffbeb', color: '#92400e', textDecoration: 'none',
                            border: '1px solid #fcd34d', whiteSpace: 'nowrap' }}
                        >
                          ✏ Modifica
                        </Link>
                        <button
                          onClick={e => eliminaOrdine(o.id, e)}
                          disabled={isDel}
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
            <span>{filtered.length} ordini Fornitura/Posa</span>
            <span style={{ fontWeight: 700, color: '#92400e' }}>Totale netto: {fmt(totaleImporti)}</span>
            <span style={{ fontWeight: 700, color: '#475569' }}>Totale lordo: {fmt(filtered.reduce((acc, o) => acc + importoLordo(o), 0))}</span>
          </div>
        )}
      </div>
    </>
  )
}
