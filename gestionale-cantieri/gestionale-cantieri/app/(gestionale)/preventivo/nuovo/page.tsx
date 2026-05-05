'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { useRouter } from 'next/navigation'
import type { Cliente, TipoServizio, TipoCliente, TipologiaImpianto } from '@/lib/types'
import { TIPOLOGIA_LABELS } from '@/lib/types'

// ── Costanti ─────────────────────────────────────────────────────────────────

const IVA_OPTIONS = [
  { label: '22% — standard',         value: 22 },
  { label: '10% — fondi agricoli',   value: 10 },
  { label: '4% — agevolata',         value: 4  },
  { label: 'Esente art. 10',         value: 0  },
  { label: 'Fuori campo IVA',        value: 0  },
  { label: 'Reverse charge art. 17', value: 0  },
]

// Voci preventivo default per ingegneria
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
  { label: 'C — Direzione lavori, sicurezza e collaudo', voci: [
    'Direzione Lavori (DL) per tutta la durata del cantiere',
    'Coordinamento Sicurezza in fase Progettazione (CSP) D.Lgs. 81/08',
    'Coordinamento Sicurezza in fase Esecuzione (CSE) D.Lgs. 81/08',
    'Collaudo finale impianto (Voc, Isc, IR, EL imaging)',
    'Redazione e consegna Dichiarazione di Conformità art. 7 D.M. 37/08',
    'Affiancamento prima registrazione GSE e attivazione ritiro dedicato',
  ]},
]

// Badge colori per tipologia impianto
const TIPOLOGIA_BADGE: Record<TipologiaImpianto, React.CSSProperties> = {
  lt_11kw:     { background: '#e6f1fb', color: '#185fa5' },
  bt_11_20kw:  { background: '#eeedfe', color: '#534ab7' },
  bt_20_100kw: { background: '#faeeda', color: '#854f0b' },
  gt_100kw:    { background: '#f0f9ea', color: '#3b6d11' },
}

// ── Tipi locali ───────────────────────────────────────────────────────────────

type Voce    = { sezione: string; descrizione: string; importo: number }
type Tranche = { descrizione: string; percentuale: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

const N   = (v: string | number) => parseFloat(String(v).replace(',', '.')) || 0
const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
const fmtE0 = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

// ── Stili comuni ──────────────────────────────────────────────────────────────

const lbl: React.CSSProperties = {
  fontSize: 10, color: '#64748b', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4,
}
const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a', background: 'white',
}
const inpAuto: React.CSSProperties = { ...inp, background: '#f8fafc', color: '#64748b', cursor: 'default' }
const inpNum: React.CSSProperties  = { ...inp, textAlign: 'right' }
const card: React.CSSProperties    = { background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }
const cardGreen: React.CSSProperties = { ...card, borderLeft: '3px solid #6ab04c' }

// ── Componente principale ─────────────────────────────────────────────────────

export default function NuovoPreventivoPage() {
  const router   = useRouter()
  const supabase = createClient()

  // 0 = tipo servizio/cliente  |  1 = calcolatore FV (solo fornitura)  |  2 = form preventivo
  const [step,    setStep]    = useState<0 | 1 | 2>(0)
  const [loading, setLoading] = useState(false)
  const [errore,  setErrore]  = useState<string | null>(null)

  // ── Step 0 ───────────────────────────────────────────────────────────────────
  const [tipoServizio,      setTipoServizio]      = useState<TipoServizio | null>(null)
  const [tipoCliente,       setTipoCliente]       = useState<TipoCliente  | null>(null)
  const [tipologiaImpianto, setTipologiaImpianto] = useState<TipologiaImpianto | null>(null)
  const [errTipologia,      setErrTipologia]      = useState(false)

  // ── Step 1 — Calcolatore FV (Excel-based) ────────────────────────────────────

  // Dati impianto
  const [fvPannelli,      setFvPannelli]      = useState('')
  const [fvWPannello,     setFvWPannello]      = useState('')
  const [fvCostoPannello, setFvCostoPannello]  = useState('')
  const [fvMarca,         setFvMarca]          = useState('')

  // Inverter di stringa (1÷4)
  const [fvInv1, setFvInv1] = useState('')
  const [fvInv2, setFvInv2] = useState('')
  const [fvInv3, setFvInv3] = useState('')
  const [fvInv4, setFvInv4] = useState('')

  // Inverter ibrido (1÷4)
  const [fvIh1, setFvIh1] = useState('')
  const [fvIh2, setFvIh2] = useState('')
  const [fvIh3, setFvIh3] = useState('')
  const [fvIh4, setFvIh4] = useState('')

  // Accumulo
  const [fvAccKwh,  setFvAccKwh]  = useState('')
  const [fvAccSist, setFvAccSist] = useState('')
  const [fvAccBms,  setFvAccBms]  = useState('')
  const [fvAccRack, setFvAccRack] = useState('')

  // Varie, installazione e allaccio
  const [fvTrasp,   setFvTrasp]   = useState('')
  const [fvStrutt,  setFvStrutt]  = useState('')
  const [fvOtt,     setFvOtt]     = useState('')
  const [fvCab,     setFvCab]     = useState('')
  const [fvInstFv,  setFvInstFv]  = useState('')
  const [fvInstAcc, setFvInstAcc] = useState('')
  const [fvLv,      setFvLv]      = useState('')
  const [fvNoli,    setFvNoli]    = useState('')
  const [fvTrasf,   setFvTrasf]   = useState('')
  const [fvInterf,  setFvInterf]  = useState('')

  // Commissioni
  const [fvIntPerc,  setFvIntPerc]  = useState('')
  const [fvCommPerc, setFvCommPerc] = useState('')

  // Prezzo di vendita
  const [fvPriceMode, setFvPriceMode] = useState<'kwp' | 'tot'>('kwp')
  const [fvEuKwp,     setFvEuKwp]     = useState('')
  const [fvPrezzoDir, setFvPrezzoDir] = useState('')

  // ── Valori calcolati (useMemo per performance) ────────────────────────────────

  const fvKwp = useMemo(
    () => N(fvPannelli) * N(fvWPannello) / 1000,
    [fvPannelli, fvWPannello],
  )
  const fvPannFv = useMemo(
    () => N(fvPannelli) * N(fvCostoPannello),
    [fvPannelli, fvCostoPannello],
  )
  const fvRaee = useMemo(() => 2.5 * N(fvPannelli), [fvPannelli])

  const fvPrezzo = useMemo(
    () => fvPriceMode === 'kwp' ? fvKwp * N(fvEuKwp) : N(fvPrezzoDir),
    [fvPriceMode, fvKwp, fvEuKwp, fvPrezzoDir],
  )
  const fvEuKwpCalc = useMemo(
    () => (fvKwp > 0 ? fvPrezzo / fvKwp : 0),
    [fvPrezzo, fvKwp],
  )

  const fvCostiBase = useMemo(() =>
    fvPannFv +
    N(fvInv1) + N(fvInv2) + N(fvInv3) + N(fvInv4) +
    N(fvIh1)  + N(fvIh2)  + N(fvIh3)  + N(fvIh4)  +
    N(fvAccSist) + N(fvAccBms) + N(fvAccRack) +
    N(fvTrasp) + fvRaee + N(fvStrutt) + N(fvOtt) +
    N(fvCab) + N(fvInstFv) + N(fvInstAcc) +
    N(fvLv) + N(fvNoli) + N(fvTrasf) + N(fvInterf),
    [fvPannFv, fvInv1, fvInv2, fvInv3, fvInv4, fvIh1, fvIh2, fvIh3, fvIh4,
     fvAccSist, fvAccBms, fvAccRack, fvTrasp, fvRaee, fvStrutt, fvOtt,
     fvCab, fvInstFv, fvInstAcc, fvLv, fvNoli, fvTrasf, fvInterf],
  )
  const fvMarInt  = useMemo(() => fvPrezzo * N(fvIntPerc)  / 100, [fvPrezzo, fvIntPerc])
  const fvMarComm = useMemo(() => fvPrezzo * N(fvCommPerc) / 100, [fvPrezzo, fvCommPerc])
  const fvTotSpese = useMemo(() => fvCostiBase + fvMarInt + fvMarComm, [fvCostiBase, fvMarInt, fvMarComm])
  const fvMol      = useMemo(() => fvPrezzo - fvTotSpese, [fvPrezzo, fvTotSpese])
  const fvMolPerc  = useMemo(() => fvPrezzo > 0 ? fvMol / fvPrezzo : 0, [fvMol, fvPrezzo])

  // ── Step 2 — Form preventivo ─────────────────────────────────────────────────

  const [numeroOfferta,   setNumeroOfferta]   = useState('')
  const [dataEmissione,   setDataEmissione]   = useState(new Date().toISOString().slice(0, 10))
  const [validitaGiorni,  setValiditaGiorni]  = useState(20)
  const [statoPreventivo, setStatoPreventivo] = useState('bozza')

  const [clienti,             setClienti]             = useState<Cliente[]>([])
  const [clienteFiltro,       setClienteFiltro]       = useState('')
  const [ddAperto,            setDdAperto]            = useState(false)
  const [clienteSelezionato,  setClienteSelezionato]  = useState<Cliente | null>(null)

  const [oggetto,   setOggetto]   = useState('')
  const [note,      setNote]      = useState('')
  const [voci,      setVoci]      = useState<Voce[]>([])
  const [ivaLabel,  setIvaLabel]  = useState('22% — standard')
  const [ivaPerc,   setIvaPerc]   = useState(22)
  const [cassaPerc, setCassaPerc] = useState(4)
  const [tranche,   setTranche]   = useState<Tranche[]>([
    { descrizione: "All'accettazione del preventivo", percentuale: 30 },
    { descrizione: 'Consegna materiali in cantiere',  percentuale: 30 },
    { descrizione: 'Fine installazione e collaudo',   percentuale: 30 },
    { descrizione: 'Attivazione impianto + D.M. 37/08', percentuale: 10 },
  ])

  const isIngegneria     = tipoServizio === 'ingegneria'
  const totaleImponibile = voci.reduce((acc, v) => acc + v.importo, 0)
  const importoCassa     = isIngegneria ? totaleImponibile * cassaPerc / 100 : 0
  const totaleConCassa   = totaleImponibile + importoCassa
  const ivaImporto       = totaleConCassa * ivaPerc / 100
  const totaleLordo      = totaleConCassa + ivaImporto
  const percTot          = tranche.reduce((acc, t) => acc + t.percentuale, 0)

  // ── useEffect ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('clienti')
      .select('*, portafogli(nome)')
      .order('ragione_sociale')
      .then(({ data }) => setClienti((data as Cliente[]) || []))

    supabase
      .from('preventivi')
      .select('numero_offerta')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
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
  }, [])

  // ── Funzioni ──────────────────────────────────────────────────────────────────

  function procedi() {
    if (!tipoServizio || !tipoCliente) return

    // Validazione tipologia impianto (obbligatoria per fornitura_posa)
    if (tipoServizio === 'fornitura_posa' && !tipologiaImpianto) {
      setErrTipologia(true)
      const el = document.getElementById('box-tipologia')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setErrTipologia(false)

    if (tipoServizio === 'fornitura_posa') {
      setStep(1)
    } else {
      // Ingegneria: popola voci default vuote
      const vociFlatDefault: Voce[] = SEZIONI_DEFAULT.flatMap(s =>
        s.voci.map(v => ({ sezione: s.label, descrizione: v, importo: 0 })),
      )
      setVoci(vociFlatDefault)
      setStep(2)
    }
    window.scrollTo(0, 0)
  }

  /** Traduce il calcolatore FV in voci preventivo con importi proporzionali al prezzo */
  function applicaCalcolatore() {
    if (fvPrezzo <= 0) {
      alert('Inserisci il prezzo di vendita prima di procedere.')
      return
    }

    // Raggruppamenti proporzionali
    const gruppi = [
      {
        sezione: 'Fornitura impianto fotovoltaico',
        descrizione: `Fornitura e posa in opera impianto FV da ${fvKwp.toFixed(2)} kWp — ${N(fvPannelli).toFixed(0)} moduli ${N(fvWPannello)} Wp${fvMarca ? ' ' + fvMarca : ''}`,
        costo: fvPannFv + N(fvInv1) + N(fvInv2) + N(fvInv3) + N(fvInv4) + N(fvIh1) + N(fvIh2) + N(fvIh3) + N(fvIh4),
      },
      {
        sezione: 'Accumulo energetico',
        descrizione: `Sistema di accumulo${N(fvAccKwh) > 0 ? ` da ${N(fvAccKwh)} kWh` : ''} — BMS, rack e accessori`,
        costo: N(fvAccSist) + N(fvAccBms) + N(fvAccRack),
      },
      {
        sezione: 'Opere civili e installazione',
        descrizione: 'Strutture portanti, cabina MT/BT, installazione impianto, linea vita',
        costo: N(fvStrutt) + N(fvOtt) + N(fvCab) + N(fvInstFv) + N(fvInstAcc) + N(fvLv),
      },
      {
        sezione: 'Allaccio, pratiche e varie',
        descrizione: 'Interfaccia di rete, allaccio gestore, trasporto, noli, RAEE',
        costo: N(fvInterf) + N(fvTrasp) + N(fvNoli) + N(fvTrasf) + fvRaee,
      },
    ].filter(g => g.costo > 0)

    const totaleCosto = gruppi.reduce((a, g) => a + g.costo, 0)

    let nuoveVoci: Voce[]
    if (totaleCosto > 0) {
      nuoveVoci = gruppi.map(g => ({
        sezione:     g.sezione,
        descrizione: g.descrizione,
        importo:     Math.round(g.costo / totaleCosto * fvPrezzo),
      }))
      // Correzione arrotondamento sull'ultima voce
      const diff = fvPrezzo - nuoveVoci.reduce((a, v) => a + v.importo, 0)
      if (nuoveVoci.length > 0) nuoveVoci[nuoveVoci.length - 1].importo += diff
    } else {
      // Nessun costo inserito → voce unica con il prezzo totale
      nuoveVoci = [{
        sezione:     'Fornitura e posa in opera',
        descrizione: `Impianto fotovoltaico chiavi in mano da ${fvKwp.toFixed(2)} kWp`,
        importo:     fvPrezzo,
      }]
    }

    setVoci(nuoveVoci)
    setOggetto(
      oggetto ||
      `Offerta "Chiavi in Mano" — Impianto Fotovoltaico da ${fvKwp.toFixed(2)} kWp ` +
      `(${N(fvPannelli).toFixed(0)} moduli ${N(fvWPannello)} Wp${fvMarca ? ', ' + fvMarca : ''})`,
    )
    setStep(2)
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
    setErrore(null)
    try {
      const { data: prev, error } = await supabase.from('preventivi').insert({
        numero_offerta:     numeroOfferta,
        data_emissione:     dataEmissione,
        validita_giorni:    validitaGiorni,
        stato:              statoPreventivo,
        cliente_id:         clienteSelezionato?.id || null,
        oggetto:            oggetto || null,
        tipo_servizio:      tipoServizio,
        tipo_cliente:       tipoCliente,
        tipologia_impianto: tipologiaImpianto || null,   // ← NUOVO
        iva_percentuale:    tipoCliente === 'privato' ? ivaPerc : null,
        cassa_percentuale:  isIngegneria ? cassaPerc : 0,
        note:               note || null,
      }).select().single()

      if (error || !prev) throw error

      const vociDaInserire = voci
        .filter(v => v.descrizione.trim())
        .map((v, i) => ({
          preventivo_id: prev.id,
          sezione:       v.sezione,
          descrizione:   v.descrizione,
          importo:       v.importo,
          ordine:        i,
        }))
      if (vociDaInserire.length > 0) {
        await supabase.from('preventivo_voci').insert(vociDaInserire)
      }

      const trancheDaInserire = tranche.map((t, i) => ({
        preventivo_id: prev.id,
        descrizione:   t.descrizione,
        percentuale:   t.percentuale,
        ordine:        i,
      }))
      await supabase.from('preventivo_tranche').insert(trancheDaInserire)

      router.push(`/preventivo/${prev.id}`)
    } catch (e: any) {
      console.error(e)
      setErrore(e?.message || 'Errore durante il salvataggio. Controlla che tutte le colonne esistano nel database.')
      setLoading(false)
    }
  }

  // ── Dati derivati per la UI ────────────────────────────────────────────────────

  const isFornitura       = tipoServizio === 'fornitura_posa'
  const clientiFiltrati   = clienti.filter(c =>
    !clienteFiltro ||
    c.ragione_sociale.toLowerCase().includes(clienteFiltro.toLowerCase()) ||
    c.piva?.includes(clienteFiltro),
  )
  const sezioniUniche     = [...new Set(voci.map(v => v.sezione))]
  const STATI_STYLE: Record<string, { bg: string; color: string }> = {
    bozza:     { bg: '#f1f5f9', color: '#475569' },
    inviato:   { bg: '#dbeafe', color: '#1d4ed8' },
    in_attesa: { bg: '#fef3c7', color: '#92400e' },
    accettato: { bg: '#dcfce7', color: '#166534' },
    rifiutato: { bg: '#fee2e2', color: '#991b1b' },
    scaduto:   { bg: '#f1f5f9', color: '#94a3b8' },
  }
  const statoStyle = STATI_STYLE[statoPreventivo] || STATI_STYLE.bozza

  const steps      = isFornitura
    ? ['Tipo servizio', 'Dati impianto e costi', 'Preventivo']
    : ['Tipo servizio', 'Preventivo']
  const displayStep = isFornitura ? step : step === 2 ? 1 : step

  // ── Render ─────────────────────────────────────────────────────────────────────

  const subtitleMap: Record<number, string> = {
    0: 'Scegli tipo servizio e tipo cliente',
    1: 'Inserisci dati impianto, costi e prezzo di vendita',
    2: `${isFornitura ? 'Fornitura/Posa' : 'Ingegneria'} · ${
      tipoCliente === 'privato' ? 'Privato' : tipoCliente === 'ente' ? 'Ente pubblico' : 'Altro soggetto'
    }`,
  }

  return (
    <>
      <Topbar title="Nuovo preventivo" subtitle={subtitleMap[step]} />
      <div style={{ padding: '20px 24px', maxWidth: 900, margin: '0 auto' }}>

        {/* Steps bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              {i < steps.length - 1 && <div style={{ width: 32, height: 1, background: '#e2e8f0' }} />}
            </div>
          ))}
        </div>

        {/* ══════════════ STEP 0 — TIPO SERVIZIO / CLIENTE ══════════════ */}
        {step === 0 && (
          <div>
            {/* Tipo servizio */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Tipo di servizio</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {([
                  ['ingegneria',     '📐', 'Servizi di ingegneria',     'Progettazione, DL, collaudo, perizie, autorizzazioni'],
                  ['fornitura_posa', '⚡', 'Fornitura e posa in opera', 'Fornitura materiali + installazione impianti'],
                ] as const).map(([val, icon, label, sub]) => (
                  <div key={val} onClick={() => { setTipoServizio(val); if (val === 'ingegneria') setTipologiaImpianto(null) }} style={{
                    border: tipoServizio === val ? '2px solid #6ab04c' : '2px solid #e2e8f0',
                    background: tipoServizio === val ? '#f0fdf4' : 'white',
                    borderRadius: 10, padding: 18, cursor: 'pointer', textAlign: 'center',
                    boxShadow: tipoServizio === val ? '0 0 0 3px rgba(106,176,76,.12)' : 'none',
                    transition: 'all .15s',
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tipo cliente */}
            <div style={card}>
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
                    boxShadow: tipoCliente === val ? '0 0 0 3px rgba(106,176,76,.12)' : 'none',
                    transition: 'all .15s',
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── TIPOLOGIA IMPIANTO — visibile solo per fornitura_posa ── */}
            {tipoServizio === 'fornitura_posa' && (
              <div id="box-tipologia" style={{
                ...card,
                border: errTipologia ? '2px solid #f87171' : '1px solid rgba(106,176,76,.4)',
                background: '#fafff6',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Tipologia di impianto</div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#166534' }}>
                    obbligatoria
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>
                  Seleziona la fascia di potenza nominale — determina il modello di computo metrico nel documento Word esportato
                </div>

                {(Object.entries(TIPOLOGIA_LABELS) as [TipologiaImpianto, typeof TIPOLOGIA_LABELS[TipologiaImpianto]][]).map(([val, info]) => (
                  <div
                    key={val}
                    onClick={() => { setTipologiaImpianto(val); setErrTipologia(false) }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                      border: tipologiaImpianto === val ? '2px solid #6ab04c' : '1.5px solid #e2e8f0',
                      background: tipologiaImpianto === val ? '#f0fdf4' : 'white',
                      boxShadow: tipologiaImpianto === val ? '0 0 0 3px rgba(106,176,76,.1)' : 'none',
                      transition: 'all .15s',
                    }}
                  >
                    {/* Checkbox simulata */}
                    <div style={{
                      width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2,
                      border: tipologiaImpianto === val ? '2px solid #6ab04c' : '2px solid #d1d5db',
                      background: tipologiaImpianto === val ? '#6ab04c' : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {tipologiaImpianto === val && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        {info.label}
                        <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 12, fontWeight: 500, ...TIPOLOGIA_BADGE[val] }}>
                          {info.range}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{info.note}</div>
                    </div>
                  </div>
                ))}

                {errTipologia && (
                  <div style={{ fontSize: 11, color: '#991b1b', marginTop: 8, padding: '6px 10px', background: '#fee2e2', borderRadius: 6 }}>
                    ⚠ Seleziona la tipologia di impianto per procedere
                  </div>
                )}
              </div>
            )}

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

        {/* ══════════════ STEP 1 — CALCOLATORE FV (Excel-based) ══════════════ */}
        {step === 1 && (
          <div>

            {/* Badge tipologia selezionata */}
            {tipologiaImpianto && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid rgba(106,176,76,.3)' }}>
                <span style={{ fontSize: 11, color: '#166534' }}>
                  Modello computo metrico:
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, ...TIPOLOGIA_BADGE[tipologiaImpianto] }}>
                  {TIPOLOGIA_LABELS[tipologiaImpianto].label} — {TIPOLOGIA_LABELS[tipologiaImpianto].range}
                </span>
                <button onClick={() => setStep(0)} style={{ fontSize: 10, color: '#6ab04c', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginLeft: 'auto' }}>
                  Cambia tipologia
                </button>
              </div>
            )}

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'kWp totali', value: fvKwp > 0 ? fvKwp.toFixed(2) + ' kWp' : '—' },
                { label: 'Totale spese', value: fvTotSpese > 0 ? fmtE0(fvTotSpese) : '—' },
                { label: 'Prezzo vendita', value: fvPrezzo > 0 ? fmtE0(fvPrezzo) : '—' },
                {
                  label: 'MOL Athena',
                  value: fvPrezzo > 0 ? `${fmtE0(fvMol)} (${(fvMolPerc * 100).toFixed(1)}%)` : '—',
                  color: fvMol >= 0 ? '#16a34a' : '#dc2626',
                },
              ].map(k => (
                <div key={k.label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: k.color || '#1e3a5f' }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* ── Dati impianto ── */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #6ab04c' }}>Dati impianto</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={lbl}>N° pannelli</label>
                  <input style={inp} value={fvPannelli} onChange={e => setFvPannelli(e.target.value)} placeholder="es. 588" />
                </div>
                <div>
                  <label style={lbl}>Potenza pannello (W)</label>
                  <input style={inp} value={fvWPannello} onChange={e => setFvWPannello(e.target.value)} placeholder="es. 505" />
                </div>
                <div>
                  <label style={lbl}>Costo unitario pannello (€)</label>
                  <input style={inpNum} value={fvCostoPannello} onChange={e => setFvCostoPannello(e.target.value)} placeholder="es. 129" />
                </div>
                <div>
                  <label style={lbl}>kWp totali (auto)</label>
                  <input style={inpAuto} readOnly value={fvKwp > 0 ? fvKwp.toFixed(2) + ' kWp' : ''} />
                </div>
              </div>
              <div>
                <label style={lbl}>Marca / fornitore pannelli</label>
                <input style={inp} value={fvMarca} onChange={e => setFvMarca(e.target.value)} placeholder="es. Jinko Solar, LONGi, REC, Q CELLS..." />
              </div>
            </div>

            {/* ── Fornitura fotovoltaico ── */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #6ab04c' }}>Fornitura fotovoltaico</div>

              {/* Pannelli FV — AUTO */}
              <VoceRow label="Pannelli fotovoltaici" valore={fvPannFv} auto />

              <div style={{ height: 1, background: '#f1f5f9', margin: '10px 0' }} />
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Inverter di stringa (1÷4)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Inverter 1 (€)', v: fvInv1, s: setFvInv1 },
                  { label: 'Inverter 2 (€)', v: fvInv2, s: setFvInv2 },
                  { label: 'Inverter 3 (€)', v: fvInv3, s: setFvInv3 },
                  { label: 'Inverter 4 (€)', v: fvInv4, s: setFvInv4 },
                ].map(x => (
                  <div key={x.label}>
                    <label style={lbl}>{x.label}</label>
                    <input style={inpNum} value={x.v} onChange={e => x.s(e.target.value)} placeholder="0" />
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Inverter ibrido (1÷4)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Ibrido 1 (€)', v: fvIh1, s: setFvIh1 },
                  { label: 'Ibrido 2 (€)', v: fvIh2, s: setFvIh2 },
                  { label: 'Ibrido 3 (€)', v: fvIh3, s: setFvIh3 },
                  { label: 'Ibrido 4 (€)', v: fvIh4, s: setFvIh4 },
                ].map(x => (
                  <div key={x.label}>
                    <label style={lbl}>{x.label}</label>
                    <input style={inpNum} value={x.v} onChange={e => x.s(e.target.value)} placeholder="0" />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Accumulo ── */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #6ab04c' }}>Accumulo</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Capacità (kWh)',        v: fvAccKwh,  s: setFvAccKwh,  note: true },
                  { label: 'Sistema accumulo (€)',   v: fvAccSist, s: setFvAccSist },
                  { label: 'BMS + accessori (€)',    v: fvAccBms,  s: setFvAccBms },
                  { label: 'Rack batterie (€)',       v: fvAccRack, s: setFvAccRack },
                ].map(x => (
                  <div key={x.label}>
                    <label style={lbl}>{x.label}</label>
                    <input style={x.note ? inp : inpNum} value={x.v} onChange={e => x.s(e.target.value)} placeholder="0" />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Varie, installazione e allaccio ── */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #6ab04c' }}>Varie, installazione e allaccio</div>

              <VoceRow label="Contributo RAEE (auto — 2,50 € × n° pannelli)" valore={fvRaee} auto />

              {[
                { label: 'Trasporto (€)',                               v: fvTrasp,   s: setFvTrasp },
                { label: 'Strutture con inseguitori (€)',               v: fvStrutt,  s: setFvStrutt },
                { label: 'Ottimizzatori — installazione + mat. el. (€)', v: fvOtt,    s: setFvOtt },
                { label: 'Cabina di trasformazione MT/BT (€)',          v: fvCab,     s: setFvCab },
                { label: 'Installazione impianto fotovoltaico (€)',     v: fvInstFv,  s: setFvInstFv },
                { label: 'Installazione accumulo (€)',                  v: fvInstAcc, s: setFvInstAcc },
                { label: 'Linea vita (€)',                              v: fvLv,      s: setFvLv },
                { label: 'Noli (€)',                                    v: fvNoli,    s: setFvNoli },
                { label: 'Trasferta (€)',                               v: fvTrasf,   s: setFvTrasf },
                { label: 'Interfaccia di rete — impianti > 11,08 kW (€)', v: fvInterf, s: setFvInterf },
              ].map(x => (
                <VoceRow key={x.label} label={x.label} value={x.v} onChange={x.s} />
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>Totale costi diretti:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>{fmtE0(fvCostiBase)}</span>
              </div>
            </div>

            {/* ── Commissioni ── */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Commissioni (% sul prezzo di vendita)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Intermediario (%)</label>
                  <input style={inpNum} value={fvIntPerc} onChange={e => setFvIntPerc(e.target.value)} placeholder="0" />
                  {fvMarInt > 0 && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>⇒ {fmtE0(fvMarInt)} sul prezzo di vendita</div>}
                </div>
                <div>
                  <label style={lbl}>Commerciale (%)</label>
                  <input style={inpNum} value={fvCommPerc} onChange={e => setFvCommPerc(e.target.value)} placeholder="0" />
                  {fvMarComm > 0 && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>⇒ {fmtE0(fvMarComm)} sul prezzo di vendita</div>}
                </div>
              </div>
            </div>

            {/* ── Prezzo di vendita ── */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>Prezzo di vendita — importo chiavi in mano</div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: '#334155' }}>
                  <input type="radio" name="priceMode" checked={fvPriceMode === 'kwp'} onChange={() => setFvPriceMode('kwp')} style={{ accentColor: '#3b82f6' }} />
                  Inserisci €/kWp
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: '#334155' }}>
                  <input type="radio" name="priceMode" checked={fvPriceMode === 'tot'} onChange={() => setFvPriceMode('tot')} style={{ accentColor: '#3b82f6' }} />
                  Inserisci importo totale
                </label>
              </div>
              {fvPriceMode === 'kwp' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Costo unitario al kWp (€/kWp)</label>
                    <input style={{ ...inpNum, borderColor: '#3b82f6' }} value={fvEuKwp} onChange={e => setFvEuKwp(e.target.value)} placeholder="es. 1400" />
                  </div>
                  <div>
                    <label style={lbl}>Costo impianto chiavi in mano (auto)</label>
                    <input style={inpAuto} readOnly value={fvPrezzo > 0 ? fmtE0(fvPrezzo) : ''} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Costo impianto chiavi in mano (€)</label>
                    <input style={{ ...inpNum, borderColor: '#3b82f6' }} value={fvPrezzoDir} onChange={e => setFvPrezzoDir(e.target.value)} placeholder="es. 250000" />
                  </div>
                  <div>
                    <label style={lbl}>€/kWp equivalente (auto)</label>
                    <input style={inpAuto} readOnly value={fvKwp > 0 && fvPrezzo > 0 ? fvEuKwpCalc.toFixed(0) + ' €/kWp' : ''} />
                  </div>
                </div>
              )}
            </div>

            {/* ── Grand total MOL ── */}
            <div style={{ background: '#1e3a5f', borderRadius: 10, padding: '14px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 14 }}>
              {[
                { label: 'Totale spese', value: fmtE0(fvTotSpese) },
                { label: 'Prezzo vendita', value: fmtE0(fvPrezzo) },
                {
                  label: 'MOL Athena',
                  value: `${fmtE0(fvMol)}  (${(fvMolPerc * 100).toFixed(1)}%)`,
                  color: fvMol >= 0 ? '#4ade80' : '#f87171',
                  icon: fvMol >= 0 ? '✓' : '⚠',
                },
              ].map(k => (
                <div key={k.label}>
                  <div style={{ fontSize: 9, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: k.color || 'white' }}>
                    {k.value} {k.icon}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(0)} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, cursor: 'pointer' }}>← Indietro</button>
              <button
                onClick={applicaCalcolatore}
                disabled={fvPrezzo <= 0}
                style={{
                  padding: '8px 20px', borderRadius: 7, border: 'none',
                  background: fvPrezzo > 0 ? '#6ab04c' : '#e2e8f0',
                  color: fvPrezzo > 0 ? 'white' : '#94a3b8',
                  fontSize: 12, fontWeight: 600,
                  cursor: fvPrezzo > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Applica al preventivo →
              </button>
            </div>
          </div>
        )}

        {/* ══════════════ STEP 2 — FORM PREVENTIVO ══════════════ */}
        {step === 2 && (
          <div>
            {/* Badge */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: isFornitura ? '#fff3e0' : '#dbeafe', color: isFornitura ? '#92400e' : '#1d4ed8' }}>
                {isFornitura ? 'Fornitura e posa' : 'Ingegneria'}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: tipoCliente === 'privato' ? '#dcfce7' : '#f1f5f9', color: tipoCliente === 'privato' ? '#166534' : '#475569' }}>
                {tipoCliente === 'privato' ? 'Privato' : tipoCliente === 'ente' ? 'Ente pubblico' : 'Altro soggetto'}
              </span>
              {tipologiaImpianto && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, ...TIPOLOGIA_BADGE[tipologiaImpianto] }}>
                  {TIPOLOGIA_LABELS[tipologiaImpianto].label} · {TIPOLOGIA_LABELS[tipologiaImpianto].range}
                </span>
              )}
              <button onClick={() => setStep(0)} style={{ fontSize: 11, color: '#6ab04c', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cambia selezione</button>
              {isFornitura && (
                <button onClick={() => setStep(1)} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>← Modifica costi</button>
              )}
            </div>

            {/* Intestazione */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Intestazione offerta</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>N° offerta</label>
                  <input style={inp} value={numeroOfferta} onChange={e => setNumeroOfferta(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Data emissione</label>
                  <input style={inp} type="date" value={dataEmissione} onChange={e => setDataEmissione(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Validità (giorni)</label>
                  <input style={inp} type="number" value={validitaGiorni} onChange={e => setValiditaGiorni(+e.target.value)} min={1} />
                </div>
                <div>
                  <label style={lbl}>Stato</label>
                  <select style={{ ...inp, borderColor: statoStyle.color }} value={statoPreventivo} onChange={e => setStatoPreventivo(e.target.value)}>
                    <option value="bozza">Bozza</option>
                    <option value="inviato">Inviato</option>
                    <option value="in_attesa">In attesa</option>
                    <option value="accettato">Accettato</option>
                    <option value="rifiutato">Rifiutato</option>
                    <option value="scaduto">Scaduto</option>
                  </select>
                  <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: statoStyle.bg, color: statoStyle.color }}>
                    {statoPreventivo.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Cliente */}
            <div style={{ ...card, position: 'relative' }}>
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
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
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
            <div style={card}>
              <label style={lbl}>Oggetto offerta</label>
              <input style={inp} value={oggetto} onChange={e => setOggetto(e.target.value)} placeholder='Es. Offerta Economica "Chiavi in Mano" — Impianto Fotovoltaico da 1 MWp' />
            </div>

            {/* Voci */}
            <div style={cardGreen}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Voci di preventivo</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
                {isFornitura
                  ? 'I costi interni non appaiono nel documento — nel Word viene mostrato solo il totale complessivo.'
                  : 'Modifica descrizioni · aggiungi o elimina voci · nel documento esportato appaiono importo e totale.'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 30px', gap: 6, padding: '6px 0', borderBottom: '1px solid #f1f5f9', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Descrizione</span>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'right' }}>
                  {isFornitura ? 'Importo (interno)' : 'Importo €'}
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
                      <input
                        type="number"
                        value={v.importo || ''}
                        onChange={e => updateVoce(idx, 'importo', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        readOnly={isFornitura}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, textAlign: 'right', background: isFornitura ? '#f8fafc' : 'white', color: isFornitura ? '#94a3b8' : '#0f172a' }}
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

            {/* Cassa ingegneri (solo ingegneria) + IVA (solo privati) */}
            {(isIngegneria || tipoCliente === 'privato') && (
              <div style={{ ...card, borderLeft: '3px solid #3b82f6', borderRadius: '0 10px 10px 0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Riepilogo importi
                </div>

                {/* Cassa — solo ingegneria */}
                {isIngegneria && (
                  <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f0fdf4', border: '1px solid rgba(106,176,76,.25)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 10 }}>
                      Cassa Ingegneri
                      <span style={{ fontSize: 10, fontWeight: 500, color: '#166534', marginLeft: 8 }}>
                        applicata su imponibile
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
                      <div>
                        <label style={lbl}>Percentuale cassa %</label>
                        <input
                          style={inp}
                          type="number" min={0} max={10} step={0.5}
                          value={cassaPerc}
                          onChange={e => setCassaPerc(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={lbl}>Imponibile voci</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>{fmt(totaleImponibile)}</div>
                      </div>
                      <div style={{ background: 'white', border: '1px solid #d1fae5', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={lbl}>Cassa ({cassaPerc}%)</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>{fmt(importoCassa)}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Imponibile + Cassa =</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#1e3a5f' }}>{fmt(totaleConCassa)}</span>
                    </div>
                  </div>
                )}

                {/* IVA — solo privati */}
                {tipoCliente === 'privato' && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      IVA applicabile
                      <span style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Solo per privati</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
                      <div>
                        <label style={lbl}>Aliquota IVA</label>
                        <select style={inp} value={ivaLabel} onChange={e => {
                          const opt = IVA_OPTIONS.find(o => o.label === e.target.value)
                          setIvaLabel(e.target.value)
                          setIvaPerc(opt?.value ?? 0)
                        }}>
                          {IVA_OPTIONS.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                        </select>
                      </div>
                      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={lbl}>{isIngegneria ? 'Impon. + Cassa' : 'Imponibile'}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>{fmt(totaleConCassa)}</div>
                      </div>
                      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={lbl}>IVA {ivaPerc}%</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>{fmt(ivaImporto)}</div>
                      </div>
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ ...lbl, color: '#1d4ed8' }}>Totale con IVA</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#1d4ed8' }}>{fmt(totaleLordo)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tranche */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Condizioni di pagamento</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 130px', gap: 8, marginBottom: 8 }}>
                {['Descrizione tranche', '%', 'Importo calcolato'].map(h => (
                  <span key={h} style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</span>
                ))}
              </div>
              {tranche.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 130px', gap: 8, marginBottom: 7, alignItems: 'center' }}>
                  <input style={{ ...inp, padding: '6px 8px' }} value={t.descrizione} onChange={e => updateTranche(i, 'descrizione', e.target.value)} />
                  <input style={{ ...inp, padding: '6px 8px', textAlign: 'right' }} type="number" value={t.percentuale} onChange={e => updateTranche(i, 'percentuale', parseFloat(e.target.value) || 0)} min={0} max={100} />
                  <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: 13 }}>{fmt(totaleConCassa * t.percentuale / 100)}</span>
                </div>
              ))}
              {Math.abs(percTot - 100) > 0.01 && (
                <div style={{ fontSize: 11, color: '#991b1b', marginTop: 6, padding: '6px 10px', background: '#fee2e2', borderRadius: 6 }}>
                  ⚠ Le percentuali sommano {percTot.toFixed(1)}% — devono fare 100%
                </div>
              )}
            </div>

            {/* Note */}
            <div style={card}>
              <label style={lbl}>Note aggiuntive (opzionali)</label>
              <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Condizioni particolari, esclusioni, note al cliente..." />
            </div>

            {errore && (
              <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                ⚠ {errore}
              </div>
            )}

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

// ── Sub-componenti ────────────────────────────────────────────────────────────

/** Riga singola: label a sinistra, input (o valore read-only verde) a destra */
function VoceRow({
  label, value = '', onChange, valore, auto,
}: {
  label:     string
  value?:    string
  onChange?: (v: string) => void
  valore?:   number
  auto?:     boolean
}) {
  const fmt0 = (n: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid #fafafa' }}>
      <span style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>
        {label}
        {auto && (
          <span style={{ marginLeft: 6, fontSize: 9, background: '#fef3c7', color: '#92400e', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>
            AUTO
          </span>
        )}
      </span>
      {auto ? (
        <div style={{ padding: '6px 10px', borderRadius: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12, fontWeight: 700, color: '#166534', textAlign: 'right' }}>
          {fmt0(valore ?? 0)}
        </div>
      ) : (
        <input
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder="0"
          style={{ width: '100%', padding: '6px 10px', borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a', background: 'white', textAlign: 'right' }}
        />
      )}
    </div>
  )
}
