'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

const IVA_OPTIONS = [
  { label: '22% — standard',          value: 22 },
  { label: '10% — fondi agricoli',    value: 10 },
  { label: '4% — agevolata',          value: 4  },
  { label: 'Esente art. 10',          value: 0  },
  { label: 'Fuori campo IVA',         value: 0  },
  { label: 'Reverse charge art. 17',  value: 0  },
]

const STATI_SAL = ['in_attesa', 'da_emettere', 'fatturato', 'pagato']
const STATI_SAL_LABEL: Record<string, string> = {
  in_attesa:   'In attesa',
  da_emettere: 'Da emettere',
  fatturato:   'Fatturato',
  pagato:      'Pagato',
}
const STATI_SAL_COLOR: Record<string, { bg: string; color: string }> = {
  in_attesa:   { bg: '#f1f5f9', color: '#475569' },
  da_emettere: { bg: '#fef3c7', color: '#92400e' },
  fatturato:   { bg: '#dbeafe', color: '#1d4ed8' },
  pagato:      { bg: '#dcfce7', color: '#166534' },
}

const STATI_ORDINE = [
  { value: 'bozza',      label: 'Bozza',      bg: '#f1f5f9', color: '#475569' },
  { value: 'attivo',     label: 'In corso',   bg: '#dbeafe', color: '#1d4ed8' },
  { value: 'completato', label: 'Completato', bg: '#dcfce7', color: '#166534' },
  { value: 'sospeso',    label: 'Sospeso',    bg: '#fef3c7', color: '#92400e' },
]

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

const fmtData = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const lbl: React.CSSProperties = {
  fontSize: 10, color: '#64748b', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4,
}
const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a', background: 'white',
}
const card: React.CSSProperties = {
  background: 'white', borderRadius: 10,
  border: '1px solid #e5e5e2', padding: 18, marginBottom: 12,
}

type SalRow = {
  id?: string
  numero: number
  descrizione: string
  percentuale: number
  importo: number
  data_prevista: string
  stato: string
}

export default function DettaglioOrdine() {
  const params  = useParams()
  const id      = params.id as string
  const router  = useRouter()
  const supabase = createClient()

  const [loading, setSaving2] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  // Dati ordine
  const [progetto,     setProgetto]     = useState<any>(null)
  const [numeroOrdine, setNumeroOrdine] = useState('')
  const [importoNetto, setImportoNetto] = useState(0)
  const [cassaPerc,   setCassaPerc]   = useState(4)
  const [ivaPerc,     setIvaPerc]     = useState(22)
  const [ivaLabel,    setIvaLabel]    = useState('22% — standard')
  const [stato,       setStato]       = useState('attivo')
  const [note,        setNote]        = useState('')

  // SAL
  const [sals,          setSals]          = useState<SalRow[]>([])
  const [mostraForm,    setMostraForm]    = useState(false)
  const [nuovoSal,      setNuovoSal]      = useState<Partial<SalRow>>({
    descrizione: '', percentuale: 0, data_prevista: '', stato: 'in_attesa',
  })

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase
        .from('progetti')
        .select('*, clienti(*, portafogli(nome))')
        .eq('id', id)
        .single()

      const { data: s } = await supabase
        .from('sal')
        .select('*')
        .eq('progetto_id', id)
        .order('numero')

      if (!p) { router.push('/ordini'); return }

      setProgetto(p)
      setNumeroOrdine(p.numero_ordine || '')
      setImportoNetto(p.importo_netto || 0)
      setCassaPerc(p.cassa_percentuale || 4)
      setIvaPerc(p.iva_percentuale || 22)
      const opt = IVA_OPTIONS.find(o => o.value === (p.iva_percentuale || 22))
      if (opt) setIvaLabel(opt.label)
      setStato(p.stato || 'attivo')
      setNote(p.note || '')
      setSals((s || []).map((sal: any): SalRow => ({
        id:            sal.id,
        numero:        sal.numero,
        descrizione:   sal.descrizione,
        percentuale:   sal.percentuale,
        importo:       sal.importo,
        data_prevista: sal.data_prevista || '',
        stato:         sal.stato,
      })))
      setSaving2(false)
    }
    load()
  }, [id])

  // ── Calcoli (cassa solo per ingegneria, mai per fornitura_posa) ───────────
  const isFornitura    = progetto?.tipo_servizio === 'fornitura_posa'
  const cassaEffettiva = isFornitura ? 0 : cassaPerc
  const importoCassa   = importoNetto * cassaEffettiva / 100
  const imponibile     = importoNetto + importoCassa
  const ivaImporto     = imponibile * ivaPerc / 100
  const totLordo       = imponibile + ivaImporto
  const percTotSal     = sals.reduce((acc, s) => acc + s.percentuale, 0)

  // ── Azioni ────────────────────────────────────────────────────────────────
  async function salvaModifiche() {
    setSaving(true)
    await supabase.from('progetti').update({
      importo_netto:    importoNetto,
      numero_ordine:    numeroOrdine,
      cassa_percentuale: isFornitura ? 0 : cassaPerc,
      iva_percentuale:  ivaPerc,
      stato,
      note: note || null,
    }).eq('id', id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function eliminaOrdine() {
    if (!confirm(
      'Eliminare questo ordine?\nVerranno eliminati anche tutti i SAL associati.\nL\'operazione è irreversibile.'
    )) return
    await supabase.from('progetti').delete().eq('id', id)
    router.push('/ordini')
  }

  async function aggiungiSal() {
    if (!nuovoSal.descrizione?.trim()) return
    const numero    = sals.length > 0 ? Math.max(...sals.map(s => s.numero)) + 1 : 1
    const perc      = nuovoSal.percentuale || 0
    const importoSal = imponibile * perc / 100

    const { data, error } = await supabase.from('sal').insert({
      progetto_id:   id,
      numero,
      descrizione:   nuovoSal.descrizione,
      percentuale:   perc,
      importo:       importoSal,
      data_prevista: nuovoSal.data_prevista || null,
      stato:         nuovoSal.stato || 'in_attesa',
    }).select().single()

    if (!error && data) {
      setSals(prev => [...prev, {
        id: data.id, numero, descrizione: nuovoSal.descrizione!,
        percentuale: perc, importo: importoSal,
        data_prevista: nuovoSal.data_prevista || '', stato: nuovoSal.stato || 'in_attesa',
      }])
      setNuovoSal({ descrizione: '', percentuale: 0, data_prevista: '', stato: 'in_attesa' })
      setMostraForm(false)
    }
  }

  async function aggiornaSalStato(salId: string, nuovoStato: string) {
    await supabase.from('sal').update({ stato: nuovoStato }).eq('id', salId)
    setSals(prev => prev.map(s => s.id === salId ? { ...s, stato: nuovoStato } : s))
  }

  async function eliminaSal(salId: string) {
    if (!confirm('Eliminare questo SAL?')) return
    await supabase.from('sal').delete().eq('id', salId)
    setSals(prev => prev.filter(s => s.id !== salId))
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Caricamento...</div>
  )

  const nomeCliente = progetto.clienti?.tipo_cliente === 'persona_fisica'
    ? `${progetto.clienti?.nome || ''} ${progetto.clienti?.cognome || ''}`.trim()
    : progetto.clienti?.ragione_sociale || '—'

  const statoStyle = STATI_ORDINE.find(s => s.value === stato) || STATI_ORDINE[1]

  return (
    <>
      <Topbar
        title={nomeCliente}
        subtitle={`${progetto.numero_ordine} · ${progetto.tipo_servizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura e Posa'}`}
      />
      <div style={{ padding: '20px 24px', maxWidth: 940, margin: '0 auto' }}>

        {/* Banner */}
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
          padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          ✏️ Modalità modifica — tutti i campi sono editabili. Premi <strong>Salva modifiche</strong> per confermare.
        </div>

        {/* ── HEADER ── */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%', background: '#dbeafe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: '#1d4ed8', flexShrink: 0,
              }}>
                {nomeCliente.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{nomeCliente}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {progetto.clienti?.portafogli?.nome && `${progetto.clienti.portafogli.nome} · `}
                  {progetto.numero_ordine}
                  {progetto.numero_offerta && ` · Off. ${progetto.numero_offerta}`}
                  {' · '}
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
                    background: progetto.tipo_servizio === 'ingegneria' ? '#dbeafe' : '#fef3c7',
                    color:      progetto.tipo_servizio === 'ingegneria' ? '#1d4ed8' : '#92400e',
                  }}>
                    {progetto.tipo_servizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura/Posa'}
                  </span>
                </div>
              </div>
            </div>

            {/* Elimina */}
            <button
              onClick={eliminaOrdine}
              style={{
                padding: '7px 14px', borderRadius: 7, border: '1px solid #fecaca',
                background: '#fee2e2', color: '#991b1b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              🗑 Elimina ordine
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>N° ordine</label>
              <input
                style={{ ...inp, fontWeight: 700, fontFamily: 'monospace' }}
                value={numeroOrdine}
                onChange={e => setNumeroOrdine(e.target.value)}
                placeholder="Es. ORD-2026-001"
              />
            </div>
            <div>
              <label style={lbl}>Data creazione</label>
              <div style={{ ...inp, background: '#f8fafc', color: '#475569' }}>
                {fmtData(progetto.created_at)}
              </div>
            </div>
            <div>
              <label style={lbl}>Stato ordine</label>
              <select
                style={{ ...inp, borderColor: statoStyle.color, fontWeight: 600, color: statoStyle.color }}
                value={stato}
                onChange={e => setStato(e.target.value)}
              >
                {STATI_ORDINE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── IMPORTO + IVA ── */}
        <div style={{ ...card, borderLeft: '3px solid #6ab04c', borderRadius: '0 10px 10px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>💰 Importo e IVA</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Importo netto €</label>
              <input
                style={{ ...inp, fontSize: 14, fontWeight: 600 }}
                type="number"
                value={importoNetto || ''}
                onChange={e => setImportoNetto(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                step="0.01"
                min={0}
              />
            </div>
            {!isFornitura && (
              <div>
                <label style={lbl}>Cassa ingegneri %</label>
                <input
                  style={inp}
                  type="number"
                  value={cassaPerc}
                  onChange={e => setCassaPerc(parseFloat(e.target.value) || 0)}
                  min={0} max={10} step={0.5}
                />
              </div>
            )}
            <div>
              <label style={lbl}>Aliquota IVA</label>
              <select
                style={inp}
                value={ivaLabel}
                onChange={e => {
                  const opt = IVA_OPTIONS.find(o => o.label === e.target.value)
                  setIvaLabel(e.target.value)
                  setIvaPerc(opt?.value ?? 0)
                }}
              >
                {IVA_OPTIONS.map(o => <option key={o.label}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Riepilogo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { label: 'Importo netto',                                 val: fmt(importoNetto),  color: '#1e3a5f' },
              ...(!isFornitura ? [{ label: `Cassa ingegneri (${cassaPerc}%)`, val: fmt(importoCassa), color: '#475569' }] : []),
              { label: `IVA (${ivaPerc}%)`,                             val: fmt(ivaImporto),   color: '#475569' },
              { label: 'Totale lordo',                                  val: fmt(totLordo),     color: '#166534', bold: true },
            ].map(k => (
              <div key={k.label} style={{
                background: k.bold ? '#f0fdf4' : '#f8fafc',
                border: k.bold ? '1px solid rgba(106,176,76,.25)' : '1px solid transparent',
                borderRadius: 8, padding: '12px 14px',
              }}>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                  {k.label}
                </div>
                <div style={{ fontSize: k.bold ? 17 : 14, fontWeight: k.bold ? 800 : 600, color: k.color }}>
                  {k.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SAL ── */}
        <div style={{ ...card, borderLeft: '3px solid #3b82f6', borderRadius: '0 10px 10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>📋 SAL — Stati Avanzamento Lavori</div>
              {sals.length > 0 && (
                <div style={{
                  fontSize: 11, marginTop: 3,
                  color: Math.abs(percTotSal - 100) < 0.01 ? '#166534' : '#92400e',
                }}>
                  {Math.abs(percTotSal - 100) < 0.01
                    ? `✓ Totale: 100% — ${fmt(imponibile)}`
                    : `⚠ Totale percentuali: ${percTotSal}% — deve fare 100%`}
                </div>
              )}
            </div>
            <button
              onClick={() => setMostraForm(v => !v)}
              style={{
                padding: '7px 16px', borderRadius: 7, background: mostraForm ? '#f1f5f9' : '#3b82f6',
                color: mostraForm ? '#475569' : 'white', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {mostraForm ? '✕ Chiudi' : '+ Aggiungi SAL'}
            </button>
          </div>

          {/* Form nuovo SAL */}
          {mostraForm && (
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 8, padding: 16, marginBottom: 14,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 10 }}>
                Nuovo SAL #{sals.length > 0 ? Math.max(...sals.map(s => s.numero)) + 1 : 1}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1.2fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={lbl}>Descrizione</label>
                  <input
                    style={inp}
                    value={nuovoSal.descrizione || ''}
                    onChange={e => setNuovoSal(p => ({ ...p, descrizione: e.target.value }))}
                    placeholder="Es. Acconto alla firma del contratto..."
                    autoFocus
                  />
                </div>
                <div>
                  <label style={lbl}>Percentuale %</label>
                  <input
                    style={inp}
                    type="number" min={0} max={100} step={1}
                    value={nuovoSal.percentuale || ''}
                    onChange={e => setNuovoSal(p => ({ ...p, percentuale: parseFloat(e.target.value) || 0 }))}
                    placeholder="30"
                  />
                </div>
                <div>
                  <label style={lbl}>Data prevista</label>
                  <input
                    style={inp}
                    type="date"
                    value={nuovoSal.data_prevista || ''}
                    onChange={e => setNuovoSal(p => ({ ...p, data_prevista: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={lbl}>Stato iniziale</label>
                  <select
                    style={inp}
                    value={nuovoSal.stato || 'in_attesa'}
                    onChange={e => setNuovoSal(p => ({ ...p, stato: e.target.value }))}
                  >
                    {STATI_SAL.map(s => <option key={s} value={s}>{STATI_SAL_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>

              {(nuovoSal.percentuale || 0) > 0 && imponibile > 0 && (
                <div style={{
                  fontSize: 12, color: '#1d4ed8', background: '#dbeafe',
                  borderRadius: 6, padding: '7px 12px', marginBottom: 10, display: 'inline-block',
                }}>
                  Importo calcolato: <strong>{fmt(imponibile * (nuovoSal.percentuale || 0) / 100)}</strong>
                  {percTotSal + (nuovoSal.percentuale || 0) > 100 && (
                    <span style={{ color: '#991b1b', marginLeft: 10 }}>⚠ Supera 100%!</span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={aggiungiSal}
                  disabled={!nuovoSal.descrizione?.trim()}
                  style={{
                    padding: '7px 18px', borderRadius: 7, border: 'none',
                    background: !nuovoSal.descrizione?.trim() ? '#94a3b8' : '#6ab04c',
                    color: 'white', fontSize: 11, fontWeight: 600,
                    cursor: !nuovoSal.descrizione?.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  ✓ Aggiungi SAL
                </button>
                <button
                  onClick={() => setMostraForm(false)}
                  style={{
                    padding: '7px 12px', borderRadius: 7, background: 'white',
                    color: '#475569', border: '1px solid #e2e8f0', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {/* Tabella SAL */}
          {sals.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '28px 0', color: '#94a3b8',
              fontSize: 12, border: '1px dashed #e2e8f0', borderRadius: 8,
            }}>
              Nessun SAL ancora definito.{' '}
              <button
                onClick={() => setMostraForm(true)}
                style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
              >
                Aggiungine uno →
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    {['SAL', 'Descrizione', '%', 'Importo', 'Data prevista', 'Stato', ''].map(h => (
                      <th key={h} style={{
                        padding: '9px 10px', textAlign: 'left',
                        fontSize: 10, color: '#94a3b8', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '.04em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sals.map(s => {
                    const sc = STATI_SAL_COLOR[s.stato] || STATI_SAL_COLOR.in_attesa
                    return (
                      <tr
                        key={s.id || s.numero}
                        style={{ borderBottom: '1px solid #f8fafc' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
                        <td style={{ padding: '10px 10px', fontWeight: 700, color: '#1e3a5f', fontFamily: 'monospace' }}>
                          #{s.numero}
                        </td>
                        <td style={{ padding: '10px 10px', color: '#0f172a', fontWeight: 500 }}>
                          {s.descrizione}
                        </td>
                        <td style={{ padding: '10px 10px', color: '#475569', fontWeight: 600 }}>
                          {s.percentuale}%
                        </td>
                        <td style={{ padding: '10px 10px', fontWeight: 700, color: '#1e3a5f' }}>
                          {fmt(s.importo)}
                        </td>
                        <td style={{ padding: '10px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {fmtData(s.data_prevista)}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <select
                            value={s.stato}
                            onChange={e => s.id && aggiornaSalStato(s.id, e.target.value)}
                            style={{
                              fontSize: 11, fontWeight: 600,
                              padding: '4px 10px', borderRadius: 20, border: 'none',
                              cursor: 'pointer', outline: 'none',
                              background: sc.bg, color: sc.color,
                              appearance: 'none' as any,
                            }}
                          >
                            {STATI_SAL.map(st => (
                              <option key={st} value={st}>{STATI_SAL_LABEL[st]}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <button
                            onClick={() => s.id && eliminaSal(s.id)}
                            style={{
                              padding: '4px 9px', borderRadius: 6, border: '1px solid #fecaca',
                              background: '#fee2e2', color: '#991b1b', fontSize: 11,
                              cursor: 'pointer', fontWeight: 600,
                            }}
                            title="Elimina SAL"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── NOTE ── */}
        <div style={card}>
          <label style={lbl}>Note interne</label>
          <textarea
            style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note sull'ordine, condizioni particolari, riferimenti..."
          />
        </div>

        {/* ── AZIONI ── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
          <Link
            href="/ordini"
            style={{
              padding: '8px 16px', borderRadius: 7,
              border: '1px solid #e2e8f0', background: 'white',
              color: '#475569', fontSize: 12, textDecoration: 'none',
            }}
          >
            ← Lista ordini
          </Link>
          <div style={{ flex: 1 }} />
          {saved && (
            <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>✓ Salvato!</span>
          )}
          <button
            onClick={salvaModifiche}
            disabled={saving}
            style={{
              padding: '9px 24px', borderRadius: 7, border: 'none',
              background: saving ? '#94a3b8' : '#6ab04c',
              color: 'white', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Salvataggio...' : '💾 Salva modifiche'}
          </button>
        </div>

      </div>
    </>
  )
}
