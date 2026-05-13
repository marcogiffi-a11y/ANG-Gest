'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

const MATERIALI_STATI = ['Da definire', 'In ordine', 'Ricevuti', 'In cantiere']

export default function CantierePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [progetto,  setProgetto]  = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  // Campi editabili
  const [potenza,   setPotenza]   = useState('')
  const [accumulo,  setAccumulo]  = useState('')
  const [squadra,   setSquadra]   = useState('')
  const [checklist, setChecklist] = useState({
    sopralluogo:       false,
    materiali_ordinati: false,
    materiali_stato:   null as string | null,
    posa_impianto:     false,
    collaudo_impianto: false,
  })

  useEffect(() => {
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
        setSquadra(data.squadra || '')
        if (data.checklist) setChecklist({ ...checklist, ...data.checklist })
        setLoading(false)
      })
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
    await supabase.from('progetti').update({
      potenza_kwp:  potenza  ? parseFloat(potenza)  : null,
      accumulo_kwh: accumulo ? parseFloat(accumulo) : null,
      squadra:      squadra  || null,
      checklist,
    }).eq('id', id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
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

          {/* Sopralluogo */}
          <CheckRow
            label="Sopralluogo effettuato"
            checked={checklist.sopralluogo}
            onChange={v => setChecklist({ ...checklist, sopralluogo: v })}
          />

          {/* Materiali ordinati */}
          <CheckRow
            label="Materiali ordinati"
            checked={checklist.materiali_ordinati}
            onChange={v => setChecklist({ ...checklist, materiali_ordinati: v })}
          />

          {/* Materiali con stato */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                onClick={() => {}}
                style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderRadius: 4, background: '#f8fafc', flexShrink: 0 }}
              />
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

          {/* Posa impianto */}
          <CheckRow
            label="Posa impianto"
            checked={checklist.posa_impianto}
            onChange={v => setChecklist({ ...checklist, posa_impianto: v })}
          />

          {/* Collaudo impianto */}
          <CheckRow
            label="Collaudo impianto"
            checked={checklist.collaudo_impianto}
            onChange={v => setChecklist({ ...checklist, collaudo_impianto: v })}
            last
          />
        </div>

        {/* DETTAGLI */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Dettagli</div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Potenza</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <input
                  type="number" step="0.01" value={potenza}
                  onChange={e => setPotenza(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', border: 'none', outline: 'none', fontSize: 14, fontWeight: 600 }}
                  placeholder="0.00"
                />
                <span style={{ padding: '0 12px', fontSize: 12, color: '#94a3b8', borderLeft: '1px solid #e2e8f0', background: '#f8fafc' }}>kWp</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Accumulo</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <input
                  type="number" step="0.01" value={accumulo}
                  onChange={e => setAccumulo(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', border: 'none', outline: 'none', fontSize: 14, fontWeight: 600 }}
                  placeholder="0.00"
                />
                <span style={{ padding: '0 12px', fontSize: 12, color: '#94a3b8', borderLeft: '1px solid #e2e8f0', background: '#f8fafc' }}>kWh</span>
              </div>
            </div>
          </div>

          <button
            onClick={salva}
            disabled={saving}
            style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: saved ? '#6ab04c' : '#1e3a5f',
              color: 'white', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background .3s',
            }}
          >
            {saving ? '⏳ Salvataggio...' : saved ? '✓ Salvato!' : '💾 Salva modifiche'}
          </button>

          {/* Squadra */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Squadra</span>
            <input
              value={squadra}
              onChange={e => setSquadra(e.target.value)}
              placeholder="Nome squadra..."
              style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f', border: 'none', outline: 'none', textAlign: 'right', background: 'transparent' }}
            />
          </div>
        </div>

        {/* Torna indietro */}
        <button
          onClick={() => router.back()}
          style={{ fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ← Torna alla lista
        </button>

      </div>
    </>
  )
}

function CheckRow({ label, checked, onChange, last }: { label: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: last ? 'none' : '1px solid #f1f5f9', cursor: 'pointer' }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        background: checked ? '#6ab04c' : 'white',
        border: checked ? '2px solid #6ab04c' : '2px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s',
      }}>
        {checked && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
      </div>
      <span style={{ fontSize: 13, color: checked ? '#94a3b8' : '#374151', textDecoration: checked ? 'line-through' : 'none' }}>{label}</span>
    </div>
  )
}
