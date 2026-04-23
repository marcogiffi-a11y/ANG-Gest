'use client'
import { useState } from 'react'
import Topbar from '@/components/Topbar'

export default function ImpostazioniPage() {
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    nomeAzienda: 'Athena Next Gen S.r.l.',
    piva: '',
    emailAmm: '',
    pec: '',
    indirizzo: '',
    ivaDefault: '22',
    cassaDefault: '4',
  })

  function salva() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }

  return (
    <>
      <Topbar title="Impostazioni" subtitle="Configurazione generale" />
      <div style={{ padding: '20px 24px', maxWidth: 640 }}>
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Dati aziendali</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={lbl}>Nome azienda</label><input value={form.nomeAzienda} onChange={e => setForm(f => ({ ...f, nomeAzienda: e.target.value }))} style={inp}/></div>
            <div><label style={lbl}>P.IVA</label><input value={form.piva} onChange={e => setForm(f => ({ ...f, piva: e.target.value }))} placeholder="IT12345678901" style={inp}/></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={lbl}>Email amministrativa</label><input value={form.emailAmm} onChange={e => setForm(f => ({ ...f, emailAmm: e.target.value }))} placeholder="admin@azienda.it" style={inp}/></div>
            <div><label style={lbl}>PEC</label><input value={form.pec} onChange={e => setForm(f => ({ ...f, pec: e.target.value }))} placeholder="azienda@pec.it" style={inp}/></div>
          </div>
          <div><label style={lbl}>Indirizzo sede</label><input value={form.indirizzo} onChange={e => setForm(f => ({ ...f, indirizzo: e.target.value }))} placeholder="Via Roma 1, 30100 Venezia (VE)" style={inp}/></div>
        </div>

        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Preferenze fiscali predefinite</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>IVA predefinita</label>
              <select value={form.ivaDefault} onChange={e => setForm(f => ({ ...f, ivaDefault: e.target.value }))} style={inp}>
                <option value="22">22%</option>
                <option value="10">10%</option>
                <option value="4">4%</option>
                <option value="Esente">Esente art. 10</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Cassa ingegneri predefinita</label>
              <select value={form.cassaDefault} onChange={e => setForm(f => ({ ...f, cassaDefault: e.target.value }))} style={inp}>
                <option value="4">4%</option>
                <option value="0">0% (non applicabile)</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={salva} style={{ padding: '9px 22px', borderRadius: 7, background: saved ? '#22c55e' : '#3b82f6', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {saved ? '✓ Salvato!' : 'Salva impostazioni'}
          </button>
        </div>
      </div>
    </>
  )
}
