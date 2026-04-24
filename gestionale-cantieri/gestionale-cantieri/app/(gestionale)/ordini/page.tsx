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

export default function OrdiniPage() {
  const supabase = createClient()
  const [ordini, setOrdini] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [cerca, setCerca] = useState('')
  const [filtroStato, setFiltroStato] = useState('')
  const [filtroServizio, setFiltroServizio] = useState('')

  useEffect(() => {
    supabase
      .from('progetti')
      .select('*, clienti(ragione_sociale, nome, cognome, tipo_cliente, portafogli(nome)), sal(id, numero, importo, stato, data_prevista)')
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
    const cassa = p.importo_netto * (p.cassa_percentuale / 100)
    const imponibile = p.importo_netto + cassa
    return imponibile * (1 + p.iva_percentuale / 100)
  }

  const salSommario = (sals: any[]) => {
    if (!sals?.length) return { totale: 0, fatturato: 0, pagato: 0, daEmettere: 0 }
    return {
      totale: sals.length,
      fatturato: sals.filter(s => s.stato === 'fatturato').length,
      pagato: sals.filter(s => s.stato === 'pagato').length,
      daEmettere: sals.filter(s => s.stato === 'da_emettere').length,
    }
  }

  const filtered = ordini.filter(o => {
    const q = cerca.toLowerCase()
    const matchCerca = !q ||
      o.numero_ordine?.toLowerCase().includes(q) ||
      nomeCliente(o.clienti).toLowerCase().includes(q) ||
      o.numero_offerta?.toLowerCase().includes(q)
    const matchStato = !filtroStato || o.stato === filtroStato
    const matchServizio = !filtroServizio || o.tipo_servizio === filtroServizio
    return matchCerca && matchStato && matchServizio
  })

  const totaleImporti = filtered.reduce((acc, o) => acc + (o.importo_netto || 0), 0)
  const totaleOrdini = filtered.length

  return (
    <>
      <Topbar title="Ordini" subtitle="Tutti gli ordini emessi" />
      <div style={{ padding: '20px 24px' }}>

        {/* KPI strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Ordini trovati',    value: totaleOrdini,                                       color: '#1e3a5f' },
            { label: 'Valore netto',      value: fmt(totaleImporti),                                 color: '#6ab04c' },
            { label: 'In corso',          value: filtered.filter(o => o.stato === 'attivo').length,  color: '#1d4ed8' },
            { label: 'Completati',        value: filtered.filter(o => o.stato === 'completato').length, color: '#166534' },
          ].map(k => (
            <div key={k.label} style={{
              flex: 1, background: 'white', border: '1px solid #e5e7eb',
              borderRadius: 10, padding: '12px 16px'
            }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Filtri */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <input
            value={cerca}
            onChange={e => setCerca(e.target.value)}
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
          <select value={filtroServizio} onChange={e => setFiltroServizio(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}>
            <option value="">Tutti i servizi</option>
            <option value="ingegneria">Ingegneria</option>
            <option value="fornitura_posa">Fornitura e Posa</option>
          </select>
          <Link href="/ordine/nuovo" style={{
            padding: '8px 16px', borderRadius: 7, background: '#6ab04c',
            color: 'white', fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap'
          }}>
            + Nuovo ordine
          </Link>
        </div>

        {/* Tabella */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                {['N° Ordine', 'Cliente', 'Portafoglio', 'Servizio', 'Importo netto', 'Importo lordo', 'SAL', 'Stato', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'left',
                    fontSize: 10, color: '#94a3b8', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '.04em'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  Caricamento...
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  Nessun ordine trovato.{' '}
                  <Link href="/ordine/nuovo" style={{ color: '#6ab04c' }}>Crea il primo →</Link>
                </td></tr>
              )}
              {filtered.map(o => {
                const sal = salSommario(o.sal)
                const st = STATO_STYLE[o.stato] || STATO_STYLE.bozza
                const lordo = importoLordo(o)
                return (
                  <tr
                    key={o.id}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#1e3a5f', fontFamily: 'monospace', fontSize: 12 }}>
                        {o.numero_ordine}
                      </div>
                      {o.numero_offerta && (
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>Off. {o.numero_offerta}</div>
                      )}
                      <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 1 }}>{fmtData(o.created_at)}</div>
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{nomeCliente(o.clienti)}</div>
                    </td>
                    <td style={{ padding: '11px 12px', color: '#64748b' }}>
                      {o.clienti?.portafogli?.nome || '—'}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: o.tipo_servizio === 'ingegneria' ? '#dbeafe' : '#fef3c7',
                        color: o.tipo_servizio === 'ingegneria' ? '#1d4ed8' : '#92400e'
                      }}>
                        {o.tipo_servizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura/Posa'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px', fontWeight: 600, color: '#1e3a5f' }}>
                      {fmt(o.importo_netto)}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#475569' }}>
                      {fmt(lordo)}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      {sal.totale === 0 ? (
                        <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ fontSize: 11, color: '#475569' }}>
                            {sal.pagato + sal.fatturato}/{sal.totale} emessi
                          </div>
                          {sal.daEmettere > 0 && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                              background: '#fef3c7', color: '#92400e', width: 'fit-content'
                            }}>
                              {sal.daEmettere} da emettere
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                        background: st.bg, color: st.color
                      }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <Link
                        href={`/progetti/${o.id}`}
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                          background: '#f1f5f9', color: '#1e3a5f', textDecoration: 'none',
                          whiteSpace: 'nowrap', border: '1px solid #e2e8f0'
                        }}
                      >
                        Vai al progetto →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 24, fontSize: 12, color: '#64748b' }}>
            <span>{totaleOrdini} ordini</span>
            <span style={{ fontWeight: 700, color: '#1e3a5f' }}>Totale netto: {fmt(totaleImporti)}</span>
            <span style={{ fontWeight: 700, color: '#475569' }}>
              Totale lordo: {fmt(filtered.reduce((acc, o) => acc + importoLordo(o), 0))}
            </span>
          </div>
        )}
      </div>
    </>
  )
}
