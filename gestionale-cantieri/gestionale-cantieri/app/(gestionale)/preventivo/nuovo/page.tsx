'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { useRouter } from 'next/navigation'
import type { Cliente, TipoServizio, TipoCliente } from '@/lib/types'

// ── Costanti ────────────────────────────────────────────────────────────────────

const IVA_OPTIONS = [
  { label: '22% — standard',        value: 22 },
  { label: '10% — fondi agricoli',  value: 10 },
  { label: '4% — agevolata',        value: 4  },
  { label: 'Esente art. 10',        value: 0  },
  { label: 'Fuori campo IVA',       value: 0  },
  { label: 'Reverse charge art. 17', value: 0 },
]

// Sezioni standard usate nel preventivo (voci per la form)
const SEZIONI_DEFAULT = [
  { label: 'A — Progettazione tecnica', voci: [
    'Rilievo topografico e sopralluogo tecnico preliminare',
    'Indagine geognostica e caratterizzazione geotecnica',
    'Progetto definitivo elettrico (schema unifilare, planimetrie, layout moduli)',
    'Progetto esecutivo lato DC e lato AC + cabina MT/BT',
    'Studio di producibilità energetica annua',
    'Calcolo ombreggiamenti, ottimizzazione inclinazione e orientamento',
    'Piano monitoraggio e sistema SCADA/datalogger',
    'Relazione tecnica generale + As-Built a fine lavori',
  ]},
  { label: 'B — Iter autorizzativo e pratiche amministrative', voci: [
    'Procedura Abilitativa Semplificata (PAS) art. 6 D.Lgs. 28/2011',
    'Richiesta connessione rete elettrica (STMG/STPG Terna/E-Distribuzione)',
    'Gestione iter connessione con gestore di rete',
    'Pratica SUAP / SUE presso il Comune competente',
    'Comunicazione D.M. 37/08 (ex Legge 46/90)',
    'Predisposizione documentazione GSE (Registro / Aste FER)',
    'Aggiornamento catastale post-intervento (DOCFA)',
  ]},
  { label: 'C — Preparazione cantiere', voci: [
    'Allestimento cantiere',
    'Sfalcio vegetazione, pulizia e livellamento area',
    'Recinzione perimetrale definitiva (n. 400 ml)',
    'Cancello/i di accesso',
    'Scavi e rinterri per cavidotti di cantiere e platea cabina MT/BT',
    'Sistema videosorveglianza perimetrale',
    'Impianto illuminazione perimetrale LED',
  ]},
  { label: 'D — Impianto FV — Lato DC', voci: [
    'Fornitura moduli fotovoltaici (monocristallini PERC/TOPCon)',
    'Fornitura e installazione strutture pali infissi a terra (acciaio zincato)',
    'Posa in opera moduli + collegamento seriale/parallelo stringhe',
    'Fornitura e installazione inverter di stringa/centralizzati',
    'Fornitura e posa cavo solare DC doppio isolamento',
    'Fornitura e installazione quadri di campo',
    'Fornitura e posa cavidotti interrati lato DC + pozzetti ispezione',
    'Movimentazione materiali in cantiere',
  ]},
  { label: 'E — Impianto FV — Lato AC e media tensione', voci: [
    'Getto platea calcestruzzo armato per cabina MT/BT',
    'Fornitura e posa cabina Enel/gestore prefabbricata (consegna MT)',
    'Fornitura e posa cabina utente MT/BT prefabbricata',
    'Fornitura e installazione trasformatore MT/BT',
    'Fornitura e installazione quadro protezione MT (QMT)',
    'Fornitura e installazione quadro bassa tensione (QBT)',
    'Fornitura e posa cavo AC + cavidotti interrati lato AC + pozzetti',
  ]},
  { label: 'F — Direzione lavori, sicurezza e collaudo', voci: [
    'Direzione Lavori (DL) per tutta la durata del cantiere',
    'Coordinamento Sicurezza in fase Progettazione (CSP) D.Lgs. 81/08',
    'Coordinamento Sicurezza in fase Esecuzione (CSE) D.Lgs. 81/08',
    'Redazione Piano di Sicurezza e Coordinamento (PSC)',
    'Redazione Piano Operativo di Sicurezza (POS)',
    'Collaudo finale impianto (Voc, Isc, IR, EL imaging)',
    'Redazione e consegna Dichiarazione di Conformità art. 7 D.M. 37/08',
    'Affiancamento prima registrazione GSE e attivazione ritiro dedicato',
    'N. 1 sopralluogo verifica post-installazione (entro 12 mesi)',
  ]},
]

// Dati default calcolatore fornitura_posa
const CALC_DEFS: {
  sezione: string
  voci: { desc: string; costo: number; margine: number }[]
}[] = [
  { sezione: 'A — Progettazione tecnica', voci: [
    { desc: 'Rilievo topografico e sopralluogo tecnico preliminare', costo: 8000, margine: 30 },
    { desc: 'Indagine geognostica e caratterizzazione geotecnica', costo: 5000, margine: 30 },
    { desc: 'Progetto definitivo elettrico (schema unifilare, planimetrie)', costo: 6000, margine: 30 },
    { desc: 'Progetto esecutivo lato DC/AC + cabina MT/BT', costo: 8000, margine: 30 },
    { desc: 'Studio producibilità energetica + calcolo ombreggiamenti', costo: 4000, margine: 30 },
    { desc: 'Piano monitoraggio SCADA + relazione tecnica + As-Built', costo: 5000, margine: 30 },
  ]},
  { sezione: 'B — Iter autorizzativo e pratiche amministrative', voci: [
    { desc: 'Procedura PAS (D.Lgs. 28/2011)', costo: 4000, margine: 30 },
    { desc: 'Richiesta connessione STMG/STPG Terna/E-Distribuzione', costo: 2000, margine: 30 },
    { desc: 'Gestione iter connessione con gestore di rete', costo: 2500, margine: 30 },
    { desc: 'Pratica SUAP / SUE Comune + comunicazione D.M. 37/08', costo: 2500, margine: 30 },
    { desc: 'Documentazione GSE (Registro / Aste FER) + DOCFA', costo: 2500, margine: 30 },
  ]},
  { sezione: 'C — Preparazione cantiere', voci: [
    { desc: 'Allestimento cantiere + sfalcio + livellamento area', costo: 5000, margine: 20 },
    { desc: 'Recinzione perimetrale (400 ml) + cancelli di accesso', costo: 21000, margine: 20 },
    { desc: 'Scavi e rinterri cavidotti cantiere + platea cabina', costo: 7000, margine: 18 },
    { desc: 'Sistema videosorveglianza perimetrale', costo: 12000, margine: 25 },
    { desc: 'Impianto illuminazione perimetrale LED', costo: 8000, margine: 25 },
  ]},
  { sezione: 'D — Impianto FV — Lato DC', voci: [
    { desc: 'Fornitura moduli FV (n. 1.440 pz, ~694 Wp/cad., TOPCon)', costo: 220000, margine: 15 },
    { desc: 'Strutture pali infissi acciaio zincato + infissione meccanica', costo: 80000, margine: 18 },
    { desc: 'Posa moduli + cablaggio stringhe DC', costo: 35000, margine: 20 },
    { desc: 'Inverter utility-scale (n. 3 unità, garanzia 5 anni)', costo: 45000, margine: 18 },
    { desc: 'Cavo solare DC (1.000 ml) + quadri di campo (n. 20 pz)', costo: 20000, margine: 16 },
    { desc: 'Cavidotti interrati lato DC (400 ml) + pozzetti (n. 20)', costo: 10000, margine: 15 },
    { desc: 'Movimentazione materiali in cantiere', costo: 5000, margine: 15 },
  ]},
  { sezione: 'E — Impianto FV — Lato AC e media tensione', voci: [
    { desc: 'Platea calcestruzzo armato + cabine MT prefabbricate', costo: 40000, margine: 18 },
    { desc: 'Trasformatore MT/BT (garanzia 2 anni)', costo: 40000, margine: 18 },
    { desc: 'Quadro protezione MT (QMT) + quadro BT (QBT)', costo: 22000, margine: 18 },
    { desc: 'Cavo AC (500 ml) + cavidotti AC (200 ml) + pozzetti', costo: 10500, margine: 18 },
  ]},
  { sezione: 'F — Direzione lavori, sicurezza e collaudo', voci: [
    { desc: 'Direzione Lavori (DL)', costo: 18000, margine: 30 },
    { desc: 'CSP + CSE ai sensi D.Lgs. 81/08', costo: 8000, margine: 30 },
    { desc: 'Redazione PSC e POS', costo: 4000, margine: 30 },
    { desc: 'Collaudo finale impianto (Voc, Isc, IR, EL imaging)', costo: 6000, margine: 30 },
    { desc: 'D.M. 37/08 + GSE + sopralluogo 12 mesi', costo: 4000, margine: 30 },
  ]},
  { sezione: 'Manodopera e oneri accessori', voci: [
    { desc: 'Manodopera installazione moduli fotovoltaici', costo: 25000, margine: 15 },
    { desc: 'Manodopera impianti elettrici lato DC e AC', costo: 18000, margine: 15 },
    { desc: 'Manodopera opere civili (scavi, platee, pozzetti)', costo: 12000, margine: 15 },
    { desc: 'Noleggio mezzi meccanici e attrezzature specialistiche', costo: 8000, margine: 12 },
    { desc: 'Oneri di sicurezza (DPI, segnaletica, recinzioni cantiere)', costo: 5000, margine: 20 },
  ]},
]

// ── Tipi locali ──────────────────────────────────────────────────────────────────

type Voce    = { sezione: string; descrizione: string; importo: number }
type Tranche = { descrizione: string; percentuale: number }
type CalcRow = { id: string; sezione: string; desc: string; costo: number; margine: number }

// ── Stili comuni ─────────────────────────────────────────────────────────────────

const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a', background: 'white' }
const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

// ── Componente ────────────────────────────────────────────────────────────────────

export default function NuovoPreventivoPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [step,    setStep]    = useState<0 | 1 | 2>(0)   // 0=tipo, 1=calc(fornitura)/form, 2=form
  const [loading, setLoading] = useState(false)

  // Step 0
  const [tipoServizio, setTipoServizio] = useState<TipoServizio | null>(null)
  const [tipoCliente,  setTipoCliente]  = useState<TipoCliente | null>(null)

  // ── Calcolatore (solo fornitura_posa) ─────────────────────────────────────────
  const [datiImpianto, setDatiImpianto] = useState({
    kwp: 1000, nModuli: 1440, wpModulo: 694,
    tecnologia: 'TOPCon monocristallino', nInverter: 3,
    struttura: 'Pali infissi a terra',
  })
  const [calcRows, setCalcRows] = useState<CalcRow[]>(() =>
    CALC_DEFS.flatMap(s => s.voci.map((v, i) => ({
      id: `${s.sezione}-${i}`, sezione: s.sezione,
      desc: v.desc, costo: v.costo, margine: v.margine,
    })))
  )

  const calcTotaleRicavo = calcRows.reduce((acc, r) => {
    const ric = r.margine < 100 ? r.costo / (1 - r.margine / 100) : r.costo
    return acc + ric
  }, 0)
  const calcTotaleCosto = calcRows.reduce((a, r) => a + r.costo, 0)
  const calcMargine     = calcTotaleRicavo - calcTotaleCosto
  const calcMarginePerc = calcTotaleRicavo > 0 ? (calcMargine / calcTotaleRicavo * 100) : 0

  function updateCalcRow(id: string, field: 'desc' | 'costo' | 'margine', val: string | number) {
    setCalcRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r))
  }
  function deleteCalcRow(id: string) { setCalcRows(prev => prev.filter(r => r.id !== id)) }
  function addCalcRow(sezione: string) {
    const newId = `${sezione}-new-${Date.now()}`
    setCalcRows(prev => [...prev, { id: newId, sezione, desc: '', costo: 0, margine: 20 }])
  }

  // Applica calcolatore → popola voci preventivo (importo = ricavo, non mostrato al cliente)
  function applicaCalcolatore() {
    const nuoveVoci: Voce[] = calcRows
      .filter(r => r.desc.trim())
      .map(r => {
        const ricavo = r.margine < 100 ? r.costo / (1 - r.margine / 100) : r.costo
        return { sezione: r.sezione, descrizione: r.desc, importo: ricavo }
      })
    setVoci(nuoveVoci)
    setOggetto(oggetto || `Offerta "Chiavi in Mano" — Impianto FV da ${datiImpianto.kwp} kWp (${datiImpianto.nModuli} moduli ${datiImpianto.wpModulo} Wp, ${datiImpianto.tecnologia})`)
    setStep(2)
    window.scrollTo(0, 0)
  }

  // ── Form preventivo ──────────────────────────────────────────────────────────
  const [numeroOfferta,  setNumeroOfferta]  = useState('')
  const [dataEmissione,  setDataEmissione]  = useState(new Date().toISOString().slice(0, 10))
  const [validitaGiorni, setValiditaGiorni] = useState(20)
  const [statoPreventivo, setStatoPreventivo] = useState('bozza')

  const [clienti,           setClienti]           = useState<Cliente[]>([])
  const [clienteFiltro,     setClienteFiltro]     = useState('')
  const [ddAperto,          setDdAperto]          = useState(false)
  const [clienteSelezionato, setClienteSelezionato] = useState<Cliente | null>(null)

  const [oggetto, setOggetto] = useState('')
  const [note,    setNote]    = useState('')
  const [voci,    setVoci]    = useState<Voce[]>([])
  const [ivaLabel, setIvaLabel] = useState('22% — standard')
  const [ivaPerc,  setIvaPerc]  = useState(22)
  const [tranche, setTranche] = useState<Tranche[]>([
    { descrizione: "All'accettazione del preventivo", percentuale: 30 },
    { descrizione: 'Consegna materiali in cantiere',  percentuale: 30 },
    { descrizione: 'Fine installazione e collaudo',   percentuale: 30 },
    { descrizione: 'Attivazione impianto + D.M. 37/08', percentuale: 10 },
  ])

  const totaleImponibile = voci.reduce((acc, v) => acc + v.importo, 0)
  const ivaImporto       = totaleImponibile * ivaPerc / 100
  const totaleLordo      = totaleImponibile + ivaImporto
  const percTot          = tranche.reduce((acc, t) => acc + t.percentuale, 0)

  useEffect(() => {
    supabase.from('clienti').select('*, portafogli(nome)').order('ragione_sociale').then(({ data }) => {
      setClienti((data as Cliente[]) || [])
    })
    supabase.from('preventivi').select('numero_offerta').order('created_at', { ascending: false }).limit(1).then(({ data }) => {
      const anno = new Date().getFullYear()
      if (data && data.length > 0) {
        const last  = data[0].numero_offerta
        const match = last.match(/(\d+)$/)
        const num   = match ? parseInt(match[1]) + 1 : 1
        setNumeroOfferta(`OFF-${anno}-${String(num).padStart(3, '0')}`)
      } else {
        setNumeroOfferta(`OFF-${anno}-001`)
      }
    })
    // Voci default per ingegneria (vuote)
    const vociFlatDefault: Voce[] = SEZIONI_DEFAULT.flatMap(s =>
      s.voci.map(v => ({ sezione: s.label, descrizione: v, importo: 0 }))
    )
    setVoci(vociFlatDefault)
  }, [])

  function procedi() {
    if (!tipoServizio || !tipoCliente) return
    if (tipoServizio === 'fornitura_posa') {
      setStep(1)  // vai al calcolatore
    } else {
      setStep(2)  // vai direttamente al form
    }
    window.scrollTo(0, 0)
  }

  function updateVoce(idx: number, field: 'descrizione' | 'importo', val: string | number) {
    setVoci(prev => prev.map((v, i) => i === idx ? { ...v, [field]: val } : v))
  }
  function deleteVoce(idx: number) { setVoci(prev => prev.filter((_, i) => i !== idx)) }
  function addVoce(sezione: string) { setVoci(prev => [...prev, { sezione, descrizione: '', importo: 0 }]) }
  function updateTranche(idx: number, field: 'descrizione' | 'percentuale', val: string | number) {
    setTranche(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t))
  }

  async function salva() {
    setLoading(true)
    try {
      const { data: prev, error } = await supabase.from('preventivi').insert({
        numero_offerta:  numeroOfferta,
        data_emissione:  dataEmissione,
        validita_giorni: validitaGiorni,
        stato:           statoPreventivo,
        cliente_id:      clienteSelezionato?.id || null,
        oggetto:         oggetto || null,
        tipo_servizio:   tipoServizio,
        tipo_cliente:    tipoCliente,
        iva_percentuale: tipoCliente === 'privato' ? ivaPerc : null,
        note:            note || null,
      }).select().single()

      if (error || !prev) throw error

      const vociDaInserire = voci
        .filter(v => v.descrizione.trim())
        .map((v, i) => ({ preventivo_id: prev.id, sezione: v.sezione, descrizione: v.descrizione, importo: v.importo, ordine: i }))
      if (vociDaInserire.length > 0) {
        await supabase.from('preventivo_voci').insert(vociDaInserire)
      }

      const trancheDaInserire = tranche.map((t, i) => ({
        preventivo_id: prev.id, descrizione: t.descrizione, percentuale: t.percentuale, ordine: i,
      }))
      await supabase.from('preventivo_tranche').insert(trancheDaInserire)

      router.push(`/preventivo/${prev.id}`)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  const clientiFiltrati = clienti.filter(c =>
    !clienteFiltro || c.ragione_sociale.toLowerCase().includes(clienteFiltro.toLowerCase()) || c.piva?.includes(clienteFiltro)
  )
  const sezioniUniche = [...new Set(voci.map(v => v.sezione))]

  const STATI_STYLE: Record<string, { bg: string; color: string }> = {
    bozza:     { bg: '#f1f5f9', color: '#475569' },
    inviato:   { bg: '#dbeafe', color: '#1d4ed8' },
    in_attesa: { bg: '#fef3c7', color: '#92400e' },
    accettato: { bg: '#dcfce7', color: '#166534' },
    rifiutato: { bg: '#fee2e2', color: '#991b1b' },
    scaduto:   { bg: '#f1f5f9', color: '#94a3b8' },
  }
  const statoStyle = STATI_STYLE[statoPreventivo] || STATI_STYLE.bozza

  // Sezioni uniche del calcolatore
  const calcSezioni = [...new Set(calcRows.map(r => r.sezione))]

  // ── Render ────────────────────────────────────────────────────────────────────

  const subtitleMap: Record<number, string> = {
    0: 'Scegli tipo servizio e tipo cliente',
    1: 'Inserisci dati impianto, costi e margini',
    2: `${tipoServizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura/Posa'} · ${tipoCliente === 'privato' ? 'Privato' : tipoCliente === 'ente' ? 'Ente pubblico' : 'Altro soggetto'}`,
  }

  // Steps indicator
  const isFornitura = tipoServizio === 'fornitura_posa'
  const steps = isFornitura
    ? ['Tipo servizio', 'Dati impianto e costi', 'Preventivo']
    : ['Tipo servizio', 'Preventivo']

  function StepBar() {
    const currentStep = step
    const displayStep = isFornitura ? currentStep : currentStep === 2 ? 1 : currentStep
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', border: '1.5px solid',
                borderColor: i < displayStep ? '#6ab04c' : i === displayStep ? '#1e3a5f' : '#e2e8f0',
                background: i < displayStep ? '#6ab04c' : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                color: i < displayStep ? 'white' : i === displayStep ? '#1e3a5f' : '#94a3b8',
              }}>
                {i < displayStep ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: i === displayStep ? 600 : 400, color: i === displayStep ? '#1e3a5f' : '#94a3b8' }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ width: 32, height: 1, background: '#e2e8f0' }} />}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <Topbar title="Nuovo preventivo" subtitle={subtitleMap[step]} />
      <div style={{ padding: '20px 24px', maxWidth: 900, margin: '0 auto' }}>
        <StepBar />

        {/* ════════════ STEP 0 — TIPO SERVIZIO / CLIENTE ════════════ */}
        {step === 0 && (
          <div>
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Tipo di servizio</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {([
                  ['ingegneria',     '📐', 'Servizi di ingegneria',      'Progettazione, DL, collaudo, perizie, autorizzazioni'],
                  ['fornitura_posa', '⚡', 'Fornitura e posa in opera',  'Fornitura materiali + installazione impianti'],
                ] as const).map(([val, icon, label, sub]) => (
                  <div key={val} onClick={() => setTipoServizio(val)} style={{
                    border: tipoServizio === val ? '2px solid #6ab04c' : '2px solid #e2e8f0',
                    background: tipoServizio === val ? '#f0fdf4' : 'white',
                    borderRadius: 10, padding: 18, cursor: 'pointer', textAlign: 'center',
                    boxShadow: tipoServizio === val ? '0 0 0 3px rgba(106,176,76,.15)' : 'none',
                    transition: 'all .15s',
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Tipo di cliente</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {([
                  ['privato', '👤', 'Privato',                'Persona fisica o società privata — IVA in evidenza'],
                  ['ente',    '🏛️', 'Ente pubblico / Comune', 'Comuni, Province, Regioni, PA'],
                  ['altro',   '🏢', 'Altro soggetto',         'Studi tecnici, cooperative, enti privati'],
                ] as const).map(([val, icon, label, sub]) => (
                  <div key={val} onClick={() => setTipoCliente(val)} style={{
                    border: tipoCliente === val ? '2px solid #6ab04c' : '2px solid #e2e8f0',
                    background: tipoCliente === val ? '#f0fdf4' : 'white',
                    borderRadius: 10, padding: 18, cursor: 'pointer', textAlign: 'center',
                    boxShadow: tipoCliente === val ? '0 0 0 3px rgba(106,176,76,.15)' : 'none',
                    transition: 'all .15s',
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => router.push('/preventivi')} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, cursor: 'pointer' }}>Annulla</button>
              <button onClick={procedi} disabled={!tipoServizio || !tipoCliente} style={{
                padding: '8px 16px', borderRadius: 7, border: 'none',
                background: tipoServizio && tipoCliente ? '#6ab04c' : '#e2e8f0',
                color: tipoServizio && tipoCliente ? 'white' : '#94a3b8',
                fontSize: 12, fontWeight: 600, cursor: tipoServizio && tipoCliente ? 'pointer' : 'not-allowed',
              }}>
                Procedi →
              </button>
            </div>
          </div>
        )}

        {/* ════════════ STEP 1 — CALCOLATORE (solo fornitura_posa) ════════════ */}
        {step === 1 && (
          <div>
            {/* Dati impianto */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #6ab04c' }}>Dati impianto</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 10 }}>
                <div><label style={lbl}>Potenza totale (kWp)</label><input style={inp} type="number" value={datiImpianto.kwp} onChange={e => setDatiImpianto(d => ({ ...d, kwp: +e.target.value }))} /></div>
                <div><label style={lbl}>N° moduli</label><input style={inp} type="number" value={datiImpianto.nModuli} onChange={e => setDatiImpianto(d => ({ ...d, nModuli: +e.target.value }))} /></div>
                <div><label style={lbl}>Wp / modulo</label><input style={inp} type="number" value={datiImpianto.wpModulo} onChange={e => setDatiImpianto(d => ({ ...d, wpModulo: +e.target.value }))} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Tecnologia moduli</label>
                  <select style={inp} value={datiImpianto.tecnologia} onChange={e => setDatiImpianto(d => ({ ...d, tecnologia: e.target.value }))}>
                    <option>TOPCon monocristallino</option><option>PERC monocristallino</option><option>HJT</option>
                  </select>
                </div>
                <div><label style={lbl}>N° inverter</label><input style={inp} type="number" value={datiImpianto.nInverter} onChange={e => setDatiImpianto(d => ({ ...d, nInverter: +e.target.value }))} /></div>
                <div><label style={lbl}>Tipo struttura</label>
                  <select style={inp} value={datiImpianto.struttura} onChange={e => setDatiImpianto(d => ({ ...d, struttura: e.target.value }))}>
                    <option>Pali infissi a terra</option><option>Groundmount fissi</option><option>Tracker monoasse</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Calcolatore costi/margini */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, paddingBottom: 8, borderBottom: '2px solid #6ab04c', display: 'flex', justifyContent: 'space-between' }}>
                <span>Costi e margine per sezione</span>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>Costo = acquisto/subappalto · Margine % → Ricavo</span>
              </div>

              {/* Header colonne */}
              <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 110px 70px 110px 28px', gap: 6, padding: '8px 2px 6px', borderBottom: '1px solid #e2e8f0' }}>
                {['Voce', 'Costo (€)', 'Marg. %', 'Ricavo (€)', ''].map((h, i) => (
                  <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', textAlign: i > 0 && i < 4 ? 'right' : 'left' as any }}>{h}</span>
                ))}
              </div>

              {calcSezioni.map(sezione => {
                const rows = calcRows.filter(r => r.sezione === sezione)
                const isManodopera = sezione.toLowerCase().includes('manodopera')
                return (
                  <div key={sezione}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: isManodopera ? '#7b5800' : '#1e3a5f',
                      background: isManodopera ? '#fff8e1' : '#eef4ff',
                      borderLeft: `3px solid ${isManodopera ? '#f9a825' : '#6ab04c'}`,
                      padding: '5px 10px', margin: '10px 0 3px', borderRadius: '0 5px 5px 0',
                    }}>{sezione}</div>

                    {rows.map(r => {
                      const ric = r.margine < 100 ? r.costo / (1 - r.margine / 100) : r.costo
                      return (
                        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2.2fr 110px 70px 110px 28px', gap: 6, alignItems: 'center', padding: '4px 2px', borderBottom: '0.5px solid #f5f5f5' }}>
                          <input value={r.desc} onChange={e => updateCalcRow(r.id, 'desc', e.target.value)} placeholder="Descrizione..." style={{ border: '0.5px solid #e2e8f0', borderRadius: 5, padding: '4px 7px', fontSize: 11, width: '100%' }} />
                          <input type="number" value={r.costo} min={0} step={100} onChange={e => updateCalcRow(r.id, 'costo', +e.target.value)} style={{ border: '0.5px solid #e2e8f0', borderRadius: 5, padding: '4px 6px', fontSize: 11, width: '100%', textAlign: 'right' }} />
                          <input type="number" value={r.margine} min={0} max={99} step={1} onChange={e => updateCalcRow(r.id, 'margine', +e.target.value)} style={{ border: '0.5px solid #e2e8f0', borderRadius: 5, padding: '4px 6px', fontSize: 11, width: '100%', textAlign: 'right' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', textAlign: 'right' }}>{fmt(ric)}</span>
                          <button onClick={() => deleteCalcRow(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 14 }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#e53')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
                          >×</button>
                        </div>
                      )
                    })}
                    <span onClick={() => addCalcRow(sezione)} style={{ fontSize: 11, color: '#6ab04c', cursor: 'pointer', fontWeight: 500, display: 'inline-block', marginTop: 3 }}>+ aggiungi voce</span>
                  </div>
                )
              })}

              {/* Totale calcolatore */}
              <div style={{ background: '#f0fdf4', border: '1.5px solid #6ab04c', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '.04em' }}>Totale imponibile offerta</div>
                  <div style={{ fontSize: 10, color: '#166534', marginTop: 2 }}>IVA esclusa</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#166534' }}>{fmt(calcTotaleRicavo)}</div>
              </div>
              {/* Statistiche */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', background: '#f8fafc', borderRadius: 6, padding: '8px 14px', marginTop: 6 }}>
                {[
                  { l: 'Totale costi', v: fmt(calcTotaleCosto) },
                  { l: 'Totale ricavi', v: fmt(calcTotaleRicavo) },
                  { l: 'Margine lordo', v: fmt(calcMargine), green: true },
                  { l: 'Margine %', v: `${calcMarginePerc.toFixed(1)}%`, green: true },
                  { l: '€ / kWp', v: datiImpianto.kwp > 0 ? fmt(calcTotaleRicavo / datiImpianto.kwp).replace(' €', '') + ' €/kWp' : '—' },
                ].map(s => (
                  <div key={s.l} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.l}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: s.green ? '#166534' : '#0f172a' }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(0)} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, cursor: 'pointer' }}>← Indietro</button>
              <button onClick={applicaCalcolatore} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#6ab04c', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Applica al preventivo →
              </button>
            </div>
          </div>
        )}

        {/* ════════════ STEP 2 — FORM PREVENTIVO ════════════ */}
        {step === 2 && (
          <div>
            {/* Badge selezione */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: tipoServizio === 'ingegneria' ? '#dbeafe' : '#fff3e0', color: tipoServizio === 'ingegneria' ? '#1d4ed8' : '#92400e' }}>
                {tipoServizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura e posa'}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: tipoCliente === 'privato' ? '#dcfce7' : '#f1f5f9', color: tipoCliente === 'privato' ? '#166534' : '#475569' }}>
                {tipoCliente === 'privato' ? 'Privato' : tipoCliente === 'ente' ? 'Ente pubblico' : 'Altro soggetto'}
              </span>
              <button onClick={() => setStep(0)} style={{ fontSize: 11, color: '#6ab04c', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cambia selezione</button>
              {isFornitura && (
                <button onClick={() => setStep(1)} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>← Modifica costi</button>
              )}
            </div>

            {/* Intestazione */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Intestazione offerta</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>N° offerta</label><input style={inp} value={numeroOfferta} onChange={e => setNumeroOfferta(e.target.value)} /></div>
                <div><label style={lbl}>Data emissione</label><input style={inp} type="date" value={dataEmissione} onChange={e => setDataEmissione(e.target.value)} /></div>
                <div><label style={lbl}>Validità (giorni)</label><input style={inp} type="number" value={validitaGiorni} onChange={e => setValiditaGiorni(+e.target.value)} min={1} /></div>
                <div>
                  <label style={lbl}>Stato</label>
                  <select style={{ ...inp, borderColor: statoStyle.color }} value={statoPreventivo} onChange={e => setStatoPreventivo(e.target.value)}>
                    <option value="bozza">Bozza</option><option value="inviato">Inviato</option>
                    <option value="in_attesa">In attesa</option><option value="accettato">Accettato</option>
                    <option value="rifiutato">Rifiutato</option><option value="scaduto">Scaduto</option>
                  </select>
                  <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: statoStyle.bg, color: statoStyle.color }}>
                    {statoPreventivo.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Cliente */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12, position: 'relative' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Cliente destinatario</div>
              <label style={lbl}>Cerca cliente</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={inp}
                  value={clienteSelezionato ? clienteSelezionato.ragione_sociale : clienteFiltro}
                  placeholder="Scrivi nome o P.IVA per cercare..."
                  onChange={e => { setClienteFiltro(e.target.value); setClienteSelezionato(null); setDdAperto(true) }}
                  onFocus={() => setDdAperto(true)}
                  onBlur={() => setTimeout(() => setDdAperto(false), 180)}
                />
                {ddAperto && clientiFiltrati.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, zIndex: 99, boxShadow: '0 4px 16px rgba(0,0,0,.08)', maxHeight: 200, overflowY: 'auto' }}>
                    {clientiFiltrati.map(c => (
                      <div key={c.id} onMouseDown={() => { setClienteSelezionato(c); setDdAperto(false) }}
                        style={{ padding: '9px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        <div style={{ fontWeight: 600 }}>{c.ragione_sociale}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{c.piva} · {(c as any).portafogli?.nome}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {clienteSelezionato && (
                <div style={{ marginTop: 8, background: '#f0fdf4', border: '1px solid rgba(106,176,76,.3)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#166534' }}>
                  ✓ <strong>{clienteSelezionato.ragione_sociale}</strong> — P.IVA: {clienteSelezionato.piva}
                  <button onClick={() => { setClienteSelezionato(null); setClienteFiltro('') }} style={{ marginLeft: 8, fontSize: 10, color: '#991b1b', background: 'none', border: 'none', cursor: 'pointer' }}>✕ rimuovi</button>
                </div>
              )}
            </div>

            {/* Oggetto */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <label style={lbl}>Oggetto offerta</label>
              <input style={inp} value={oggetto} onChange={e => setOggetto(e.target.value)} placeholder='Es. Offerta Economica "Chiavi in Mano" — Impianto Fotovoltaico da 1 MWp' />
            </div>

            {/* Voci */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', borderLeft: '3px solid #6ab04c', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Voci di preventivo</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
                {isFornitura
                  ? 'I costi interni non appaiono nel documento — nel Word viene mostrato solo il totale complessivo.'
                  : 'Modifica descrizioni · aggiungi o elimina voci · nel documento esportato appare solo il totale.'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 30px', gap: 6, padding: '6px 0', borderBottom: '1px solid #f1f5f9', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Descrizione</span>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'right' }}>
                  {isFornitura ? 'Ricavo (interno)' : 'Importo €'}
                </span>
                <span />
              </div>

              {sezioniUniche.map(sez => (
                <div key={sez}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '7px 12px', borderRadius: 8, margin: '14px 0 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{sez}</span>
                    <button onClick={() => addVoce(sez)} style={{ fontSize: 10, fontWeight: 600, color: '#6ab04c', background: 'transparent', border: '1px solid #6ab04c', borderRadius: 20, padding: '2px 10px', cursor: 'pointer' }}>+ aggiungi voce</button>
                  </div>
                  {voci.map((v, idx) => v.sezione !== sez ? null : (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 30px', gap: 6, marginBottom: 5, alignItems: 'center' }}>
                      <input value={v.descrizione} onChange={e => updateVoce(idx, 'descrizione', e.target.value)} placeholder="Descrizione voce..." style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11 }} />
                      <input type="number" value={v.importo || ''} onChange={e => updateVoce(idx, 'importo', parseFloat(e.target.value) || 0)} placeholder="0,00"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, textAlign: 'right', color: isFornitura ? '#94a3b8' : '#0f172a' }}
                        readOnly={isFornitura}
                      />
                      <button onClick={() => deleteVoce(idx)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; (e.currentTarget as HTMLElement).style.color = '#991b1b' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
                      >×</button>
                    </div>
                  ))}
                </div>
              ))}

              <div style={{ background: '#f0fdf4', border: '1px solid rgba(106,176,76,.3)', borderRadius: 8, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>Totale imponibile</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>IVA esclusa{isFornitura ? ' · il totale viene riportato nel documento' : ''}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f' }}>{fmt(totaleImponibile)}</div>
              </div>
            </div>

            {/* IVA — solo privati */}
            {tipoCliente === 'privato' && (
              <div style={{ background: 'white', borderRadius: '0 10px 10px 0', border: '1px solid #e5e5e2', borderLeft: '3px solid #3b82f6', padding: 18, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  IVA applicabile
                  <span style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Solo per privati</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={lbl}>Aliquota IVA</label>
                    <select style={inp} value={ivaLabel} onChange={e => {
                      const opt = IVA_OPTIONS.find(o => o.label === e.target.value)
                      setIvaLabel(e.target.value); setIvaPerc(opt?.value ?? 0)
                    }}>
                      {IVA_OPTIONS.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                    </select>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={lbl}>Imponibile</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f' }}>{fmt(totaleImponibile)}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={lbl}>IVA</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#475569' }}>{fmt(ivaImporto)}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid rgba(106,176,76,.3)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ ...lbl, color: '#166534' }}>Totale con IVA</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#166534' }}>{fmt(totaleLordo)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Tranche */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Condizioni di pagamento</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px', gap: 8, marginBottom: 8 }}>
                {['Descrizione tranche', '%', 'Importo calcolato'].map(h => (
                  <span key={h} style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</span>
                ))}
              </div>
              {tranche.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px', gap: 8, marginBottom: 7, alignItems: 'center' }}>
                  <input style={{ ...inp, padding: '6px 8px' }} value={t.descrizione} onChange={e => updateTranche(i, 'descrizione', e.target.value)} />
                  <input style={{ ...inp, padding: '6px 8px' }} type="number" value={t.percentuale} onChange={e => updateTranche(i, 'percentuale', parseFloat(e.target.value) || 0)} min={0} max={100} />
                  <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: 13 }}>{fmt(totaleImponibile * t.percentuale / 100)}</span>
                </div>
              ))}
              {Math.abs(percTot - 100) > 0.01 && (
                <div style={{ fontSize: 11, color: '#991b1b', marginTop: 6, padding: '6px 10px', background: '#fee2e2', borderRadius: 6 }}>
                  ⚠ Le percentuali sommano {percTot}% — devono fare 100%
                </div>
              )}
            </div>

            {/* Note */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <label style={lbl}>Note aggiuntive (opzionali)</label>
              <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Condizioni particolari, esclusioni, note al cliente..." />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(isFornitura ? 1 : 0)} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, cursor: 'pointer' }}>← Indietro</button>
              <button onClick={() => router.push('/preventivi')} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, cursor: 'pointer' }}>Annulla</button>
              <button onClick={salva} disabled={loading} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: loading ? '#94a3b8' : '#6ab04c', color: 'white', fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Salvataggio...' : '✓ Salva preventivo'}
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
