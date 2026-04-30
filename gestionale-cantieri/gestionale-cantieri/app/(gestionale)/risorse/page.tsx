'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

export default function RisorsePage() {
  const supabase = createClient()

  const [risorse, setRisorse] = useState<any[]>([])
  const [tipologie, setTipologie] = useState<any[]>([])
  const [nuovaRisorsa, setNuovaRisorsa] = useState('')
  const [nuovaTipologia, setNuovaTipologia] = useState('')
  const [loadingR, setLoadingR] = useState(true)
  const [loadingT, setLoadingT] = useState(true)
  const [savingR, setSavingR] = useState(false)
  const [savingT, setSavingT] = useState(false)

  useEffect(() => {
    fetchRisorse()
    fetchTipologie()
  }, [])

  async function fetchRisorse() {
    setLoadingR(true)
    const { data } = await supabase.from('risorse').select('*').order('nome')
    setRisorse(data || [])
    setLoadingR(false)
  }

  async function fetchTipologie() {
    setLoadingT(true)
    const { data } = await supabase.from('tipologie_servizio').select('*').order('nome')
    setTipologie(data || [])
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
    await fetchTipologie()
    setSavingT(false)
  }

  async function deleteTipologia(id: string) {
    await supabase.from('tipologie_servizio').delete().eq('id', id)
    await fetchTipologie()
  }

  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: '20px 24px'
  }

  return (
    <>
      <Topbar title="Risorse e Servizi" subtitle="Gestisci risorse e tipologie di servizio" />
      <div style={{ padding: '20px 24px', display: 'flex', gap: 20 }}>

        {/* RISORSE */}
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>
            🔧 Risorse
          </div>

          {/* Input aggiunta */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              value={nuovaRisorsa}
              onChange={e => setNuovaRisorsa(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRisorsa()}
              placeholder="Nome risorsa..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 7,
                border: '1px solid #e2e8f0', fontSize: 12
              }}
            />
            <button
              onClick={addRisorsa}
              disabled={savingR || !nuovaRisorsa.trim()}
              style={{
                padding: '8px 16px', borderRadius: 7, border: 'none',
                background: '#6ab04c', color: 'white', fontSize: 12,
                fontWeight: 600, cursor: 'pointer', opacity: savingR || !nuovaRisorsa.trim() ? 0.5 : 1
              }}
            >
              + Aggiungi
            </button>
          </div>

          {/* Lista */}
          {loadingR ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>Caricamento...</div>
          ) : risorse.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>
              Nessuna risorsa inserita
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {risorse.map(r => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 7, background: '#f8fafc',
                  border: '1px solid #f1f5f9'
                }}>
                  <span style={{ fontSize: 12, color: '#1e3a5f', fontWeight: 500 }}>{r.nome}</span>
                  <button
                    onClick={() => deleteRisorsa(r.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ef4444', fontSize: 14, padding: '0 4px', lineHeight: 1
                    }}
                    title="Elimina"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TIPOLOGIE SERVIZIO */}
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>
            🏷️ Tipologia di Servizio
          </div>

          {/* Input aggiunta */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              value={nuovaTipologia}
              onChange={e => setNuovaTipologia(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTipologia()}
              placeholder="Nome tipologia servizio..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 7,
                border: '1px solid #e2e8f0', fontSize: 12
              }}
            />
            <button
              onClick={addTipologia}
              disabled={savingT || !nuovaTipologia.trim()}
              style={{
                padding: '8px 16px', borderRadius: 7, border: 'none',
                background: '#1e3a5f', color: 'white', fontSize: 12,
                fontWeight: 600, cursor: 'pointer', opacity: savingT || !nuovaTipologia.trim() ? 0.5 : 1
              }}
            >
              + Aggiungi
            </button>
          </div>

          {/* Lista */}
          {loadingT ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>Caricamento...</div>
          ) : tipologie.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>
              Nessuna tipologia inserita
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tipologie.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 7, background: '#f8fafc',
                  border: '1px solid #f1f5f9'
                }}>
                  <span style={{ fontSize: 12, color: '#1e3a5f', fontWeight: 500 }}>{t.nome}</span>
                  <button
                    onClick={() => deleteTipologia(t.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ef4444', fontSize: 14, padding: '0 4px', lineHeight: 1
                    }}
                    title="Elimina"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  )
}
