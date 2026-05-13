'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createClient as createClientBrowser } from '@supabase/supabase-js'
import Topbar from '@/components/Topbar'
import Link from 'next/link'

// ── Client ANG Gest (ordini/progetti)
const supabaseGest = createClient()

// ── Client athena-cantieri (dati real-time)
const supabaseCantieri = createClientBrowser(
  'https://bfcfgxpkwmlhvjhegmxv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmY2ZneHBrd21saHZqaGVnbXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTM5NzIsImV4cCI6MjA5Mjg2OTk3Mn0.PbwbpCklqiZv_rrsCjATxc56rNCNy_s-cXSideAMY0Y'
)

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const STATO_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  bozza:      { bg: '#f1f5f9', color: '#475569', label: 'Bozza' },
  attivo:     { bg: '#dbeafe', color: '#1d4ed8', label: 'In corso' },
  completato: { bg: '#dcfce7', color: '#166534', label: 'Completato' },
  sospeso:    { bg: '#fef3c7', color: '#92400e', label: 'Sospeso' },
}

function avanzamentoCantiere(c: any): number {
  if (!c) return 0
  const cl = c.check_list
  if (!cl || !Array.isArray(cl)) return 0
  const done = cl.filter(Boolean).length
  return Math.round((done / cl.length) * 100)
}

function CheckPill({ label, done }: { label: string; done: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: done ? '#dcfce7' : '#f1f5f9',
      color: done ? '#166534' : '#94a3b8',
      border: `1px solid ${done ? '#bbf7d0' : '#e2e8f0'}`,
      whiteSpace: 'nowrap',
    }}>
      {done ? '✓' : '○'} {label}
    </span>
  )
}

export default function GestioneCantieriPage() {
  const [ordini,        setOrdini]        = useState<any[]>([])
  const [cantieri,      setCantieri]      = useState<Record<string, any>>({}) // keyed by cliente name
  const [loading,       setLoading]       = useState(true)
  const [cerca,         setCerca]         = useState('')
  const [filtroStato,   setFiltroStato]   = useState('')
  const [deleting,      setDeleting]      = useState<string | null>(null)
  const [aggiornati,    setAggiornati]    = useState<Set<string>>(new Set()) // IDs con update recente
  const channelRef = useRef<any>(null)

  // 1. Carica ordini da ANG Gest
  useEffect(() => {
    supabaseGest
      .from('progetti')
      .select('*, clienti(ragione_sociale, nome, cognome, tipo_cliente, portafogli(nome)), sal(id, numero, importo, stato, data_prevista)')
      .eq('tipo_servizio', 'fornitura_posa')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrdini(data || [])
        setLoading(false)
        if (data) loadCantieri(data)
      })
  }, [])

  // 2. Carica cantieri da athena-cantieri per nome cliente
  async function loadCantieri(ords: any[]) {
    const ids = ords.map(o => o.id).filter(Boolean)
    if (!ids.length) return

    // Prima cerca per gest_id (cantieri creati da ANG Gest)
    const { data: byId } = await supabaseCantieri
      .from('cantieri')
      .select('*')
      .in('gest_id', ids)

    // Poi cerca per nome cliente (cantieri creati prima)
    const nomi = ords.map(o => nomeCliente(o.clienti)).filter(n => n && n !== '—')
    const { data: byNome } = await supabaseCantieri
      .from('cantieri')
      .select('*')
      .in('cliente', nomi)

    const all = [...(byId || []), ...(byNome || [])]
    const map: Record<string, any> = {}

    // Mappa per gest_id
    all.forEach(c => {
      if (c.gest_id) map[c.gest_id] = c
    })

    // Mappa per nome (fallback)
    all.forEach(c => {
      if (!c.gest_id) map[c.cliente] = c
    })

    setCantieri(map)
  }

  // 3. Realtime su athena-cantieri
  useEffect(() => {
    channelRef.current = supabaseCantieri
      .channel('cantieri-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cantieri',
      }, (payload: any) => {
        const updated = payload.new || payload.old
        if (!updated) return

        // Aggiorna la mappa cantieri
        setCantieri(prev => ({
          ...prev,
          [updated.cliente]: updated,
        }))

        // Trova l'ordine corrispondente e segnala aggiornamento
        setOrdini(prev => {
          const ord = prev.find(o => nomeCliente(o.clienti) === updated.cliente)
          if (ord) {
            setAggiornati(a => {
              const next = new Set(a)
              next.add(ord.id)
              // Rimuovi il flash dopo 4 secondi
              setTimeout(() => {
                setAggiornati(curr => {
                  const n = new Set(curr)
                  n.delete(ord.id)
                  return n
                })
              }, 4000)
              return next
            })
          }
          return prev
        })
      })
      .subscribe()

    return () => {
      if (channelRef.current) supabaseCantieri.removeChannel(channelRef.current)
    }
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
    if (!confirm('Eliminare questo ordine?\nOperazione irreversibile.')) return
    setDeleting(id)
    await supabaseGest.from('progetti').delete().eq('id', id)
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
      <Topbar title="Gestione Cantieri" subtitle="Fornitura e posa — aggiornamento in tempo reale" />
      <div style={{ padding: '20px 24px' }}>

        {/* KPI */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Cantieri totali', value: filtered.length,                                       color: '#92400e' },
            { label: 'Valore netto',    value: fmt(totaleImporti),                                    color: '#6ab04c' },
            { label: 'In corso',        value: filtered.filter(o => o.stato === 'attivo').length,     color: '#1d4ed8' },
            { label: 'Completati',      value: filtered.filter(o => o.stato === 'completato').length, color: '#166534' },
          ].map(k => (
            <div key={k.label} style={{ flex: 1, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6ab04c', boxShadow: '0 0 0 3px #dcfce7', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 11, color: '#6ab04c', fontWeight: 600 }}>Live — aggiornamento in tempo reale da ANG Cantieri</span>
        </div>

        <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 3px #dcfce7}50%{box-shadow:0 0 0 6px #bbf7d0}} @keyframes flashGreen{0%{background:#f0fdf4;border-color:#6ab04c}100%{background:white;border-color:#e5e7eb}}`}</style>

        {/* Filtri */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <input
            value={cerca} onChange={e => setCerca(e.target.value)}
            placeholder="🔍  Cerca per n° ordine, cliente..."
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
            + Nuovo
          </Link>
        </div>

        {/* Lista cantieri */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Caricamento...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              Nessun cantiere trovato.{' '}
              <Link href="/ordine/nuovo" style={{ color: '#f59e0b' }}>Crea il primo →</Link>
            </div>
          )}

          {filtered.map(o => {
            const nome     = nomeCliente(o.clienti)
            const cantiere = cantieri[o.id] || cantieri[nome]
            const pct      = avanzamentoCantiere(cantiere)
            const sal      = salSommario(o.sal)
            const st       = STATO_STYLE[o.stato] || STATO_STYLE.bozza
            const isDel    = deleting === o.id
            const isFlash  = aggiornati.has(o.id)
            const cl       = cantiere?.check_list || []

            return (
              <div key={o.id} style={{
                background: isFlash ? '#f0fdf4' : 'white',
                border: `1px solid ${isFlash ? '#6ab04c' : '#e5e7eb'}`,
                borderRadius: 12,
                padding: '16px 18px',
                transition: 'all .4s ease',
                boxShadow: isFlash ? '0 0 0 3px #dcfce7' : 'none',
              }}>

                {/* Header riga */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, color: '#92400e', fontFamily: 'monospace', fontSize: 13 }}>{o.numero_ordine}</span>
                      {isFlash && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#6ab04c', color: 'white', animation: 'none' }}>
                          ⚡ Aggiornato ora
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#0f172a' }}>{nome}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{o.clienti?.portafogli?.nome || ''}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={o.stato || 'attivo'}
                      onChange={async e => {
                        const nuovoStato = e.target.value
                        await supabaseGest.from('progetti').update({ stato: nuovoStato }).eq('id', o.id)
                        setOrdini(prev => prev.map(x => x.id === o.id ? { ...x, stato: nuovoStato } : x))
                      }}
                      style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 22px 4px 9px', borderRadius: 20,
                        border: `1px solid ${st.color}40`, background: st.bg, color: st.color,
                        cursor: 'pointer', outline: 'none', appearance: 'none' as any,
                        backgroundImage: "url(data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27%3E%3Cpath d=%27M0 0l5 6 5-6z%27 fill=%27%2364748b%27/%3E%3C/svg%3E)",
                        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center',
                      }}
                    >
                      {Object.entries(STATO_STYLE).map(([k, v]) => (
                        <option key={k} value={k}>{(v as any).label}</option>
                      ))}
                    </select>
                    <Link href={`/cantiere/${o.id}`} style={{
                      fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
                      background: '#fffbeb', color: '#92400e', textDecoration: 'none',
                      border: '1px solid #fcd34d', whiteSpace: 'nowrap'
                    }}>
                      ✏ Dettaglio
                    </Link>
                    <button onClick={e => eliminaOrdine(o.id, e)} disabled={isDel}
                      style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #fecaca',
                        background: isDel ? '#f1f5f9' : '#fee2e2', color: isDel ? '#94a3b8' : '#991b1b',
                        fontSize: 10, fontWeight: 600, cursor: isDel ? 'not-allowed' : 'pointer' }}>
                      {isDel ? '...' : '🗑'}
                    </button>
                  </div>
                </div>

                {/* Barra avanzamento */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {cantiere ? 'Avanzamento ANG Cantieri' : 'Nessun dato da ANG Cantieri'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? '#166534' : pct > 0 ? '#1d4ed8' : '#94a3b8' }}>
                      {cantiere ? `${pct}%` : '—'}
                    </span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: pct === 100 ? '#6ab04c' : '#1d4ed8',
                      borderRadius: 3, transition: 'width .5s ease',
                    }} />
                  </div>
                </div>

                {/* Checklist pills */}
                {cantiere && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {['Sopralluogo', 'Mat. ordinati', 'Materiali', 'Posa', 'Collaudo'].map((label, i) => (
                      <CheckPill key={label} label={label} done={!!cl[i]} />
                    ))}
                  </div>
                )}

                {/* Footer: importi + SAL + kW */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                  <span style={{ fontSize: 11, color: '#475569' }}>
                    Netto: <strong style={{ color: '#1e3a5f' }}>{fmt(o.importo_netto)}</strong>
                  </span>
                  {sal.totale > 0 && (
                    <span style={{ fontSize: 11, color: '#475569' }}>
                      SAL: <strong>{sal.pagato + sal.fatturato}/{sal.totale}</strong>
                      {sal.daEmettere > 0 && <span style={{ color: '#92400e', marginLeft: 4 }}>· {sal.daEmettere} da emettere</span>}
                    </span>
                  )}
                  {cantiere?.kw && (
                    <span style={{ fontSize: 11, color: '#475569' }}>
                      ⚡ <strong style={{ color: '#1e3a5f' }}>{cantiere.kw} kW</strong>
                    </span>
                  )}
                  {cantiere?.acc && (
                    <span style={{ fontSize: 11, color: '#475569' }}>
                      🔋 <strong style={{ color: '#1e3a5f' }}>{cantiere.acc} kWh</strong>
                    </span>
                  )}
                  {cantiere?.squadra_id && (
                    <span style={{ fontSize: 11, color: '#475569' }}>
                      👷 Squadra assegnata
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 24, fontSize: 12, color: '#64748b' }}>
            <span>{filtered.length} cantieri</span>
            <span style={{ fontWeight: 700, color: '#92400e' }}>Totale netto: {fmt(totaleImporti)}</span>
          </div>
        )}
      </div>
    </>
  )
}
