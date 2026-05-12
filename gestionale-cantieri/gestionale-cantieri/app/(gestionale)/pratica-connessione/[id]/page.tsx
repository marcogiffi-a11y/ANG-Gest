'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const EMPTY_FORM = {
  richiesta: {
    tipo_impianto: '', tipo_richiesta: '', mandatario: '',
    titolare_connessione_tipo: 'Persona Fisica', email_gaudi: '', iban: '',
  },
  titolare: {
    nome: '', cognome: '', nazione_nascita: 'Italia', provincia_nascita: '',
    nato_a: '', data_nascita: '', codice_fiscale: '', telefono: '',
    email_produttore: '', residenza_nazione: 'Italia', residenza_provincia: '',
    residenza_comune: '', residenza_cap: '', residenza_indirizzo: '', residenza_civico: '',
  },
  dati_impianto: {
    provincia: '', comune: '', localita: '', cap: '', indirizzo: '', numero_civico: '',
    titolarita: 'Proprietario', nome_impianto: '', installazione_su: 'Edificio',
    particella: '', subalterno: '', foglio: '', regime_commerciale: '',
    tipo_generazione: 'Fotovoltaico', tipo_fonte: 'Solare', pod: '',
    potenza_richiesta_kw: '', potenza_nominale_kw: '', potenza_generazione_kw: '',
    inverter_presente: 'SI', potenza_inverter_kw: '', tipo_tensione: 'BT Monofase',
    valore_tensione_v: '230', accumulo_presente: 'NO', tipologia_accumulo: '',
    potenza_accumulo_kw: '', capacita_accumulo_kwh: '', data_avvio_lavori: '',
    superbonus: 'No', incentivo: 'Nessun incentivo', ritiro_energia: 'GSE',
    tipo_remunerazione: '',
  },
}

export default function PraticaConnessionePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const progettoId = params.id

  const [progetto,   setProgetto]   = useState<any>(null)
  const [form,       setForm]       = useState<any>(JSON.parse(JSON.stringify(EMPTY_FORM)))
  const [documenti,  setDocumenti]  = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [analyzing,  setAnalyzing]  = useState(false)
  const [aiResult,   setAiResult]   = useState('')
  const [aiProgress, setAiProgress] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: p } = await supabase.from('progetti')
      .select('*, clienti(ragione_sociale, nome, cognome)')
      .eq('id', progettoId).single()
    setProgetto(p)

    const { data: conn } = await supabase.from('pratiche_connessione')
      .select('*').eq('progetto_id', progettoId).single()
    if (conn?.form_data) setForm(conn.form_data)

    const { data: pr } = await supabase.from('pratiche')
      .select('id').eq('progetto_id', progettoId).single()
    if (pr) {
      const { data: docs } = await supabase.from('documenti_pratica')
        .select('*').eq('pratica_id', pr.id).order('created_at', { ascending: false })
      setDocumenti(docs || [])
    }
    setLoading(false)
  }

  async function salva() {
    setSaving(true)
    const { data: existing } = await supabase.from('pratiche_connessione')
      .select('id').eq('progetto_id', progettoId).single()
    if (existing) {
      await supabase.from('pratiche_connessione').update({ form_data: form, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('pratiche_connessione').insert({ progetto_id: progettoId, form_data: form })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function set(section: string, field: string, val: string) {
    setForm((prev: any) => ({ ...prev, [section]: { ...prev[section], [field]: val } }))
  }

  async function analizzaConAI() {
    if (documenti.length === 0) { alert('Nessun documento allegato alla pratica.'); return }
    setAnalyzing(true)
    setAiResult('')
    const merged: any = JSON.parse(JSON.stringify(EMPTY_FORM))

    for (let i = 0; i < Math.min(documenti.length, 6); i++) {
      const doc = documenti[i]
      setAiProgress(`Analisi documento ${i + 1} di ${Math.min(documenti.length, 6)}...`)
      const { data: fileData } = await supabase.storage.from('documenti-pratiche').download(doc.path)
      if (!fileData) continue
      const b64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(fileData)
      })
      try {
        const resp = await fetch('/api/analizza-connessione', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documenti: [{ base64: b64, tipo: doc.tipo, nome: doc.nome }] }),
        })
        const data = await resp.json()
        if (!data?.ok) continue
        const r = data.result
        // Merge — prendi il primo valore non-null trovato
        ;(['richiesta', 'titolare', 'dati_impianto'] as const).forEach((section) => {
          if (r[section]) {
            Object.entries(r[section]).forEach(([k, v]) => {
              if (v && v !== 'null' && !merged[section][k]) {
                merged[section][k] = v as string
              }
            })
          }
        })
      } catch {}
    }
    setForm(merged)
    setAiProgress('')
    setAiResult('✅ Compilazione completata! Verifica i campi e premi Salva.')
    setAnalyzing(false)
  }

  const nomeCliente = progetto
    ? `${progetto.clienti?.nome || ''} ${progetto.clienti?.cognome || progetto.clienti?.ragione_sociale || ''}`.trim()
    : '—'

  const card: React.CSSProperties  = { background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 20 }
  const lbl: React.CSSProperties   = { fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.04em', display: 'block', marginBottom: 4 }
  const inp: React.CSSProperties   = { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, boxSizing: 'border-box' as const }
  const sel: React.CSSProperties   = { ...inp }
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
  const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }
  const sh: React.CSSProperties    = { fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 14 }

  if (loading) return <div style={{ padding: 40, color: '#94a3b8', textAlign: 'center' }}>Caricamento...</div>

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f' }}>⚡ Domanda di Connessione — {nomeCliente}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{progetto?.numero_ordine} · Modulo e-distribuzione</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/pratiche/${progettoId}`} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, textDecoration: 'none' }}>
            ← Torna alla pratica
          </Link>
          <button onClick={salva} disabled={saving} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: saving ? '#94a3b8' : '#6ab04c', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Salvataggio...' : saved ? '✓ Salvato!' : 'Salva'}
          </button>
        </div>
      </div>

      {/* AI BUTTON */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={analizzaConAI} disabled={analyzing}
          style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: analyzing ? '#e2e8f0' : 'linear-gradient(135deg, #1e3a5f, #2563eb)', color: analyzing ? '#94a3b8' : 'white', fontSize: 13, fontWeight: 700, cursor: analyzing ? 'not-allowed' : 'pointer' }}>
          {analyzing ? `🤖 ${aiProgress}` : `🤖 Compila automaticamente con AI (${documenti.length} documenti allegati)`}
        </button>
        {aiResult && (
          <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>{aiResult}</div>
        )}
        {documenti.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>Carica documenti nella sezione Pratica FV per abilitare l'analisi AI.</div>
        )}
      </div>

      {/* SEZIONE RICHIESTA */}
      <div style={card}>
        <div style={sh}>📋 Richiesta</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={grid2}>
            <div>
              <label style={lbl}>Tipo impianto</label>
              <select style={sel} value={form.richiesta.tipo_impianto} onChange={e => set('richiesta','tipo_impianto',e.target.value)}>
                <option value="">— Seleziona —</option>
                <option>Un impianto di produzione di energia elettrica</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Tipo richiesta</label>
              <select style={sel} value={form.richiesta.tipo_richiesta} onChange={e => set('richiesta','tipo_richiesta',e.target.value)}>
                <option value="">— Seleziona —</option>
                <option>Nuova connessione</option>
                <option>Adeguamento connessione esistente</option>
              </select>
            </div>
          </div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Mandatario</label>
              <select style={sel} value={form.richiesta.mandatario} onChange={e => set('richiesta','mandatario',e.target.value)}>
                <option value="">— Seleziona —</option>
                <option>che risulterà intestatario dell'officina elettrica di produzione</option>
                <option>di essere mandatario con rappresentanza</option>
                <option>di essere mandatario senza rappresentanza</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Titolare connessione</label>
              <select style={sel} value={form.richiesta.titolare_connessione_tipo} onChange={e => set('richiesta','titolare_connessione_tipo',e.target.value)}>
                <option>Persona Fisica</option>
                <option>Persona Giuridica</option>
              </select>
            </div>
          </div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Email per registrazione in Gaudì</label>
              <input style={inp} value={form.richiesta.email_gaudi} onChange={e => set('richiesta','email_gaudi',e.target.value)} placeholder="email@esempio.com" />
            </div>
            <div>
              <label style={lbl}>IBAN</label>
              <input style={inp} value={form.richiesta.iban} onChange={e => set('richiesta','iban',e.target.value)} placeholder="IT00X0000000000000000000000" />
            </div>
          </div>
        </div>
      </div>

      {/* SEZIONE TITOLARE */}
      <div style={card}>
        <div style={sh}>👤 Titolare Connessione</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={grid3}>
            <div><label style={lbl}>Nome</label><input style={inp} value={form.titolare.nome} onChange={e => set('titolare','nome',e.target.value)} /></div>
            <div><label style={lbl}>Cognome</label><input style={inp} value={form.titolare.cognome} onChange={e => set('titolare','cognome',e.target.value)} /></div>
            <div><label style={lbl}>Codice Fiscale</label><input style={inp} value={form.titolare.codice_fiscale} onChange={e => set('titolare','codice_fiscale',e.target.value)} /></div>
          </div>
          <div style={grid3}>
            <div><label style={lbl}>Nazione di nascita</label><input style={inp} value={form.titolare.nazione_nascita} onChange={e => set('titolare','nazione_nascita',e.target.value)} /></div>
            <div><label style={lbl}>Provincia di nascita</label><input style={inp} value={form.titolare.provincia_nascita} onChange={e => set('titolare','provincia_nascita',e.target.value)} /></div>
            <div><label style={lbl}>Nato/a a</label><input style={inp} value={form.titolare.nato_a} onChange={e => set('titolare','nato_a',e.target.value)} /></div>
          </div>
          <div style={grid3}>
            <div><label style={lbl}>Data di nascita</label><input style={inp} value={form.titolare.data_nascita} onChange={e => set('titolare','data_nascita',e.target.value)} placeholder="gg/mm/aaaa" /></div>
            <div><label style={lbl}>Telefono</label><input style={inp} value={form.titolare.telefono} onChange={e => set('titolare','telefono',e.target.value)} /></div>
            <div><label style={lbl}>Email produttore</label><input style={inp} value={form.titolare.email_produttore} onChange={e => set('titolare','email_produttore',e.target.value)} /></div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginTop: 4, marginBottom: -4 }}>RESIDENZA</div>
          <div style={grid3}>
            <div><label style={lbl}>Nazione</label><input style={inp} value={form.titolare.residenza_nazione} onChange={e => set('titolare','residenza_nazione',e.target.value)} /></div>
            <div><label style={lbl}>Provincia</label><input style={inp} value={form.titolare.residenza_provincia} onChange={e => set('titolare','residenza_provincia',e.target.value)} /></div>
            <div><label style={lbl}>Comune</label><input style={inp} value={form.titolare.residenza_comune} onChange={e => set('titolare','residenza_comune',e.target.value)} /></div>
          </div>
          <div style={grid3}>
            <div><label style={lbl}>CAP</label><input style={inp} value={form.titolare.residenza_cap} onChange={e => set('titolare','residenza_cap',e.target.value)} /></div>
            <div><label style={lbl}>Indirizzo</label><input style={inp} value={form.titolare.residenza_indirizzo} onChange={e => set('titolare','residenza_indirizzo',e.target.value)} /></div>
            <div><label style={lbl}>Numero civico</label><input style={inp} value={form.titolare.residenza_civico} onChange={e => set('titolare','residenza_civico',e.target.value)} /></div>
          </div>
        </div>
      </div>

      {/* SEZIONE DATI IMPIANTO */}
      <div style={card}>
        <div style={sh}>⚡ Dati Impianto</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>UBICAZIONE</div>
          <div style={grid3}>
            <div><label style={lbl}>Provincia</label><input style={inp} value={form.dati_impianto.provincia} onChange={e => set('dati_impianto','provincia',e.target.value)} /></div>
            <div><label style={lbl}>Comune</label><input style={inp} value={form.dati_impianto.comune} onChange={e => set('dati_impianto','comune',e.target.value)} /></div>
            <div><label style={lbl}>Località</label><input style={inp} value={form.dati_impianto.localita} onChange={e => set('dati_impianto','localita',e.target.value)} /></div>
          </div>
          <div style={grid3}>
            <div><label style={lbl}>CAP</label><input style={inp} value={form.dati_impianto.cap} onChange={e => set('dati_impianto','cap',e.target.value)} /></div>
            <div><label style={lbl}>Indirizzo</label><input style={inp} value={form.dati_impianto.indirizzo} onChange={e => set('dati_impianto','indirizzo',e.target.value)} /></div>
            <div><label style={lbl}>Numero civico</label><input style={inp} value={form.dati_impianto.numero_civico} onChange={e => set('dati_impianto','numero_civico',e.target.value)} /></div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginTop: 4 }}>DATI TECNICI</div>
          <div style={grid3}>
            <div>
              <label style={lbl}>Titolarità impianto</label>
              <select style={sel} value={form.dati_impianto.titolarita} onChange={e => set('dati_impianto','titolarita',e.target.value)}>
                <option>Proprietario</option><option>Affittuario</option>
              </select>
            </div>
            <div><label style={lbl}>Nome impianto</label><input style={inp} value={form.dati_impianto.nome_impianto} onChange={e => set('dati_impianto','nome_impianto',e.target.value)} /></div>
            <div>
              <label style={lbl}>Installazione su</label>
              <select style={sel} value={form.dati_impianto.installazione_su} onChange={e => set('dati_impianto','installazione_su',e.target.value)}>
                <option>Edificio</option><option>Struttura o manufatto fuori terra</option>
              </select>
            </div>
          </div>
          <div style={grid3}>
            <div><label style={lbl}>Foglio</label><input style={inp} value={form.dati_impianto.foglio} onChange={e => set('dati_impianto','foglio',e.target.value)} /></div>
            <div><label style={lbl}>Particella/Mappale</label><input style={inp} value={form.dati_impianto.particella} onChange={e => set('dati_impianto','particella',e.target.value)} /></div>
            <div><label style={lbl}>Subalterno</label><input style={inp} value={form.dati_impianto.subalterno} onChange={e => set('dati_impianto','subalterno',e.target.value)} /></div>
          </div>
          <div style={grid2}>
            <div><label style={lbl}>POD</label><input style={inp} value={form.dati_impianto.pod} onChange={e => set('dati_impianto','pod',e.target.value)} placeholder="IT001E..." /></div>
            <div><label style={lbl}>Regime commerciale</label><input style={inp} value={form.dati_impianto.regime_commerciale} onChange={e => set('dati_impianto','regime_commerciale',e.target.value)} /></div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginTop: 4 }}>POTENZE</div>
          <div style={grid3}>
            <div><label style={lbl}>Potenza richiesta (kW)</label><input style={inp} value={form.dati_impianto.potenza_richiesta_kw} onChange={e => set('dati_impianto','potenza_richiesta_kw',e.target.value)} /></div>
            <div><label style={lbl}>Potenza nominale (kW)</label><input style={inp} value={form.dati_impianto.potenza_nominale_kw} onChange={e => set('dati_impianto','potenza_nominale_kw',e.target.value)} /></div>
            <div><label style={lbl}>Potenza generazione (kW)</label><input style={inp} value={form.dati_impianto.potenza_generazione_kw} onChange={e => set('dati_impianto','potenza_generazione_kw',e.target.value)} /></div>
          </div>
          <div style={grid3}>
            <div>
              <label style={lbl}>Inverter presente</label>
              <select style={sel} value={form.dati_impianto.inverter_presente} onChange={e => set('dati_impianto','inverter_presente',e.target.value)}>
                <option>SI</option><option>NO</option>
              </select>
            </div>
            <div><label style={lbl}>Potenza inverter (kW)</label><input style={inp} value={form.dati_impianto.potenza_inverter_kw} onChange={e => set('dati_impianto','potenza_inverter_kw',e.target.value)} /></div>
            <div>
              <label style={lbl}>Tipo tensione</label>
              <select style={sel} value={form.dati_impianto.tipo_tensione} onChange={e => set('dati_impianto','tipo_tensione',e.target.value)}>
                <option>BT Monofase</option><option>BT Trifase</option><option>MT</option>
              </select>
            </div>
          </div>
          <div style={grid3}>
            <div><label style={lbl}>Valore tensione (V)</label><input style={inp} value={form.dati_impianto.valore_tensione_v} onChange={e => set('dati_impianto','valore_tensione_v',e.target.value)} /></div>
            <div>
              <label style={lbl}>Sistema di accumulo</label>
              <select style={sel} value={form.dati_impianto.accumulo_presente} onChange={e => set('dati_impianto','accumulo_presente',e.target.value)}>
                <option>SI</option><option>NO</option>
              </select>
            </div>
            <div><label style={lbl}>Tipologia accumulo</label><input style={inp} value={form.dati_impianto.tipologia_accumulo} onChange={e => set('dati_impianto','tipologia_accumulo',e.target.value)} /></div>
          </div>
          {form.dati_impianto.accumulo_presente === 'SI' && (
            <div style={grid2}>
              <div><label style={lbl}>Potenza accumulo (kW)</label><input style={inp} value={form.dati_impianto.potenza_accumulo_kw} onChange={e => set('dati_impianto','potenza_accumulo_kw',e.target.value)} /></div>
              <div><label style={lbl}>Capacità accumulo (kWh)</label><input style={inp} value={form.dati_impianto.capacita_accumulo_kwh} onChange={e => set('dati_impianto','capacita_accumulo_kwh',e.target.value)} /></div>
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginTop: 4 }}>INCENTIVI E RITIRO</div>
          <div style={grid3}>
            <div>
              <label style={lbl}>Ritiro energia da</label>
              <select style={sel} value={form.dati_impianto.ritiro_energia} onChange={e => set('dati_impianto','ritiro_energia',e.target.value)}>
                <option>GSE</option><option>Altro</option>
              </select>
            </div>
            <div><label style={lbl}>Tipo remunerazione</label><input style={inp} value={form.dati_impianto.tipo_remunerazione} onChange={e => set('dati_impianto','tipo_remunerazione',e.target.value)} placeholder="RID - Prezzo Minimo Garantito..." /></div>
            <div>
              <label style={lbl}>Superbonus</label>
              <select style={sel} value={form.dati_impianto.superbonus} onChange={e => set('dati_impianto','superbonus',e.target.value)}>
                <option>No</option><option>Si</option>
              </select>
            </div>
          </div>
          <div style={grid2}>
            <div><label style={lbl}>Incentivo</label><input style={inp} value={form.dati_impianto.incentivo} onChange={e => set('dati_impianto','incentivo',e.target.value)} placeholder="Nessun incentivo..." /></div>
            <div><label style={lbl}>Data prevista avvio lavori</label><input style={inp} type="date" value={form.dati_impianto.data_avvio_lavori} onChange={e => set('dati_impianto','data_avvio_lavori',e.target.value)} /></div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 30 }}>
        <button onClick={salva} disabled={saving}
          style={{ padding: '10px 28px', borderRadius: 7, border: 'none', background: saving ? '#94a3b8' : '#6ab04c', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Salvataggio...' : saved ? '✓ Salvato!' : '💾 Salva modulo'}
        </button>
      </div>
    </div>
  )
}
