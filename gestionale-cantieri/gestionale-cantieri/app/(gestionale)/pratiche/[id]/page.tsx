'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ─── CHECKLIST BLUEPRINT ─────────────────────────────────────────────────────
const BLUEPRINT: Record<string, { id: string; label: string; hint: string }[]> = {
  ricezione: [
    { id: 'doc_id',     label: 'Documento d\'identità',          hint: 'Documento cliente o legale rappresentante.' },
    { id: 'bolletta',   label: 'Bolletta',                        hint: 'Ultima bolletta utile per POD e dati fornitura.' },
    { id: 'iban',       label: 'IBAN',                            hint: 'Coordinate per pratiche o pagamenti correlati.' },
    { id: 'inverter',   label: 'Dati inverter',                   hint: 'Marca, modello, potenza, schede tecniche.' },
    { id: 'moduli',     label: 'Dati moduli',                     hint: 'Marca, modello, quantità e potenza moduli.' },
    { id: 'batterie',   label: 'Dati batterie',                   hint: 'Solo se previste nell\'impianto.' },
    { id: 'visura',     label: 'Visura camerale',                 hint: 'Obbligatoria in caso di persona giuridica.' },
    { id: 'gaudi_mail', label: 'Mail per registrazione Gaudì',    hint: 'Email utile per censimento e accessi.' },
  ],
  domanda: [
    { id: 'domanda_inviata',   label: 'Domanda di connessione inviata',    hint: 'Segna la data di invio al distributore.' },
    { id: 'mandato_inviato',   label: 'Mandato inviato al cliente',        hint: 'Invio del mandato o delega al cliente.' },
    { id: 'mandato_rientrato', label: 'Mandato firmato ricevuto',          hint: 'Conferma rientro documento firmato.' },
  ],
  regolamento: [
    { id: 'autotest_provarele',  label: 'Ricezione autotest e/o prova relè',        hint: 'Allega evidenza ricevuta dal tecnico.' },
    { id: 'dico',                label: 'Ricezione dichiarazione di conformità',    hint: 'Di.Co. impianto completa.' },
    { id: 'regolamento_inviato', label: 'Regolamento di esercizio inviato',         hint: 'Invio completato al distributore.' },
  ],
  integrazioni: [
    { id: 'integrazione_richiesta', label: 'Richiesta integrazione ricevuta',          hint: 'Segna quando arriva la richiesta.' },
    { id: 'integrazione_cliente',   label: 'Documenti integrativi richiesti al cliente', hint: 'Invio richiesta al cliente.' },
    { id: 'integrazione_inviata',   label: 'Integrazione inviata',                    hint: 'Chiusura verso il distributore.' },
  ],
}

const STAGE_META: Record<string, { title: string; desc: string; icon: string }> = {
  ricezione:    { title: 'Ricezione documenti',        desc: 'Checklist documentale iniziale.',                    icon: '📥' },
  domanda:      { title: 'Domanda di connessione',     desc: 'Invio pratica e mandato cliente.',                   icon: '📤' },
  regolamento:  { title: 'Regolamento di esercizio',   desc: 'Autotest, prova relè, Di.Co. e invio.',              icon: '📋' },
  integrazioni: { title: 'Eventuali integrazioni',     desc: 'Gestione richieste tra una fase e l\'altra.',        icon: '🔄' },
}

function initChecklist() {
  const cl: Record<string, Record<string, { checked: boolean; completedAt: string }>> = {}
  Object.entries(BLUEPRINT).forEach(([stage, items]) => {
    cl[stage] = {}
    items.forEach(i => { cl[stage][i.id] = { checked: false, completedAt: '' } })
  })
  return cl
}

function today() {
  return new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function PraticaPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const progettoId = params.id

  const [progetto,      setProgetto]      = useState<any>(null)
  const [pratica,       setPratica]       = useState<any>(null)
  const [checklist,     setChecklist]     = useState<any>(initChecklist())
  const [documenti,     setDocumenti]     = useState<any[]>([])
  const [pod,           setPod]           = useState('')
  const [distributore,  setDistributore]  = useState('')
  const [tipoSoggetto,  setTipoSoggetto]  = useState('persona_fisica')
  const [note,          setNote]          = useState('')
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [analyzing,     setAnalyzing]     = useState(false)
  const [aiResult,      setAiResult]      = useState('')
  const [dragOver,      setDragOver]      = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    // Carica progetto
    const { data: p } = await supabase
      .from('progetti')
      .select('*, clienti(ragione_sociale, nome, cognome, tipo_cliente)')
      .eq('id', progettoId)
      .single()
    setProgetto(p)

    // Carica o crea pratica
    const { data: pr } = await supabase
      .from('pratiche')
      .select('*')
      .eq('progetto_id', progettoId)
      .single()

    if (pr) {
      setPratica(pr)
      setPod(pr.pod || '')
      setDistributore(pr.distributore || '')
      setTipoSoggetto(pr.tipo_soggetto || 'persona_fisica')
      setNote(pr.note || '')
      if (pr.checklist && Object.keys(pr.checklist).length > 0) {
        setChecklist(pr.checklist)
      }
      // Carica documenti
      const { data: docs } = await supabase
        .from('documenti_pratica')
        .select('*')
        .eq('pratica_id', pr.id)
        .order('created_at', { ascending: false })
      setDocumenti(docs || [])
    }
    setLoading(false)
  }

  async function salva() {
    setSaving(true)
    if (pratica) {
      await supabase.from('pratiche').update({
        pod, distributore, tipo_soggetto: tipoSoggetto, note, checklist, updated_at: new Date().toISOString()
      }).eq('id', pratica.id)
    } else {
      const { data: nuova } = await supabase.from('pratiche').insert({
        progetto_id: progettoId, pod, distributore, tipo_soggetto: tipoSoggetto, note, checklist
      }).select().single()
      setPratica(nuova)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function toggleCheck(stage: string, itemId: string) {
    setChecklist((prev: any) => {
      const cur = prev[stage][itemId]
      return {
        ...prev,
        [stage]: {
          ...prev[stage],
          [itemId]: {
            checked: !cur.checked,
            completedAt: !cur.checked ? today() : '',
          }
        }
      }
    })
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return
    setUploading(true)

    let praticaId = pratica?.id
    if (!praticaId) {
      const { data: nuova } = await supabase.from('pratiche').insert({
        progetto_id: progettoId, pod, distributore, tipo_soggetto: tipoSoggetto, note, checklist
      }).select().single()
      setPratica(nuova)
      praticaId = nuova.id
    }

    for (const file of Array.from(files)) {
      const ext  = file.name.split('.').pop()
      const path = `${progettoId}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('documenti-pratiche').upload(path, file)
      if (!error) {
        await supabase.from('documenti_pratica').insert({
          pratica_id: praticaId,
          nome: file.name,
          path,
          tipo: file.type,
          dimensione: file.size,
        })
      }
    }
    // Ricarica documenti
    const { data: docs } = await supabase
      .from('documenti_pratica')
      .select('*')
      .eq('pratica_id', praticaId)
      .order('created_at', { ascending: false })
    setDocumenti(docs || [])
    setUploading(false)
  }

  async function eliminaDocumento(doc: any) {
    await supabase.storage.from('documenti-pratiche').remove([doc.path])
    await supabase.from('documenti_pratica').delete().eq('id', doc.id)
    setDocumenti(prev => prev.filter(d => d.id !== doc.id))
  }

  async function analizzaConAI() {
    if (documenti.length === 0) { alert('Carica almeno un documento prima di analizzare.'); return }
    setAnalyzing(true)
    setAiResult('')

    try {
      // Scarica i file e convertili in base64
      const contentBlocks: any[] = []
      for (const doc of documenti.slice(0, 5)) { // max 5 documenti
        const { data: fileData } = await supabase.storage
          .from('documenti-pratiche')
          .download(doc.path)
        if (!fileData) continue
        const b64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader()
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.onerror = () => rej(new Error('Read failed'))
          reader.readAsDataURL(fileData)
        })
        const isPdf = doc.tipo === 'application/pdf'
        contentBlocks.push({
          type: isPdf ? 'document' : 'image',
          source: {
            type: 'base64',
            media_type: doc.tipo || (isPdf ? 'application/pdf' : 'image/jpeg'),
            data: b64,
          },
        })
      }

      contentBlocks.push({
        type: 'text',
        text: `Analizza questi documenti relativi a una pratica di connessione fotovoltaica.
Estrai tutte le informazioni rilevanti e rispondi SOLO con un JSON nel formato seguente (senza markdown):
{
  "pod": "codice POD se trovato, altrimenti null",
  "distributore": "nome distributore se trovato (es. e-distribuzione), altrimenti null",
  "tipo_soggetto": "persona_fisica o persona_giuridica",
  "note": "breve sintesi dei punti chiave trovati nei documenti",
  "checklist": {
    "ricezione": {
      "doc_id": true,
      "bolletta": true,
      "iban": false,
      "inverter": false,
      "moduli": false,
      "batterie": false,
      "visura": false,
      "gaudi_mail": false
    },
    "domanda": {
      "domanda_inviata": false,
      "mandato_inviato": false,
      "mandato_rientrato": false
    },
    "regolamento": {
      "autotest_provarele": false,
      "dico": false,
      "regolamento_inviato": false
    },
    "integrazioni": {
      "integrazione_richiesta": false,
      "integrazione_cliente": false,
      "integrazione_inviata": false
    }
  }
}
Metti true solo per gli item di cui trovi evidenza diretta nei documenti.`
      })

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: contentBlocks }],
        })
      })
      const data = await resp.json()
      const text = data.content?.find((b: any) => b.type === 'text')?.text || ''

      try {
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        if (parsed.pod)          setPod(parsed.pod)
        if (parsed.distributore) setDistributore(parsed.distributore)
        if (parsed.tipo_soggetto) setTipoSoggetto(parsed.tipo_soggetto)
        if (parsed.note)         setNote(prev => prev ? prev + '\n' + parsed.note : parsed.note)

        // Aggiorna checklist
        if (parsed.checklist) {
          setChecklist((prev: any) => {
            const updated = JSON.parse(JSON.stringify(prev))
            Object.entries(parsed.checklist).forEach(([stage, items]: any) => {
              Object.entries(items).forEach(([itemId, val]) => {
                if (updated[stage]?.[itemId] !== undefined && val === true) {
                  updated[stage][itemId] = { checked: true, completedAt: today() }
                }
              })
            })
            return updated
          })
        }
        setAiResult('✅ Analisi completata! Campi e checklist aggiornati. Premi Salva per confermare.')
      } catch {
        setAiResult('⚠️ Risposta AI ricevuta ma non parsabile. Controlla i dati manualmente.\n\n' + text)
      }
    } catch (err) {
      setAiResult('❌ Errore durante l\'analisi: ' + String(err))
    }
    setAnalyzing(false)
  }

  function getStageProgress(stage: string) {
    const items = BLUEPRINT[stage]
    const cl = checklist[stage] || {}
    const done = items.filter(i => cl[i.id]?.checked).length
    return { done, total: items.length }
  }

  const nomeCliente = progetto
    ? progetto.clienti?.tipo_cliente === 'persona_fisica'
      ? `${progetto.clienti?.nome || ''} ${progetto.clienti?.cognome || ''}`.trim()
      : progetto.clienti?.ragione_sociale || '—'
    : '—'

  const fmtSize = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`

  // Stili
  const card: React.CSSProperties = { background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: '20px 24px' }
  const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.04em', display: 'block', marginBottom: 4 }
  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12, boxSizing: 'border-box' as const }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', fontSize: 14 }}>
      Caricamento pratica...
    </div>
  )

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f' }}>
            📋 Pratica FV — {nomeCliente}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            {progetto?.numero_ordine} · Connessione Fotovoltaica
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/ordini/${progettoId}`} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, textDecoration: 'none' }}>
            ← Torna all'ordine
          </Link>
          <button
            onClick={salva}
            disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: saving ? '#94a3b8' : '#6ab04c', color: 'white', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Salvataggio...' : saved ? '✓ Salvato!' : 'Salva'}
          </button>
        </div>
      </div>

      {/* DATI PRATICA + UPLOAD */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Dati pratica */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>⚡ Dati pratica</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={lbl}>POD</label>
              <input value={pod} onChange={e => setPod(e.target.value)} placeholder="IT001E..." style={inp} />
            </div>
            <div>
              <label style={lbl}>Distributore</label>
              <input value={distributore} onChange={e => setDistributore(e.target.value)} placeholder="e-distribuzione..." style={inp} />
            </div>
            <div>
              <label style={lbl}>Tipo soggetto</label>
              <select value={tipoSoggetto} onChange={e => setTipoSoggetto(e.target.value)} style={inp}>
                <option value="persona_fisica">Persona fisica</option>
                <option value="persona_giuridica">Persona giuridica</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Note</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Annotazioni, date, richieste cliente..." style={{ ...inp, resize: 'vertical' as const }} />
            </div>
          </div>
        </div>

        {/* Documenti */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>📎 Documenti allegati</div>

          {/* Drag & drop */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#6ab04c' : '#cbd5e1'}`,
              borderRadius: 8,
              padding: '24px 16px',
              textAlign: 'center' as const,
              cursor: 'pointer',
              background: dragOver ? '#f0fdf4' : '#f8fafc',
              marginBottom: 12,
              transition: 'all .15s',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>☁️</div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              {uploading ? 'Caricamento in corso...' : 'Trascina PDF o immagini qui'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>oppure clicca per selezionare</div>
            <input ref={fileRef} type="file" multiple accept=".pdf,image/*" style={{ display: 'none' }}
              onChange={e => e.target.files && uploadFiles(e.target.files)} />
          </div>

          {/* Lista documenti */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' as const }}>
            {documenti.length === 0 ? (
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' as const, padding: '8px 0' }}>Nessun documento caricato</div>
            ) : documenti.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{doc.tipo === 'application/pdf' ? '📄' : '🖼️'}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{doc.nome}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{fmtSize(doc.dimensione || 0)}</div>
                  </div>
                </div>
                <button onClick={() => eliminaDocumento(doc)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '0 2px' }}>×</button>
              </div>
            ))}
          </div>

          {/* AI Button */}
          <button
            onClick={analizzaConAI}
            disabled={analyzing || documenti.length === 0}
            style={{
              marginTop: 12, width: '100%', padding: '10px', borderRadius: 7, border: 'none',
              background: analyzing || documenti.length === 0 ? '#e2e8f0' : 'linear-gradient(135deg, #1e3a5f, #2563eb)',
              color: analyzing || documenti.length === 0 ? '#94a3b8' : 'white',
              fontSize: 12, fontWeight: 700, cursor: analyzing || documenti.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {analyzing ? '🤖 Analisi in corso...' : '🤖 Analizza con AI e compila automaticamente'}
          </button>

          {aiResult && (
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 7,
              background: aiResult.startsWith('✅') ? '#f0fdf4' : '#fef9c3',
              border: `1px solid ${aiResult.startsWith('✅') ? '#bbf7d0' : '#fde047'}`,
              fontSize: 11, color: '#334155', whiteSpace: 'pre-wrap' as const,
            }}>
              {aiResult}
            </div>
          )}
        </div>
      </div>

      {/* CHECKLIST FASI */}
      {Object.entries(BLUEPRINT).map(([stage, items]) => {
        const meta  = STAGE_META[stage]
        const prog  = getStageProgress(stage)
        const pct   = prog.total ? Math.round((prog.done / prog.total) * 100) : 0
        const allOk = prog.done === prog.total

        return (
          <div key={stage} style={card}>
            {/* Stage header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>
                  {meta.icon} {meta.title}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{meta.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: allOk ? '#dcfce7' : prog.done > 0 ? '#dbeafe' : '#f1f5f9',
                  color: allOk ? '#166534' : prog.done > 0 ? '#1d4ed8' : '#64748b',
                }}>
                  {allOk ? '✓ Completa' : `${prog.done}/${prog.total}`}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: allOk ? '#6ab04c' : '#3b82f6', borderRadius: 4, transition: 'width .3s' }} />
            </div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(item => {
                const state = checklist[stage]?.[item.id] || { checked: false, completedAt: '' }
                const isVisura = item.id === 'visura' && tipoSoggetto !== 'persona_giuridica'
                if (isVisura) return null
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleCheck(stage, item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      background: state.checked ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${state.checked ? '#bbf7d0' : '#f1f5f9'}`,
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, border: `2px solid ${state.checked ? '#6ab04c' : '#cbd5e1'}`,
                      background: state.checked ? '#6ab04c' : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 11, color: 'white', fontWeight: 700,
                    }}>
                      {state.checked ? '✓' : ''}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: state.checked ? '#166534' : '#334155', textDecoration: state.checked ? 'line-through' : 'none' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{item.hint}</div>
                    </div>
                    {state.checked && state.completedAt && (
                      <div style={{ fontSize: 10, color: '#6ab04c', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                        ✓ {state.completedAt}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Footer save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 20 }}>
        <button
          onClick={salva}
          disabled={saving}
          style={{ padding: '10px 28px', borderRadius: 7, border: 'none', background: saving ? '#94a3b8' : '#6ab04c', color: 'white', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Salvataggio...' : saved ? '✓ Salvato!' : '💾 Salva pratica'}
        </button>
      </div>

    </div>
  )
}
