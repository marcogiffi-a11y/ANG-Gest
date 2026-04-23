'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

export default function LegendaPage() {
  const [servizi, setServizi] = useState<any[]>([])
  const [nuovo, setNuovo] = useState('')
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('servizi_ingegneria').select('*').order('ordine').then(({ data }) => setServizi(data || []))
  }, [])

  async function aggiungi() {
    if (!nuovo.trim()) return
    const { data } = await supabase.from('servizi_ingegneria').insert({ nome: nuovo.trim(), ordine: servizi.length + 1 }).select().single()
    if (data) { setServizi(prev => [...prev, data]); setNuovo('') }
  }

  async function elimina(id: string) {
    await supabase.from('servizi_ingegneria').delete().eq('id', id)
    setServizi(prev => prev.filter(s => s.id !== id))
  }

  async function aggiornaNome(id: string, nome: string) {
    setServizi(prev => prev.map(s => s.id === id ? { ...s, nome } : s))
  }

  async function salva() {
    await Promise.all(servizi.map(s => supabase.from('servizi_ingegneria').update({ nome: s.nome }).eq('id', s.id)))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <>
      <Topbar title="Legenda servizi" subtitle="Configura i servizi di ingegneria offerti" />
      <div style={{ padding: '20px 24px', maxWidth: 640 }}>
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Servizi di ingegneria</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
            Questi servizi appariranno come opzioni selezionabili durante la creazione di un nuovo ordine.
          </div>
          <div>
            {servizi.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 20 }}>{i + 1}.</span>
                <input value={s.nome} onChange={e => aggiornaNome(s.id, e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}/>
                <button onClick={() => elimina(s.id)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input value={nuovo} onChange={e => setNuovo(e.target.value)} placeholder="Nuovo servizio..." onKeyDown={e => e.key === 'Enter' && aggiungi()}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}/>
            <button onClick={aggiungi} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', fontSize: 12, cursor: 'pointer' }}>+ Aggiungi</button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={salva} style={{ padding: '9px 20px', borderRadius: 7, background: saved ? '#22c55e' : '#3b82f6', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {saved ? '✓ Salvato!' : 'Salva legenda'}
          </button>
        </div>
      </div>
    </>
  )
}
