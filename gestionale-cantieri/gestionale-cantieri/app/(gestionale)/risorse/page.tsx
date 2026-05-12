'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

export default function RisorsePage() {
  const supabase = createClient()

  const [risorse,        setRisorse]        = useState<any[]>([])
  const [tipologie,      setTipologie]      = useState<any[]>([])
  const [sottoServizi,   setSottoServizi]   = useState<Record<string, any[]>>({})
  const [openTip,        setOpenTip]        = useState<Record<string, boolean>>({})
  const [nuovaRisorsa,   setNuovaRisorsa]   = useState('')
  const [nuovaTipologia, setNuovaTipologia] = useState('')
  const [nuovoSotto,     setNuovoSotto]     = useState<Record<string, string>>({})
  const [loadingR,       setLoadingR]       = useState(true)
  const [loadingT,       setLoadingT]       = useState(true)
  const [savingR,        setSavingR]        = useState(false)
  const [savingT,        setSavingT]        = useState(false)

  useEffect(() => {
    fetchRisorse()
    fetchTipologieESotto()
  }, [])

  async function fetchRisorse() {
    setLoadingR(true)
    const { data } = await supabase.from('risorse').select('*').order('nome')
    setRisorse(data || [])
    setLoadingR(false)
  }

  async function fetchTipologieESotto() {
    setLoadingT(true)
    const { data: tips }  = await supabase.from('tipologie_servizio').select('*').order('nome')
    const { data: sotto } = await supabase.from('sotto_servizi').select('*').order('nome')
    setTipologie(tips || [])
    const map: Record<string, any[]> = {}
    ;(tips || []).forEach((t: any) => { map[t.id] = [] })
    ;(sotto || []).forEach((s: any) => { if (map[s.tipologia_id]) map[s.tipologia_id].push(s) })
    setSottoServizi(map)
    setLoadingT(false)
  }

  async function addRisorsa() {
    if (!nuovaRisorsa.trim()) return
    setSavingR(true)
    await supabase.from('risorse').insert({ nome: nuovaRisorsa.trim() })
    setNuovaRisorsa('')
    await fetchRisorse()
    setSavingR(false)
  }

  async function deleteRisorsa(id: string) {
    await supabase.from('risorse').delete().eq('id', id)
    await fetchRisorse()
  }

  async function addTipologia() {
    if (!nuovaTipologia.trim()) return
    setSavingT(true)
    await supabase.from('tipologie_servizio').insert({ nome: nuovaTipologia.trim() })
    setNuovaTipologia('')
    await fetchTipologieESotto()
    setSavingT(false)
  }

  async function deleteTipologia(id: string) {
    await supabase.from('tipologie_servizio').delete().eq('id', id)
    await fetchTipologieESotto()
  }

  async function addSottoServizio(tipologiaId: string) {
    const nome = (nuovoSotto[tipologiaId] || '').trim()
    if (!nome) return
    await supabase.from('sotto_servizi').insert({ tipologia_id: tipologiaId, nome })
    setNuovoSotto(p => ({ ...p, [tipologiaId]: '' }))
    await fetchTipologieESotto()
  }

  async function deleteSottoServizio(id: string) {
    await supabase.from('sotto_servizi').delete().eq('id', id)
    await fetchTipologieESotto()
  }

  function toggleTip(id: string) {
    setOpenTip(p => ({ ...p, [id]: !p[id] }))
  }

  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: '20px 24px'
  }
  const inpStyle: React.CSSProperties = {
    flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12
  }

  return (
    <>
      <Topbar title="Risorse e Servizi" subtitle="Gestisci risorse e tipologie di servizio" />
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* RIGA 1 */}
        <div style={{ display: 'flex', gap: 20 }}>

          {/* RISORSE */}
          <div style={{ ...cardStyle, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>🔧 Risorse</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={nuovaRisorsa} onChange={e => setNuovaRisorsa(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRisorsa()} placeholder="Nome risorsa..." style={inpStyle} />
              <button onClick={addRisorsa} disabled={savingR || !nuovaRisorsa.trim()} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#6ab04c', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingR || !nuovaRisorsa.trim() ? 0.5 : 1 }}>+ Aggiungi</button>
            </div>
            {loadingR
              ? <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>Caricamento...</div>
              : risorse.length === 0
                ? <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>Nessuna risorsa inserita</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {risorse.map(r => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 7, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 12, color: '#1e3a5f', fontWeight: 500 }}>{r.nome}</span>
                        <button onClick={() => deleteRisorsa(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '0 4px', lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
            }
          </div>

          {/* TIPOLOGIE */}
          <div style={{ ...cardStyle, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>🏷️ Tipologia di Servizio</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={nuovaTipologia} onChange={e => setNuovaTipologia(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTipologia()} placeholder="Nome tipologia servizio..." style={inpStyle} />
              <button onClick={addTipologia} disabled={savingT || !nuovaTipologia.trim()} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#1e3a5f', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingT || !nuovaTipologia.trim() ? 0.5 : 1 }}>+ Aggiungi</button>
            </div>
            {loadingT
              ? <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>Caricamento...</div>
              : tipologie.length === 0
                ? <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>Nessuna tipologia inserita</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {tipologie.map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 7, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 12, color: '#1e3a5f', fontWeight: 500 }}>{t.nome}</span>
                        <button onClick={() => deleteTipologia(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '0 4px', lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
            }
          </div>
        </div>

        {/* RIGA 2: Sotto-servizi */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>🔖 Sotto-servizi per tipologia</div>

          {loadingT ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>Caricamento...</div>
          ) : tipologie.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>Aggiungi prima una tipologia di servizio.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tipologie.map(t => {
                const isOpen = !!openTip[t.id]
                const subs   = sottoServizi[t.id] || []
                return (
                  <div key={t.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                    <div onClick={() => toggleTip(t.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: '#f8fafc', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e3a5f' }}>{t.nome}</span>
                        {subs.length > 0 && (
                          <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 20, background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}>{subs.length}</span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: '#94a3b8', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
                    </div>

                    {isOpen && (
                      <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e7eb', background: 'white' }}>
                        {subs.length === 0 && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>Nessun sotto-servizio ancora.</div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: subs.length > 0 ? 10 : 0 }}>
                          {subs.map((s: any) => (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1e3a5f', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: '#334155', fontWeight: 500 }}>{s.nome}</span>
                              </div>
                              <button onClick={() => deleteSottoServizio(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>×</button>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            value={nuovoSotto[t.id] || ''}
                            onChange={e => setNuovoSotto(p => ({ ...p, [t.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && addSottoServizio(t.id)}
                            placeholder="Aggiungi sotto-servizio..."
                            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11 }}
                          />
                          <button
                            onClick={() => addSottoServizio(t.id)}
                            disabled={!(nuovoSotto[t.id] || '').trim()}
                            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#6ab04c', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: !(nuovoSotto[t.id] || '').trim() ? 0.5 : 1 }}
                          >
                            + Aggiungi
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </>
  )
}
