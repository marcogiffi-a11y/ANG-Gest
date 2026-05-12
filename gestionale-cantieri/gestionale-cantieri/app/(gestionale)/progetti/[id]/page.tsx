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
  in_attesa: 'In attesa', da_emettere: 'Da emettere', fatturato: 'Fatturato', pagato: 'Pagato',
}
const STATI_SAL_COLOR: Record<string, { bg: string; color: string }> = {
  in_attesa:   { bg: '#f1f5f9', color: '#475569' },
  da_emettere: { bg: '#fef3c7', color: '#92400e' },
  fatturato:   { bg: '#dbeafe', color: '#1d4ed8' },
  pagato:      { bg: '#dcfce7', color: '#166534' },
}

const STATI_ATT = ['da_fare', 'in_corso', 'completata', 'sospesa']
const STATI_ATT_LABEL: Record<string, string> = {
  da_fare: 'Da fare', in_corso: 'In corso', completata: 'Completata', sospesa: 'Sospesa',
}
const STATI_ATT_COLOR: Record<string, { bg: string; color: string; icon: string }> = {
  da_fare:    { bg: '#f1f5f9', color: '#475569', icon: '○' },
  in_corso:   { bg: '#fef3c7', color: '#92400e', icon: '⟳' },
  completata: { bg: '#dcfce7', color: '#166534', icon: '✓' },
  sospesa:    { bg: '#f1f5f9', color: '#94a3b8', icon: '‖' },
}

const STATI_ORDINE = ['bozza', 'attivo', 'completato', 'sospeso']
const STATI_ORDINE_LABEL: Record<string, string> = {
  bozza: 'Bozza', attivo: 'In corso', completato: 'Completato', sospeso: 'Sospeso',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

const lbl: React.CSSProperties = {
  fontSize: 10, color: '#64748b', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 3,
}
const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a', background: 'white',
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

export default function DettaglioProgetto() {
  const params   = useParams()
  const id       = params.id as string
  const router   = useRouter()
  const supabase = createClient()

  const [progetto,   setProgetto]   = useState<any>(null)
  const [sals,       setSals]       = useState<SalRow[]>([])
  const [documenti,  setDocumenti]  = useState<any[]>([])
  const [attivita,   setAttivita]   = useState<{ nome: string; stato: string }[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  // Campi editabili importo
  const [importoNetto, setImportoNetto] = useState(0)
  const [cassaPerc,    setCassaPerc]    = useState(4)
  const [ivaPerc,      setIvaPerc]      = useState(22)
  const [ivaLabel,     setIvaLabel]     = useState('22% — standard')
  const [statoOrdine,  setStatoOrdine]  = useState('attivo')
  const [editImporti,  setEditImporti]  = useState(false)

  // Form SAL
  const [mostraFormSal, setMostraFormSal] = useState(false)
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
      const { data: s } = await supabase.from('sal').select('*').eq('progetto_id', id).order('numero')
      const { data: d } = await supabase.from('documenti').select('*').eq('progetto_id', id)

      if (!p) { router.push('/progetti'); return }

      setProgetto(p)
      setImportoNetto(p.importo_netto || 0)
      setCassaPerc(p.cassa_percentuale || 4)
      setIvaPerc(p.iva_percentuale || 22)
      const opt = IVA_OPTIONS.find(o => o.value === (p.iva_percentuale || 22))
      if (opt) setIvaLabel(opt.label)
      setStatoOrdine(p.stato || 'attivo')
      setSals((s || []).map((sal: any): SalRow => ({
        id: sal.id, numero: sal.numero, descrizione: sal.descrizione,
        percentuale: sal.percentuale, importo: sal.importo,
        data_prevista: sal.data_prevista || '', stato: sal.stato,
      })))
      setDocumenti(d || [])
      if (p?.servizi?.length) {
        setAttivita(p.servizi.map((nome: string) => ({ nome, stato: 'da_fare' })))
      }
      setLoading(false)
    }
    load()
  }, [id])

  // ── Calcoli (cassa solo per ingegneria) ──────────────────────────────────
  const isFornitura   = progetto?.tipo_servizio === 'fornitura_posa'
  const cassaEffettiva = isFornitura ? 0 : cassaPerc
  const importoCassa  = importoNetto * cassaEffettiva / 100
  const imponibile    = importoNetto + importoCassa
  const ivaImporto    = imponibile * ivaPerc / 100
  const totLordo      = imponibile + ivaImporto
  const percTotSal    = sals.reduce((acc, s) => acc + s.percentuale, 0)
  const salCompletati = sals.filter(s => ['fatturato', 'pagato'].includes(s.stato)).length
  const percAvanz     = sals.length > 0 ? (salCompletati / sals.length * 100) : 0
  const attCompletate = attivita.filter(a => a.stato === 'completata').length
  const percAtt       = attivita.length > 0 ? (attCompletate / attivita.length * 100) : 0

  // ── Azioni ───────────────────────────────────────────────────────────────
  async function salvaImporti() {
    setSaving(true)
    await supabase.from('progetti').update({
      importo_netto:     importoNetto,
      cassa_percentuale: isFornitura ? 0 : cassaPerc,
      iva_percentuale:   ivaPerc,
      stato:             statoOrdine,
    }).eq('id', id)
    setSaving(false)
    setSaved(true)
    setEditImporti(false)
    setTimeout(() => setSaved(false), 2500)
  }

  async function eliminaProgetto() {
    if (!confirm('Eliminare questo progetto?\nVerranno eliminati anche tutti i SAL.\nOperazione irreversibile.')) return
    await supabase.from('progetti').delete().eq('id', id)
    router.push('/progetti')
  }

  function aggiornaAttivita(idx: number, stato: string) {
    setAttivita(prev => prev.map((a, i) => i === idx ? { ...a, stato } : a))
  }

  async function aggiornaSalStato(salId: string, stato: string) {
    await supabase.from('sal').update({ stato }).eq('id', salId)
    setSals(prev => prev.map(s => s.id === salId ? { ...s, stato } : s))
  }

  async function eliminaSal(salId: string) {
    if (!confirm('Eliminare questo SAL?')) return
    await supabase.from('sal').delete().eq('id', salId)
    setSals(prev => prev.filter(s => s.id !== salId))
  }

  async function aggiungiSal() {
    if (!nuovoSal.descrizione?.trim()) return
    const numero     = sals.length > 0 ? Math.max(...sals.map(s => s.numero)) + 1 : 1
    const perc       = nuovoSal.percentuale || 0
    const importoSal = imponibile * perc / 100
    const { data, error } = await supabase.from('sal').insert({
      progetto_id:   id, numero, descrizione: nuovoSal.descrizione,
      percentuale:   perc, importo: importoSal,
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
      setMostraFormSal(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Caricamento...</div>

  const nomeCliente = progetto.clienti?.tipo_cliente === 'persona_fisica'
    ? `${progetto.clienti?.nome || ''} ${progetto.clienti?.cognome || ''}`.trim()
    : progetto.clienti?.ragione_sociale || 'Cliente'

  return (
    <>
      <Topbar
        title={nomeCliente}
        subtitle={`${progetto.numero_ordine} · ${isFornitura ? 'Fornitura e Posa' : 'Ingegneria'}`}
      />
      <div style={{ padding: '20px 24px' }}>

        {/* ── HEADER ── */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', background: '#dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: '#1d4ed8', flexShrink: 0,
            }}>
              {nomeCliente.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{nomeCliente}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {progetto.clienti?.portafogli?.nome && <span>{progetto.clienti.portafogli.nome} ·</span>}
                <span>{progetto.numero_offerta || progetto.numero_ordine}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
                  background: isFornitura ? '#fef3c7' : '#dbeafe',
                  color:      isFornitura ? '#92400e' : '#1d4ed8',
                }}>
                  {isFornitura ? 'Fornitura/Posa' : 'Ingegneria'}
                </span>
              </div>
              {progetto.servizi?.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {progetto.servizi.map((s: string) => (
                    <span key={s} style={{ fontSize: 10, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 20 }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => setEditImporti(v => !v)}
                style={{
                  padding: '7px 14px', borderRadius: 7,
                  border: `1px solid ${editImporti ? '#6ab04c' : '#e2e8f0'}`,
                  background: editImporti ? '#f0fdf4' : 'white',
                  color: editImporti ? '#166534' : '#475569',
                  fontSize: 11, cursor: 'pointer', fontWeight: 600,
                }}
              >
                {editImporti ? '✓ Chiudi' : '✏ Modifica'}
              </button>
              <button
                onClick={eliminaProgetto}
                style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', fontSize: 11, cursor: 'pointer' }}
              >
                🗑
              </button>
            </div>
          </div>

          {/* KPI importi — sempre visibili, editabili quando editImporti=true */}
          <div style={{ display: 'grid', gridTemplateColumns: isFornitura ? 'repeat(3,1fr)' : 'repeat(4,1fr)', gap: 10 }}>

            {/* Importo netto */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
              <div style={lbl}>Importo netto</div>
              {editImporti ? (
                <input
                  type="number" step="0.01" min={0}
                  value={importoNetto || ''}
                  onChange={e => setImportoNetto(parseFloat(e.target.value) || 0)}
                  style={{ ...inp, fontSize: 15, fontWeight: 700, padding: '4px 8px' }}
                />
              ) : (
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{fmt(importoNetto)}</div>
              )}
            </div>

            {/* Cassa — solo ingegneria */}
            {!isFornitura && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                <div style={lbl}>Cassa ingegneri {editImporti ? '' : `(${cassaPerc}%)`}</div>
                {editImporti ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number" min={0} max={10} step={0.5}
                      value={cassaPerc}
                      onChange={e => setCassaPerc(parseFloat(e.target.value) || 0)}
                      style={{ ...inp, width: 60, fontSize: 13, padding: '4px 8px' }}
                    />
                    <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>% = {fmt(importoCassa)}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{fmt(importoCassa)}</div>
                )}
              </div>
            )}

            {/* IVA */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
              <div style={lbl}>IVA {editImporti ? '' : `${ivaPerc}%`}</div>
              {editImporti ? (
                <select
                  value={ivaLabel}
                  onChange={e => {
                    const opt = IVA_OPTIONS.find(o => o.label === e.target.value)
                    setIvaLabel(e.target.value)
                    setIvaPerc(opt?.value ?? 0)
                  }}
                  style={{ ...inp, fontSize: 11, padding: '4px 8px' }}
                >
                  {IVA_OPTIONS.map(o => <option key={o.label}>{o.label}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{fmt(ivaImporto)}</div>
              )}
            </div>

            {/* Totale lordo */}
            <div style={{ background: editImporti ? '#f0fdf4' : '#f8fafc', border: editImporti ? '1px solid rgba(106,176,76,.3)' : 'none', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ ...lbl, color: '#166534' }}>Totale lordo</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6' }}>{fmt(totLordo)}</div>
            </div>
          </div>

          {/* Pannello edit esteso */}
          {editImporti && (
            <div style={{ marginTop: 12, padding: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={lbl}>Stato ordine</label>
                  <select style={{ ...inp, width: 140 }} value={statoOrdine} onChange={e => setStatoOrdine(e.target.value)}>
                    {STATI_ORDINE.map(s => <option key={s} value={s}>{STATI_ORDINE_LABEL[s]}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }} />
                {saved && <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>✓ Salvato!</span>}
                <button
                  onClick={salvaImporti}
                  disabled={saving}
                  style={{
                    padding: '8px 20px', borderRadius: 7, border: 'none',
                    background: saving ? '#94a3b8' : '#6ab04c',
                    color: 'white', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Salvataggio...' : '💾 Salva modifiche'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── DATI ORDINE ── */}
        <div style={{ background: 'white', borderRadius: '0 10px 10px 0', border: '1px solid #e5e5e2', borderLeft: '3px solid #6ab04c', padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Dati ordine</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'N° ordine',      value: progetto.numero_ordine,  mono: true },
              { label: 'N° offerta',     value: progetto.numero_offerta || '—', mono: true },
              { label: 'Data creazione', value: new Date(progetto.created_at).toLocaleDateString('it-IT') },
              { label: 'Tipo servizio',  value: isFornitura ? 'Fornitura/Posa' : 'Ingegneria' },
              { label: 'Portafoglio',    value: progetto.clienti?.portafogli?.nome || '—' },
              { label: 'Stato',          value: STATI_ORDINE_LABEL[progetto.stato] || progetto.stato || '—' },
            ].map(f => (
              <div key={f.label}>
                <div style={lbl}>{f.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, fontFamily: f.mono ? 'monospace' : undefined }}>{f.value}</div>
              </div>
            ))}
          </div>
          {progetto.note && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 11, color: '#64748b' }}>
              <strong>Note:</strong> {progetto.note}
            </div>
          )}
        </div>

        {/* ── COLONNE ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Attività */}
            {attivita.length > 0 && (
              <div style={{ background: 'white', borderRadius: '0 10px 10px 0', border: '1px solid #e5e5e2', borderLeft: '3px solid #6ab04c', padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Attività di ingegneria</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{attCompletate}/{attivita.length} completate</div>
                </div>
                <div style={{ height: 5, background: '#f1f5f9', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${percAtt}%`, background: '#6ab04c', borderRadius: 10, transition: 'width .4s' }} />
                </div>
                {attivita.map((att, idx) => {
                  const s = STATI_ATT_COLOR[att.stato]
                  return (
                    <div key={att.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: idx < attivita.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                        {s.icon}
                      </div>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{att.nome}</div>
                      <select value={att.stato} onChange={e => aggiornaAttivita(idx, e.target.value)}
                        style={{ fontSize: 10, padding: '3px 7px', borderRadius: 20, border: 'none', fontWeight: 600, cursor: 'pointer', background: s.bg, color: s.color, appearance: 'none' as any }}>
                        {STATI_ATT.map(st => <option key={st} value={st}>{STATI_ATT_LABEL[st]}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}

            {/* SAL */}
            <div style={{ background: 'white', borderRadius: '0 10px 10px 0', border: '1px solid #e5e5e2', borderLeft: '3px solid #3b82f6', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Piano di fatturazione (SAL)</div>
                  {sals.length > 0 && (
                    <div style={{ fontSize: 11, marginTop: 2, color: Math.abs(percTotSal - 100) < 0.01 ? '#166534' : '#92400e' }}>
                      {Math.abs(percTotSal - 100) < 0.01 ? `✓ 100% — ${fmt(imponibile)}` : `⚠ ${percTotSal}% su 100%`}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{salCompletati}/{sals.length} completati</div>
                  <button
                    onClick={() => setMostraFormSal(v => !v)}
                    style={{ padding: '5px 12px', borderRadius: 7, background: mostraFormSal ? '#f1f5f9' : '#3b82f6', color: mostraFormSal ? '#475569' : 'white', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {mostraFormSal ? '✕' : '+ SAL'}
                  </button>
                </div>
              </div>

              <div style={{ height: 5, background: '#f1f5f9', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${percAvanz}%`, background: '#3b82f6', borderRadius: 10, transition: 'width .5s' }} />
              </div>

              {/* Form aggiunta SAL */}
              {mostraFormSal && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 10 }}>
                    Nuovo SAL #{sals.length > 0 ? Math.max(...sals.map(s => s.numero)) + 1 : 1}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={lbl}>Descrizione</label>
                      <input style={inp} value={nuovoSal.descrizione || ''} onChange={e => setNuovoSal(p => ({ ...p, descrizione: e.target.value }))} placeholder="Es. Acconto alla firma..." autoFocus />
                    </div>
                    <div>
                      <label style={lbl}>Percentuale %</label>
                      <input style={inp} type="number" min={0} max={100} value={nuovoSal.percentuale || ''} onChange={e => setNuovoSal(p => ({ ...p, percentuale: parseFloat(e.target.value) || 0 }))} placeholder="30" />
                    </div>
                    <div>
                      <label style={lbl}>Data prevista</label>
                      <input style={inp} type="date" value={nuovoSal.data_prevista || ''} onChange={e => setNuovoSal(p => ({ ...p, data_prevista: e.target.value }))} />
                    </div>
                  </div>
                  {(nuovoSal.percentuale || 0) > 0 && imponibile > 0 && (
                    <div style={{ fontSize: 11, color: '#1d4ed8', marginBottom: 8 }}>
                      Importo: <strong>{fmt(imponibile * (nuovoSal.percentuale || 0) / 100)}</strong>
                      {percTotSal + (nuovoSal.percentuale || 0) > 100 && <span style={{ color: '#991b1b', marginLeft: 8 }}>⚠ Supera 100%</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={aggiungiSal} disabled={!nuovoSal.descrizione?.trim()} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: !nuovoSal.descrizione?.trim() ? '#94a3b8' : '#6ab04c', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✓ Aggiungi</button>
                    <button onClick={() => setMostraFormSal(false)} style={{ padding: '6px 10px', borderRadius: 6, background: 'white', color: '#475569', border: '1px solid #e2e8f0', fontSize: 11, cursor: 'pointer' }}>Annulla</button>
                  </div>
                </div>
              )}

              {/* Tabella SAL */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {['#', 'Descrizione', 'Data', 'Importo', 'Stato', ''].map(h => (
                      <th key={h} style={{ padding: '4px 6px', textAlign: 'left', fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sals.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 11 }}>
                      Nessun SAL — clicca "+ SAL" per aggiungerne uno
                    </td></tr>
                  )}
                  {sals.map(s => (
                    <tr key={s.id || s.numero} style={{ borderBottom: '1px solid #fafafa' }}>
                      <td style={{ padding: '8px 6px', color: '#64748b', fontFamily: 'monospace' }}>SAL {s.numero}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 500 }}>{s.descrizione}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b', fontSize: 11 }}>
                        {s.data_prevista ? new Date(s.data_prevista).toLocaleDateString('it-IT') : '—'}
                      </td>
                      <td style={{ padding: '8px 6px', fontWeight: 700, color: '#1e3a5f' }}>{fmt(s.importo)}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <select value={s.stato} onChange={e => s.id && aggiornaSalStato(s.id, e.target.value)}
                          style={{ fontSize: 10, padding: '3px 7px', borderRadius: 20, border: 'none', fontWeight: 600, cursor: 'pointer', background: STATI_SAL_COLOR[s.stato]?.bg || '#f1f5f9', color: STATI_SAL_COLOR[s.stato]?.color || '#475569', appearance: 'none' as any }}>
                          {STATI_SAL.map(st => <option key={st} value={st}>{STATI_SAL_LABEL[st]}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <button onClick={() => s.id && eliminaSal(s.id)} style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', fontSize: 10, cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── COLONNA DESTRA ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Documenti */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Documenti allegati</div>
              {documenti.length === 0 && <div style={{ fontSize: 11, color: '#94a3b8' }}>Nessun documento allegato</div>}
              {documenti.map(d => (
                <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#f8fafc', border: '1px solid #e5e5e2', borderRadius: 7, marginBottom: 5, textDecoration: 'none', color: '#334155' }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{d.nome}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{d.tipo}{d.dimensione ? ` · ${Math.round(d.dimensione / 1024)} KB` : ''}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#3b82f6' }}>↓</span>
                </a>
              ))}
            </div>

            {/* Dati cliente */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Dati cliente</div>
              {[
                ['Email',     progetto.clienti?.email],
                ['Telefono',  progetto.clienti?.telefono],
                ['PEC',       progetto.clienti?.pec],
                ['P.IVA',     progetto.clienti?.piva],
                ['CF',        progetto.clienti?.cf],
                ['SDI',       progetto.clienti?.sdi],
                ['Referente', progetto.clienti?.referente],
                ['Indirizzo', progetto.clienti?.indirizzo],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #fafafa', fontSize: 12 }}>
                  <span style={{ color: '#94a3b8', flexShrink: 0 }}>{label}</span>
                  <span style={{ color: '#334155', fontWeight: 500, textAlign: 'right', marginLeft: 8 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Link href="/ordini" style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, textDecoration: 'none' }}>← Tutti gli ordini</Link>
          <Link href="/progetti" style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, textDecoration: 'none' }}>← Tutti i progetti</Link>
          <Link href={`/pratiche/${params.id}`} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #1e3a5f', background: '#1e3a5f', color: 'white', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>📋 Apri Progetto</Link>
        </div>

      </div>
    </>
  )
}
