'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

type TipoCliente = 'persona_fisica' | 'persona_giuridica' | 'pa' | 'associazione'

const TIPO_LABEL: Record<TipoCliente, string> = {
  persona_fisica:   'Persona Fisica',
  persona_giuridica: 'Persona Giuridica',
  pa:               'P.A.',
  associazione:     'Associazione',
}
const TIPO_COLOR: Record<TipoCliente, { bg: string; color: string }> = {
  persona_fisica:    { bg: '#f0fdf4', color: '#166534' },
  persona_giuridica: { bg: '#eff6ff', color: '#1d4ed8' },
  pa:                { bg: '#f5f3ff', color: '#6d28d9' },
  associazione:      { bg: '#fff7ed', color: '#c2410c' },
}

const empty = {
  tipo_cliente: 'persona_giuridica' as TipoCliente,
  nome: '', cognome: '', ragione_sociale: '',
  piva: '', cf: '', referente: '',
  telefono: '', email: '', pec: '',
  indirizzo: '', sdi: '',
}

export default function ClientiPage() {
  const supabase = createClient()
  const [clienti, setClienti] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [editId,      setEditId]      = useState<string | null>(null)
  const [portafogli,  setPortafogli]  = useState<any[]>([])
  const [errore,      setErrore]      = useState<string | null>(null)
  const [portafoglioId, setPortafoglioId] = useState<string>('')

  useEffect(() => {
    supabase.from('portafogli').select('*').order('nome')
      .then(({ data }) => setPortafogli(data || []))
  }, [])

  async function load() {
    const { data } = await supabase
      .from('clienti')
      .select('*, portafogli(nome), progetti(id)')
      .order('ragione_sociale')
    setClienti(data || [])
  }

  useEffect(() => { load() }, [])

  function apriNuovo() {
    setForm({ ...empty })
    setEditId(null)
    setPortafoglioId('')
    setErrore(null)
    setOpen(true)
  }

  function apriModifica(c: any) {
    setForm({
      tipo_cliente: c.tipo_cliente || 'persona_giuridica',
      nome: c.nome || '',
      cognome: c.cognome || '',
      ragione_sociale: c.ragione_sociale || '',
      piva: c.piva || '',
      cf: c.cf || '',
      referente: c.referente || '',
      telefono: c.telefono || '',
      email: c.email || '',
      pec: c.pec || '',
      indirizzo: c.indirizzo || '',
      sdi: c.sdi || '',
    })
    setEditId(c.id)
    setPortafoglioId(c.portafoglio_id || '')
    setErrore(null)
    setOpen(true)
  }

  function chiudi() { setOpen(false); setEditId(null) }

  const isPF = form.tipo_cliente === 'persona_fisica'

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function nomeDisplay(c: any) {
    if (c.tipo_cliente === 'persona_fisica') return `${c.nome || ''} ${c.cognome || ''}`.trim()
    return c.ragione_sociale || '—'
  }

  function avatarLetters(c: any) {
    const n = nomeDisplay(c)
    return n.slice(0, 2).toUpperCase()
  }

  async function salva() {
    setSaving(true)
    const payload: any = {
      tipo_cliente: form.tipo_cliente,
      telefono: form.telefono || null,
      email: form.email || null,
      indirizzo: form.indirizzo || null,
    }

    if (isPF) {
      payload.nome = form.nome || null
      payload.cognome = form.cognome || null
      payload.ragione_sociale = `${form.nome} ${form.cognome}`.trim()
      payload.piva = null
      payload.cf = form.cf || null
      payload.referente = null
      payload.pec = null
      payload.sdi = null
    } else {
      payload.ragione_sociale = form.ragione_sociale || null
      payload.piva = form.piva || null
      payload.cf = form.cf || null
      payload.referente = form.referente || null
      payload.pec = form.pec || null
      payload.sdi = form.sdi || null
    }

    if (portafoglioId) payload.portafoglio_id = portafoglioId

    let error
    if (editId) {
      const res = await supabase.from('clienti').update(payload).eq('id', editId)
      error = res.error
    } else {
      const res = await supabase.from('clienti').insert(payload)
      error = res.error
    }

    setSaving(false)
    if (error) {
      setErrore('Errore: ' + error.message)
      return
    }
    chiudi()
    load()
  }

  async function elimina(id: string) {
    if (!confirm('Eliminare questo cliente? L\'operazione è irreversibile.')) return
    await supabase.from('clienti').delete().eq('id', id)
    load()
  }

  return (
    <>
      <Topbar title="Clienti" subtitle="Anagrafica clienti" />
      <div style={{ padding: '20px 24px' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button onClick={apriNuovo} style={btnPrimary}>+ Nuovo cliente</button>
        </div>

        {/* Tabella */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Cliente', 'Tipo', 'P.IVA / C.F.', 'Portafoglio', 'Telefono', 'N. Progetti', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clienti.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                  Nessun cliente. Clicca "+ Nuovo cliente" per aggiungerne uno.
                </td></tr>
              )}
              {clienti.map(c => {
                const tipo = (c.tipo_cliente || 'persona_giuridica') as TipoCliente
                const col = TIPO_COLOR[tipo]
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #fafafa', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: col.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: col.color, flexShrink: 0 }}>
                          {avatarLetters(c)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{nomeDisplay(c)}</div>
                          {c.email && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{c.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: col.bg, color: col.color }}>
                        {TIPO_LABEL[tipo]}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{c.piva || c.cf || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{c.portafogli?.nome || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{c.telefono || '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.progetti?.length || 0}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => apriModifica(c)} style={btnIconEdit}>✏</button>
                        <button onClick={() => elimina(c.id)} style={btnIconDel}>🗑</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== MODAL ===== */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Overlay */}
          <div onClick={chiudi} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)' }}/>
          {/* Pannello */}
          <div style={{ position: 'relative', background: 'white', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>

            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{editId ? 'Modifica cliente' : 'Nuovo cliente'}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Seleziona il tipo e compila i dati</div>
              </div>
              <button onClick={chiudi} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: 20 }}>

              {/* Portafoglio */}
              {portafogli.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Portafoglio</label>
                  <select
                    value={portafoglioId}
                    onChange={e => setPortafoglioId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}
                  >
                    <option value="">— Nessun portafoglio —</option>
                    {portafogli.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}

              {/* Tipo cliente */}
              <div style={{ marginBottom: 18 }}>
                <label style={lbl}>Tipo cliente *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                  {(Object.entries(TIPO_LABEL) as [TipoCliente, string][]).map(([val, label]) => {
                    const active = form.tipo_cliente === val
                    const col = TIPO_COLOR[val]
                    return (
                      <div key={val} onClick={() => set('tipo_cliente', val)} style={{
                        border: active ? `2px solid ${col.color}` : '1px solid #e2e8f0',
                        background: active ? col.bg : 'white',
                        borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                        transition: 'all .1s',
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? col.color : '#cbd5e1', flexShrink: 0 }}/>
                        <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? col.color : '#475569' }}>{label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* FORM Persona Fisica */}
              {isPF && (
                <>
                  <div style={row2}>
                    <Field label="Nome *" value={form.nome} onChange={v => set('nome', v)} placeholder="Mario" />
                    <Field label="Cognome *" value={form.cognome} onChange={v => set('cognome', v)} placeholder="Rossi" />
                  </div>
                  <div style={row2}>
                    <Field label="Codice Fiscale" value={form.cf} onChange={v => set('cf', v)} placeholder="RSSMRA80A01H501Z" />
                    <Field label="Telefono" value={form.telefono} onChange={v => set('telefono', v)} placeholder="+39 000 0000000" />
                  </div>
                  <div style={row1}>
                    <Field label="Email" value={form.email} onChange={v => set('email', v)} placeholder="mario.rossi@email.it" />
                  </div>
                  <div style={row1}>
                    <Field label="Indirizzo" value={form.indirizzo} onChange={v => set('indirizzo', v)} placeholder="Via, numero civico, CAP, Città" />
                  </div>
                </>
              )}

              {/* FORM Tutti gli altri */}
              {!isPF && (
                <>
                  <div style={row1}>
                    <Field label="Ragione Sociale *" value={form.ragione_sociale} onChange={v => set('ragione_sociale', v)} placeholder="Es. Comune di Treviso" />
                  </div>
                  <div style={row2}>
                    <Field label="P.IVA" value={form.piva} onChange={v => set('piva', v)} placeholder="IT00000000000" />
                    <Field label="Codice Fiscale" value={form.cf} onChange={v => set('cf', v)} placeholder="00000000000" />
                  </div>
                  <div style={row2}>
                    <Field label="Referente" value={form.referente} onChange={v => set('referente', v)} placeholder="Nome Cognome" />
                    <Field label="Telefono" value={form.telefono} onChange={v => set('telefono', v)} placeholder="+39 000 0000000" />
                  </div>
                  <div style={row2}>
                    <Field label="Email" value={form.email} onChange={v => set('email', v)} placeholder="ufficio@cliente.it" />
                    <Field label="PEC" value={form.pec} onChange={v => set('pec', v)} placeholder="pec@cliente.it" />
                  </div>
                  <div style={row2}>
                    <Field label="Indirizzo" value={form.indirizzo} onChange={v => set('indirizzo', v)} placeholder="Via, n., CAP, Città" />
                    <Field label="Codice SDI" value={form.sdi} onChange={v => set('sdi', v)} placeholder="Es. XXXXXXX" />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', position: 'sticky', bottom: 0, background: 'white' }}>
              {errore && (
                <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, color: '#991b1b' }}>
                  ⚠ {errore}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={chiudi} style={btnSecondary}>Annulla</button>
              <button onClick={salva} disabled={saving} style={{ ...btnPrimary, opacity: saving ? .6 : 1 }}>
                {saving ? 'Salvataggio...' : editId ? '✓ Salva modifiche' : '✓ Crea cliente'}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---- Componente campo ----
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a', background: 'white', boxSizing: 'border-box' }} />
    </div>
  )
}

// ---- Stili ----
const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }
const row1: React.CSSProperties = { marginBottom: 12 }
const btnPrimary: React.CSSProperties = { padding: '8px 18px', borderRadius: 7, border: '1px solid #1e3a5f', background: '#1e3a5f', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, fontWeight: 500, cursor: 'pointer' }
const btnIconEdit: React.CSSProperties = { padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 11, cursor: 'pointer' }
const btnIconDel: React.CSSProperties = { padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', fontSize: 11, cursor: 'pointer' }
