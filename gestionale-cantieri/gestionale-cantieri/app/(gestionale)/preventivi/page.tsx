'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Preventivo, StatoPreventivo } from '@/lib/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const fmtData = (d: string) =>
  d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const STATO: Record<StatoPreventivo, { bg: string; color: string; label: string }> = {
  bozza:     { bg: '#f1f5f9', color: '#475569', label: 'Bozza' },
  inviato:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Inviato' },
  in_attesa: { bg: '#fef3c7', color: '#92400e', label: 'In attesa' },
  accettato: { bg: '#dcfce7', color: '#166534', label: 'Accettato' },
  rifiutato: { bg: '#fee2e2', color: '#991b1b', label: 'Rifiutato' },
  scaduto:   { bg: '#f1f5f9', color: '#94a3b8', label: 'Scaduto' },
}

export default function PreventiviPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [preventivi,    setPreventivi]    = useState<Preventivo[]>([])
  const [loading,       setLoading]       = useState(true)
  const [cerca,         setCerca]         = useState('')
  const [filtroStato,   setFiltroStato]   = useState('')
  const [converting,    setConverting]    = useState<string | null>(null)
  const [toast,         setToast]         = useState<{ msg: string; ordine: string } | null>(null)

  useEffect(() => {
    supabase
      .from('preventivi')
      .select('*, clienti(ragione_sociale, portafogli(nome)), preventivo_voci(importo)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPreventivi((data as any[]) || [])
        setLoading(false)
      })
  }, [])

  async function aggiornaStato(id: string, stato: StatoPreventivo) {
    await supabase.from('preventivi').update({ stato }).eq('id', id)
    setPreventivi(prev => prev.map(p => p.id === id ? { ...p, stato } : p))
  }

  // ── Converti in ordine ──────────────────────────────────────────────────────
  async function convertiInOrdine(p: Preventivo) {
    if (!confirm(`Confermi l'accettazione di ${p.numero_offerta}?\nViene creato automaticamente un ordine con numero progressivo.`)) return
    setConverting(p.id)
    try {
      // 1. Calcola prossimo numero ordine
      const anno = new Date().getFullYear()
      const { data: lastOrd } = await supabase
        .from('progetti')
        .select('numero_ordine')
        .ilike('numero_ordine', `ORD-${anno}-%`)
        .order('numero_ordine', { ascending: false })
        .limit(1)

      let nextNum = 1
      if (lastOrd && lastOrd.length > 0) {
        const match = lastOrd[0].numero_ordine.match(/(\d+)$/)
        if (match) nextNum = parseInt(match[1]) + 1
      }
      const numeroOrdine = `ORD-${anno}-${String(nextNum).padStart(3, '0')}`

      // 2. Calcola importo netto dal totale voci
      const importoNetto = totaleVoci(p)

      // 3. Crea ordine (progetto) da preventivo
      const { error } = await supabase.from('progetti').insert({
        numero_ordine:    numeroOrdine,
        numero_offerta:   p.numero_offerta,
        cliente_id:       (p as any).cliente_id || null,
        tipo_servizio:    p.tipo_servizio || 'ingegneria',
        servizi:          [],
        importo_netto:    importoNetto,
        cassa_percentuale: 0,
        iva_percentuale:  p.iva_percentuale || 22,
        note:             `Generato da ${p.numero_offerta} il ${new Date().toLocaleDateString('it-IT')}`,
        stato:            'attivo',
      })

      if (error) throw error

      // 4. Segna preventivo come accettato
      await aggiornaStato(p.id, 'accettato')

      // 5. Toast e redirect
      setToast({ msg: `${p.numero_offerta} convertito in`, ordine: numeroOrdine })
      setTimeout(() => {
        setToast(null)
        router.push('/ordini')
      }, 2200)
    } catch (e) {
      console.error(e)
      alert('Errore durante la conversione in ordine.')
    } finally {
      setConverting(null)
    }
  }

  const totaleVoci = (p: any) =>
    (p.preventivo_voci || []).reduce((acc: number, v: any) => acc + (v.importo || 0), 0)

  const filtered = preventivi.filter(p => {
    const q = cerca.toLowerCase()
    const cliente = (p as any).clienti?.ragione_sociale || ''
    const matchCerca = !q ||
      p.numero_offerta?.toLowerCase().includes(q) ||
      cliente.toLowerCase().includes(q) ||
      p.oggetto?.toLowerCase().includes(q)
    const matchStato = !filtroStato || p.stato === filtroStato
    return matchCerca && matchStato
  })

  const totAccettati = filtered.filter(p => p.stato === 'accettato').length
  const totInAttesa  = filtered.filter(p => p.stato === 'in_attesa').length
  const totValore    = filtered.reduce((acc, p) => acc + totaleVoci(p), 0)

  return (
    <>
      <Topbar title="Preventivi" subtitle="Gestione offerte commerciali" />
      <div style={{ padding: '20px 24px' }}>

        {/* Toast conversione */}
        {toast && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #6ab04c', borderRadius: 10,
            padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, color: '#166534', fontWeight: 500,
          }}>
            🎉 <strong>{toast.msg}</strong>&nbsp;
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e3a5f' }}>{toast.ordine}</span>
            &nbsp;— Reindirizzamento agli ordini...
          </div>
        )}

        {/* KPI */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Preventivi trovati', value: filtered.length,  color: '#1e3a5f' },
            { label: 'Valore offerte',     value: fmt(totValore),   color: '#6ab04c' },
            { label: 'In attesa',          value: totInAttesa,      color: '#92400e' },
            { label: 'Accettati',          value: totAccettati,     color: '#166534' },
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
            value={cerca}
            onChange={e => setCerca(e.target.value)}
            placeholder="🔍  Cerca per n° offerta, cliente, oggetto..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}>
            <option value="">Tutti gli stati</option>
            {Object.entries(STATO).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <Link href="/preventivo/nuovo" style={{
            padding: '8px 16px', borderRadius: 7, background: '#6ab04c',
            color: 'white', fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            + Nuovo preventivo
          </Link>
        </div>

        {/* Tabella */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                {['N° Offerta', 'Cliente', 'Tipo', 'Oggetto', 'Importo', 'Data emissione', 'Scadenza', 'Stato', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Caricamento...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  Nessun preventivo trovato.{' '}
                  <Link href="/preventivo/nuovo" style={{ color: '#6ab04c' }}>Crea il primo →</Link>
                </td></tr>
              )}
              {filtered.map(p => {
                const st = STATO[p.stato] || STATO.bozza
                const cliente = (p as any).clienti?.ragione_sociale || '—'
                const importo = totaleVoci(p)
                const scadenza = p.data_emissione
                  ? new Date(new Date(p.data_emissione).getTime() + (p.validita_giorni || 20) * 86400000).toLocaleDateString('it-IT')
                  : '—'
                const servBg  = p.tipo_servizio === 'ingegneria' ? '#dbeafe' : '#fff3e0'
                const servCol = p.tipo_servizio === 'ingegneria' ? '#1d4ed8' : '#92400e'
                const servLbl = p.tipo_servizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura/Posa'
                const isConverting = converting === p.id

                return (
                  <tr key={p.id}
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#1e3a5f', fontFamily: 'monospace', fontSize: 12 }}>{p.numero_offerta}</div>
                      <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 1 }}>{fmtData(p.created_at)}</div>
                    </td>
                    <td style={{ padding: '11px 12px', fontWeight: 600 }}>{cliente}</td>
                    <td style={{ padding: '11px 12px' }}>
                      {p.tipo_servizio && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: servBg, color: servCol }}>{servLbl}</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#64748b', fontSize: 11, maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.oggetto || '—'}</div>
                    </td>
                    <td style={{ padding: '11px 12px', fontWeight: 700, color: '#1e3a5f' }}>
                      {importo > 0 ? fmt(importo) : '—'}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#64748b', fontSize: 11 }}>{fmtData(p.data_emissione)}</td>
                    <td style={{ padding: '11px 12px', color: '#64748b', fontSize: 11 }}>{scadenza}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <select
                        value={p.stato}
                        onChange={e => { e.stopPropagation(); aggiornaStato(p.id, e.target.value as StatoPreventivo) }}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', background: st.bg, color: st.color }}
                      >
                        {Object.entries(STATO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Link
                          href={`/preventivo/${p.id}`}
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: '#f1f5f9', color: '#1e3a5f', textDecoration: 'none', whiteSpace: 'nowrap', border: '1px solid #e2e8f0' }}
                        >
                          ✏ Apri e modifica
                        </Link>
                        {/* Pulsante Accettato — solo se non già accettato/rifiutato */}
                        {p.stato !== 'accettato' && p.stato !== 'rifiutato' && (
                          <button
                            onClick={e => { e.stopPropagation(); convertiInOrdine(p) }}
                            disabled={isConverting}
                            style={{
                              fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                              border: 'none', cursor: isConverting ? 'not-allowed' : 'pointer',
                              background: isConverting ? '#94a3b8' : '#22c55e', color: 'white',
                              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            {isConverting ? '...' : '✓ Accettato'}
                          </button>
                        )}
                        {p.stato === 'accettato' && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: '#dcfce7', color: '#166534', whiteSpace: 'nowrap' }}>
                            ✓ In ordine
                          </span>
                        )}
                      </div>
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
