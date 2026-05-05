'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import { useRouter } from 'next/navigation'

type Sal = { numero: number; descrizione: string; percentuale: number; importo: number; data_prevista: string }

const IVA_OPTIONS = ['22', '10', '4', 'Esente art. 10', 'Fuori campo IVA', 'Reverse charge art. 17']

export default function NuovoOrdinePage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [portafogli, setPortafogli] = useState<any[]>([])
  const [serviziLegenda, setServiziLegenda] = useState<string[]>([])

  // Step 1
  const [portafoglioId, setPortafoglioId] = useState('')
  const [nuovoPortafoglio, setNuovoPortafoglio] = useState('')
  const [ragioneSociale, setRagioneSociale] = useState('')
  const [piva, setPiva] = useState('')
  const [referente, setReferente] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [pec, setPec] = useState('')
  const [indirizzo, setIndirizzo] = useState('')
  const [tipoServizio, setTipoServizio] = useState<'ingegneria' | 'fornitura_posa'>('ingegneria')

  // Step 2
  const [numeroOrdine, setNumeroOrdine] = useState('')
  const [numeroOfferta, setNumeroOfferta] = useState('')
  const [importoNetto, setImportoNetto] = useState('')
  const [cassaPerc, setCassaPerc] = useState('4')
  const [ivaPerc, setIvaPerc] = useState('22')
  const [serviziSelezionati, setServiziSelezionati] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfNome, setPdfNome] = useState('')

  // Step 3
  const [sals, setSals] = useState<Sal[]>([])

  useEffect(() => {
    supabase.from('portafogli').select('*').order('nome').then(({ data }) => setPortafogli(data || []))
    supabase.from('servizi_ingegneria').select('nome').order('ordine').then(({ data }) => setServiziLegenda((data || []).map((s: any) => s.nome)))

    // Auto-genera numero ordine
    const anno = new Date().getFullYear()
    supabase
      .from('progetti')
      .select('numero_ordine')
      .ilike('numero_ordine', `ORD-${anno}-%`)
      .order('numero_ordine', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const last  = data[0].numero_ordine as string
          const match = last.match(/(\d+)$/)
          const num   = match ? parseInt(match[1]) + 1 : 1
          setNumeroOrdine(`ORD-${anno}-${String(num).padStart(3, '0')}`)
        } else {
          setNumeroOrdine(`ORD-${anno}-001`)
        }
      })
  }, [])

  async function creaPortafoglio() {
    if (!nuovoPortafoglio.trim()) return
    const { data } = await supabase.from('portafogli').insert({ nome: nuovoPortafoglio.trim() }).select().single()
    if (data) { setPortafogli(prev => [...prev, data]); setPortafoglioId(data.id); setNuovoPortafoglio('') }
  }

  function toggleServizio(s: string) {
    setServiziSelezionati(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function analizzaPDF() {
    if (!pdfFile || !importoNetto) return
    setAiLoading(true)
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.onerror = rej
        r.readAsDataURL(pdfFile)
      })
      const resp = await fetch('/api/analizza-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64, importoNetto: parseFloat(importoNetto.replace(',', '.')) }),
      })
      const { sal } = await resp.json()
      if (sal?.length > 0) setSals(sal)
    } catch {}
    setAiLoading(false)
  }

  function addSal() {
    setSals(prev => [...prev, { numero: prev.length + 1, descrizione: '', percentuale: 0, importo: 0, data_prevista: '' }])
  }

  function updateSal(i: number, field: keyof Sal, value: string | number) {
    setSals(prev => {
      const copy = [...prev]
      copy[i] = { ...copy[i], [field]: value }
      if (field === 'percentuale') {
        copy[i].importo = parseFloat(importoNetto.replace(',', '.') || '0') * Number(value) / 100
      }
      return copy
    })
  }

  async function salva() {
    setLoading(true)
    try {
      // Crea cliente
      let pid = portafoglioId
      const { data: cliente } = await supabase.from('clienti').insert({
        portafoglio_id: pid || null,
        ragione_sociale: ragioneSociale,
        piva, referente, email, telefono, pec, indirizzo,
      }).select().single()

      // Crea progetto
      const { data: progetto } = await supabase.from('progetti').insert({
        cliente_id: cliente!.id,
        numero_ordine: numeroOrdine,
        numero_offerta: numeroOfferta || null,
        tipo_servizio: tipoServizio,
        servizi: serviziSelezionati,
        importo_netto: parseFloat(importoNetto.replace(',', '.') || '0'),
        cassa_percentuale: tipoServizio === 'ingegneria' ? parseFloat(cassaPerc || '0') : 0,
        iva_percentuale: parseFloat(ivaPerc.replace('%', '') || '22'),
        note: note || null,
        stato: 'attivo',
      }).select().single()

      // Inserisci SAL
      if (sals.length > 0) {
        await supabase.from('sal').insert(sals.map(s => ({
          progetto_id: progetto!.id,
          numero: s.numero,
          descrizione: s.descrizione,
          percentuale: s.percentuale,
          importo: s.importo,
          data_prevista: s.data_prevista || null,
          stato: 'in_attesa',
        })))
      }

      // Carica PDF se presente
      if (pdfFile) {
        const ext = pdfFile.name.split('.').pop()
        const path = `${progetto!.id}/${Date.now()}.${ext}`
        const { data: upload } = await supabase.storage.from('documenti').upload(path, pdfFile)
        if (upload) {
          const { data: urlData } = supabase.storage.from('documenti').getPublicUrl(path)
          await supabase.from('documenti').insert({
            progetto_id: progetto!.id,
            nome: pdfFile.name,
            tipo: 'Contratto/Accettazione',
            url: urlData.publicUrl,
            dimensione: pdfFile.size,
          })
        }
      }

      router.push(`/progetti/${progetto!.id}`)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

  const stepLabel = ['', 'Portafoglio & Cliente', 'Ordine & Servizi', 'SAL & Fatturazione']

  return (
    <>
      <Topbar title="Nuovo ordine" subtitle={`Step ${step} — ${stepLabel[step]}`} />
      <div style={{ padding: '20px 24px', maxWidth: 780, margin: '0 auto' }}>

        {/* Steps indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 10, fontWeight: 700,
                background: step > n ? '#22c55e' : step === n ? '#3b82f6' : '#e2e8f0',
                color: step >= n ? 'white' : '#94a3b8'
              }}>{step > n ? '✓' : n}</div>
              <span style={{ fontSize: 11, color: step === n ? '#3b82f6' : step > n ? '#22c55e' : '#94a3b8', fontWeight: step === n ? 700 : 400 }}>{stepLabel[n]}</span>
              {n < 3 && <div style={{ width: 24, height: 1, background: '#e2e8f0', margin: '0 4px' }}/>}
            </div>
          ))}
        </div>

        {/* ========== STEP 1 ========== */}
        {step === 1 && (
          <div>
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Portafoglio</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={lbl}>Seleziona portafoglio</label>
                  <select value={portafoglioId} onChange={e => setPortafoglioId(e.target.value)} style={inp}>
                    <option value="">— Seleziona —</option>
                    {portafogli.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Oppure crea nuovo</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={nuovoPortafoglio} onChange={e => setNuovoPortafoglio(e.target.value)} placeholder="Nome portafoglio" style={{ ...inp, width: 160 }}/>
                    <button onClick={creaPortafoglio} style={btnPrimary}>Crea</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Dati cliente</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={lbl}>Ragione sociale *</label><input value={ragioneSociale} onChange={e => setRagioneSociale(e.target.value)} placeholder="Es. Comune di Treviso" style={inp}/></div>
                <div><label style={lbl}>P.IVA / C.F.</label><input value={piva} onChange={e => setPiva(e.target.value)} placeholder="IT00000000000" style={inp}/></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={lbl}>Referente</label><input value={referente} onChange={e => setReferente(e.target.value)} placeholder="Nome cognome" style={inp}/></div>
                <div><label style={lbl}>Email</label><input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@cliente.it" style={inp}/></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={lbl}>Telefono</label><input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+39 000 0000000" style={inp}/></div>
                <div><label style={lbl}>PEC</label><input value={pec} onChange={e => setPec(e.target.value)} placeholder="pec@cliente.it" style={inp}/></div>
              </div>
              <div><label style={lbl}>Indirizzo</label><input value={indirizzo} onChange={e => setIndirizzo(e.target.value)} placeholder="Via, numero civico, CAP, Città" style={inp}/></div>
            </div>

            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Tipo di servizio</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([['ingegneria', '📐', 'Servizi di ingegneria', 'Progettazione, DL, collaudo, perizie'],
                   ['fornitura_posa', '⚡', 'Fornitura e posa impianti', 'Fornitura materiali + installazione']] as const).map(([val, icon, label, sub]) => (
                  <div key={val} onClick={() => setTipoServizio(val)} style={{
                    border: tipoServizio === val ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    background: tipoServizio === val ? '#eff6ff' : 'white',
                    borderRadius: 8, padding: 14, cursor: 'pointer', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 5 }}>{icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => router.push('/dashboard')} style={btnSecondary}>Annulla</button>
              <button onClick={() => ragioneSociale ? setStep(2) : alert('Inserisci almeno la ragione sociale')} style={btnPrimary}>Avanti →</button>
            </div>
          </div>
        )}

        {/* ========== STEP 2 ========== */}
        {step === 2 && (
          <div>
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Dati ordine</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={lbl}>
                    Numero ordine *
                    <span style={{ marginLeft: 6, fontSize: 9, background: '#fef3c7', color: '#92400e', borderRadius: 3, padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase' }}>
                      AUTO
                    </span>
                  </label>
                  <input
                    value={numeroOrdine}
                    onChange={e => setNumeroOrdine(e.target.value)}
                    placeholder="ORD-2026-001"
                    style={{ ...inp, borderColor: numeroOrdine ? '#6ab04c' : '#e2e8f0', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Generato automaticamente · puoi modificarlo</div>
                </div>
                <div><label style={lbl}>N. offerta (se diverso)</label><input value={numeroOfferta} onChange={e => setNumeroOfferta(e.target.value)} placeholder="OFF-2026-001" style={inp}/></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: tipoServizio === 'ingegneria' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={lbl}>Importo netto (€) *</label><input value={importoNetto} onChange={e => setImportoNetto(e.target.value)} placeholder="0,00" style={inp}/></div>
                {tipoServizio === 'ingegneria' && (
                  <div><label style={lbl}>Cassa ingegneri (%)</label><input value={cassaPerc} onChange={e => setCassaPerc(e.target.value)} style={inp}/></div>
                )}
                <div><label style={lbl}>IVA applicabile *</label>
                  <select value={ivaPerc} onChange={e => setIvaPerc(e.target.value)} style={inp}>
                    {IVA_OPTIONS.map(o => <option key={o} value={o}>{o.includes('%') ? o : o + (isNaN(Number(o)) ? '' : '%')}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={lbl}>Note</label><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note aggiuntive sull'ordine..." rows={2} style={{ ...inp, resize: 'vertical' }}/></div>
            </div>

            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Servizi forniti (selezione multipla)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {serviziLegenda.map(s => (
                  <span key={s} onClick={() => toggleServizio(s)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                    border: serviziSelezionati.includes(s) ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                    background: serviziSelezionati.includes(s) ? '#eff6ff' : 'white',
                    color: serviziSelezionati.includes(s) ? '#1d4ed8' : '#64748b',
                    fontWeight: serviziSelezionati.includes(s) ? 600 : 400,
                    transition: 'all .1s'
                  }}>{s}</span>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Carica PDF accettazione ordine</div>
              <label style={{ display: 'block', border: '1px dashed #cbd5e1', borderRadius: 8, padding: 20, textAlign: 'center', cursor: 'pointer' }}>
                <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setPdfFile(f); setPdfNome(f.name) } }}/>
                {pdfNome
                  ? <><div style={{ fontSize: 18 }}>✅</div><div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>{pdfNome}</div><div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Clicca per cambiare file</div></>
                  : <><div style={{ fontSize: 18 }}>📎</div><div style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>Clicca per caricare il PDF</div><div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Contratto firmato, lettera d'incarico, ordine di acquisto</div></>
                }
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setStep(1)} style={btnSecondary}>← Indietro</button>
              <button onClick={() => { if (!numeroOrdine) { alert('Inserisci il numero ordine'); return } setStep(3) }} style={btnPrimary}>Avanti →</button>
            </div>
          </div>
        )}

        {/* ========== STEP 3 ========== */}
        {step === 3 && (
          <div>
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    SAL — Stati di Avanzamento Lavori
                    <span style={{ background: '#dcfce7', color: '#166534', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>✦ IA disponibile</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                    {pdfFile ? 'Clicca "Analizza PDF" per estrarre i SAL automaticamente, oppure inseriscili a mano.' : 'Nessun PDF caricato. Inserisci i SAL manualmente.'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {pdfFile && (
                    <button onClick={analizzaPDF} disabled={aiLoading} style={{ ...btnPrimary, background: aiLoading ? '#94a3b8' : '#16a34a', borderColor: '#16a34a' }}>
                      {aiLoading ? '⏳ Analisi...' : '✦ Analizza PDF'}
                    </button>
                  )}
                  <button onClick={addSal} style={btnSecondary}>+ Aggiungi SAL</button>
                </div>
              </div>

              {sals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>
                  {aiLoading ? 'Analisi del PDF in corso...' : 'Nessun SAL inserito. Clicca "+ Aggiungi SAL" o analizza il PDF.'}
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 115px 100px 32px', gap: 6, paddingBottom: 6, borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
                    {['%', 'Descrizione SAL', 'Data prevista', 'Importo (€)', ''].map(h => (
                      <span key={h} style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{h}</span>
                    ))}
                  </div>
                  {sals.map((s, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 115px 100px 32px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                      <input value={s.percentuale} onChange={e => updateSal(i, 'percentuale', e.target.value)} placeholder="%" style={{ ...inp, padding: '6px 8px' }}/>
                      <input value={s.descrizione} onChange={e => updateSal(i, 'descrizione', e.target.value)} placeholder="Descrizione" style={{ ...inp, padding: '6px 8px' }}/>
                      <input type="date" value={s.data_prevista} onChange={e => updateSal(i, 'data_prevista', e.target.value)} style={{ ...inp, padding: '6px 8px' }}/>
                      <input value={s.importo} onChange={e => updateSal(i, 'importo', e.target.value)} placeholder="0,00" style={{ ...inp, padding: '6px 8px', fontWeight: 600 }}/>
                      <button onClick={() => setSals(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 8 }}>Totale SAL:</span>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                      {fmt(sals.reduce((acc, s) => acc + Number(s.importo || 0), 0))}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12, padding: '0 2px' }}>
              ℹ️ Tutti i campi sono modificabili in qualsiasi momento anche dopo il salvataggio.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setStep(2)} style={btnSecondary}>← Indietro</button>
              <button onClick={salva} disabled={loading} style={{ ...btnPrimary, background: loading ? '#94a3b8' : '#3b82f6' }}>
                {loading ? 'Salvataggio...' : '✓ Salva progetto'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// Stili inline riutilizzabili
const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a', background: 'white' }
const btnPrimary: React.CSSProperties = { padding: '8px 16px', borderRadius: 7, border: '1px solid #3b82f6', background: '#3b82f6', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, fontWeight: 500, cursor: 'pointer' }
