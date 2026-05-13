'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createClient as createClientBrowser } from '@supabase/supabase-js'
import Topbar from '@/components/Topbar'

const MATERIALI_STATI = ['Da definire', 'In ordine', 'Ricevuti', 'In cantiere']

const supabaseCantieri = createClientBrowser(
  'https://bfcfgxpkwmlhvjhegmxv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmY2ZneHBrd21saHZqaGVnbXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTM5NzIsImV4cCI6MjA5Mjg2OTk3Mn0.PbwbpCklqiZv_rrsCjATxc56rNCNy_s-cXSideAMY0Y'
)

export default function CantierePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [progetto,      setProgetto]      = useState<any>(null)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [squadre,       setSquadre]       = useState<any[]>([])
  const [cantiereApp,   setCantiereApp]   = useState<any>(null)
  const [appLoading,    setAppLoading]    = useState(false)
  const [appMsg,        setAppMsg]        = useState('')

  // Campi editabili
  const [potenza,   setPotenza]   = useState('')
  const [accumulo,  setAccumulo]  = useState('')
  const [squadraId, setSquadraId] = useState('')
  const [checklist, setChecklist] = useState({
    sopralluogo:        false,
    materiali_ordinati: false,
    materiali_stato:    null as string | null,
    posa_impianto:      false,
    collaudo_impianto:  false,
  })

  useEffect(() => {
    // Carica progetto da ANG Gest
    supabase
      .from('progetti')
      .select('*, clienti(ragione_sociale, nome, cognome, tipo_cliente)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setProgetto(data)
        setPotenza(data.potenza_kwp?.toString() || '')
        setAccumulo(data.accumulo_kwh?.toString() || '')
        setSquadraId(data.squadra_id || '')
        if (data.checklist) setChecklist(prev => ({ ...prev, ...data.checklist }))
        setLoading(false)
      })

    // Carica squadre da athena-cantieri
    supabaseCantieri
      .from('squadre')
      .select('id, codice, referente, ditta')
      .order('codice')
      .then(({ data }) => setSquadre(data || []))

    // Carica cantiere app se esiste
    supabaseCantieri
      .from('cantieri')
      .select('*')
      .eq('gest_id', id)
      .single()
      .then(({ data }) => setCantiereApp(data || null))
  }, [id])

  const nomeCliente = (c: any) => {
    if (!c) return '—'
    if (c.tipo_cliente === 'persona_fisica') return `${c.nome || ''} ${c.cognome || ''}`.trim()
    return c.ragione_sociale || '—'
  }

  const avanzamento = () => {
    const items = [
      checklist.sopralluogo,
      checklist.materiali_ordinati,
      !!checklist.materiali_stato && checklist.materiali_stato !== 'Da definire',
      checklist.posa_impianto,
      checklist.collaudo_impianto,
    ]
    const done = items.filter(Boolean).length
    return Math.round((done / items.length) * 100)
  }

  async function salva() {
    setSaving(true)
    const squadraSelezionata = squadre.find(s => s.id.toString() === squadraId.toString())
    await supabase.from('progetti').update({
      potenza_kwp:  potenza  ? parseFloat(potenza)  : null,
      accumulo_kwh: accumulo ? parseFloat(accumulo) : null,
      squadra:      squadraSelezionata?.referente || squadraSelezionata?.codice || null,
      squadra_id:   squadraId || null,
      checklist,
    }).eq('id', id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function inserisciInApp() {
    setAppLoading(true)
    setAppMsg('')
    const nome = nomeCliente(progetto?.clienti)
    const squadraSelezionata = squadre.find(s => s.id.toString() === squadraId.toString())
    console.log('🚀 inserisciInApp chiamata', { nome, id, cantiereApp, squadraSelezionata })

    if (cantiereApp) {
      // Aggiorna cantiere esistente
      console.log('🔄 Aggiornamento cantiere esistente...')
      const { data: updData, error } = await supabaseCantieri
        .from('cantieri')
        .update({
          cliente:    nome,
          kw:         potenza  || null,
          acc:        accumulo || null,
          squadra_id: squadraSelezionata?.id || null,
          gest_id:    id,
        })
        .eq('gest_id', id)
        .select()
      console.log('📦 Risultato update:', updData, 'Errore:', error)
      if (error) { setAppMsg('❌ Errore aggiornamento: ' + error.message) }
      else { setAppMsg('✅ Cantiere aggiornato in ANG Cantieri!'); setCantiereApp({ ...cantiereApp, kw: potenza, acc: accumulo }) }
    } else {
      // Crea nuovo cantiere
      const { data, error } = await supabaseCantieri
        .from('cantieri')
        .insert([{
          cliente:    nome,
          kw:         potenza  || null,
          acc:        accumulo || null,
          squadra_id: squadraSelezionata?.id || null,
          gest_id:    id,
          check_list:    [false, false, false, false, false],
          disponibilita: [],
          installazioni: [],
        }])
        .select()
        .single()
      if (error) { setAppMsg('❌ Errore creazione: ' + error.message) }
      else { setAppMsg('✅ Cantiere inserito in ANG Cantieri!'); setCantiereApp(data) }
    }
    setAppLoading(false)
    setTimeout(() => setAppMsg(''), 3000)
  }

  async function eliminaDaApp() {
    if (!cantiereApp) { setAppMsg('⚠️ Cantiere non presente in ANG Cantieri'); return }
    if (!confirm(`Eliminare "${nomeCliente(progetto?.clienti)}" da ANG Cantieri?\nQuesta operazione è irreversibile.`)) return
    setAppLoading(true)
    const { error } = await supabaseCantieri.from('cantieri').delete().eq('gest_id', id)
    if (error) { setAppMsg('❌ Errore eliminazione: ' + error.message) }
    else { setAppMsg('✅ Cantiere eliminato da ANG Cantieri'); setCantiereApp(null) }
    setAppLoading(false)
    setTimeout(() => setAppMsg(''), 3000)
  }

  const pct = avanzamento()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8' }}>
      Caricamento...
    </div>
  )

  return (
    <>
      <Topbar
        title={nomeCliente(progetto?.clienti)}
        subtitle={`Cantiere · ${progetto?.numero_ordine || ''}`}
      />

      <div style={{ padding: '20px 24px', maxWidth: 680 }}>

        {/* Stato ANG Cantieri */}
        <div style={{
          background: cantiereApp ? '#f0fdf4' : '#fff7ed',
          border: `1px solid ${cantiereApp ? '#bbf7d0' : '#fed7aa'}`,
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cantiereApp ? '#6ab04c' : '#f59e0b' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: cantiereApp ? '#166534' : '#92400e' }}>
              {cantiereApp ? '✓ Presente in ANG Cantieri' : '○ Non presente in ANG Cantieri'}
            </span>
          </div>
          {appMsg && <span style={{ fontSize: 12, fontWeight: 600, color: appMsg.includes('❌') ? '#991b1b' : '#166534' }}>{appMsg}</span>}
        </div>

        {/* Avanzamento */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '.05em' }}>Avanzamento</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#166534' : '#1d4ed8' }}>{pct}%</span>
          </div>
          <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#6ab04c' : '#1d4ed8', borderRadius: 4, transition: 'width .3s' }} />
          </div>
        </div>

        {/* CHECKLIST */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Checklist</div>
          <CheckRow label="Sopralluogo effettuato" checked={checklist.sopralluogo} onChange={v => setChecklist({ ...checklist, sopralluogo: v })} />
          <CheckRow label="Materiali ordinati" checked={checklist.materiali_ordinati} onChange={v => setChecklist({ ...checklist, materiali_ordinati: v })} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderRadius: 4, background: '#f8fafc', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#374151' }}>Materiali</span>
            </div>
            <select
              value={checklist.materiali_stato || 'Da definire'}
              onChange={e => setChecklist({ ...checklist, materiali_stato: e.target.value })}
              style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', color: '#64748b', background: '#f8fafc', cursor: 'pointer' }}
            >
              {MATERIALI_STATI.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <CheckRow label="Posa impianto" checked={checklist.posa_impianto} onChange={v => setChecklist({ ...checklist, posa_impianto: v })} />
          <CheckRow label="Collaudo impianto" checked={checklist.collaudo_impianto} onChange={v => setChecklist({ ...checklist, collaudo_impianto: v })} last />
        </div>

        {/* DETTAGLI */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Dettagli</div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Potenza</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <input type="number" step="0.01" value={potenza} onChange={e => setPotenza(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', border: 'none', outline: 'none', fontSize: 14, fontWeight: 600 }} placeholder="0.00" />
                <span style={{ padding: '0 12px', fontSize: 12, color: '#94a3b8', borderLeft: '1px solid #e2e8f0', background: '#f8fafc' }}>kWp</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Accumulo</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <input type="number" step="0.01" value={accumulo} onChange={e => setAccumulo(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', border: 'none', outline: 'none', fontSize: 14, fontWeight: 600 }} placeholder="0.00" />
                <span style={{ padding: '0 12px', fontSize: 12, color: '#94a3b8', borderLeft: '1px solid #e2e8f0', background: '#f8fafc' }}>kWh</span>
              </div>
            </div>
          </div>

          {/* Squadra dropdown */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Squadra</label>
            <select
              value={squadraId}
              onChange={e => setSquadraId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#1e3a5f', background: 'white', cursor: 'pointer' }}
            >
              <option value="">— Nessuna squadra —</option>
              {squadre.map(s => (
                <option key={s.id} value={s.id}>
                  {s.codice}{s.referente ? ` · ${s.referente}` : ''}{s.ditta ? ` (${s.ditta})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Salva modifiche */}
          <button onClick={salva} disabled={saving} style={{
            width: '100%', padding: '12px', borderRadius: 8, border: 'none',
            background: saved ? '#6ab04c' : '#1e3a5f', color: 'white',
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background .3s',
          }}>
            {saving ? '⏳ Salvataggio...' : saved ? '✓ Salvato!' : '💾 Salva modifiche'}
          </button>
        </div>

        {/* ANG CANTIERI ACTIONS */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>ANG Cantieri App</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={inserisciInApp}
              disabled={appLoading}
              style={{
                flex: 1, padding: '12px', borderRadius: 8, border: 'none',
                background: appLoading ? '#94a3b8' : '#6ab04c',
                color: 'white', fontSize: 13, fontWeight: 700, cursor: appLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {appLoading ? '⏳...' : cantiereApp ? '🔄 Aggiorna in ANG Cantieri' : '📲 Inserisci in ANG Cantieri'}
            </button>
            <button
              onClick={eliminaDaApp}
              disabled={appLoading || !cantiereApp}
              style={{
                flex: 1, padding: '12px', borderRadius: 8,
                border: '1px solid #fecaca',
                background: !cantiereApp ? '#f1f5f9' : '#fee2e2',
                color: !cantiereApp ? '#94a3b8' : '#991b1b',
                fontSize: 13, fontWeight: 700, cursor: (!cantiereApp || appLoading) ? 'not-allowed' : 'pointer',
              }}
            >
              🗑 Elimina da ANG Cantieri
            </button>
          </div>
        </div>

        <button onClick={() => router.back()} style={{ fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ← Torna alla lista
        </button>
      </div>
    </>
  )
}

function CheckRow({ label, checked, onChange, last }: { label: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <div onClick={() => onChange(!checked)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: last ? 'none' : '1px solid #f1f5f9', cursor: 'pointer' }}>
      <div style={{
        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        background: checked ? '#6ab04c' : 'white',
        border: checked ? '2px solid #6ab04c' : '2px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
      }}>
        {checked && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
      </div>
      <span style={{ fontSize: 13, color: checked ? '#94a3b8' : '#374151', textDecoration: checked ? 'line-through' : 'none' }}>{label}</span>
    </div>
  )
}
