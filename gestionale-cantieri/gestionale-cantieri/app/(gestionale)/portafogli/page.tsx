'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

export default function PortafogliPage() {
  const [portafogli, setPortafogli] = useState<any[]>([])
  const [nuovo, setNuovo] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('portafogli').select('*, clienti(id, ragione_sociale, progetti(importo_netto))').order('nome')
    setPortafogli(data || [])
  }
  useEffect(() => { load() }, [])

  async function crea() {
    if (!nuovo.trim()) return
    setLoading(true)
    await supabase.from('portafogli').insert({ nome: nuovo.trim() })
    setNuovo('')
    await load()
    setLoading(false)
  }

  async function elimina(id: string) {
    if (!confirm('Eliminare questo portafoglio?')) return
    await supabase.from('portafogli').delete().eq('id', id)
    await load()
  }

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <>
      <Topbar title="Portafogli" subtitle="Gestione portafogli clienti" />
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Aggiungi portafoglio</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={nuovo} onChange={e => setNuovo(e.target.value)} placeholder="Nome portafoglio (es. Comuni Veneto)" onKeyDown={e => e.key === 'Enter' && crea()}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}/>
            <button onClick={crea} disabled={loading || !nuovo.trim()} style={{ padding: '8px 18px', borderRadius: 7, background: '#3b82f6', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              + Crea
            </button>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'hidden' }}>
          {portafogli.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 12 }}>Nessun portafoglio ancora. Creane uno sopra!</div>}
          {portafogli.map(p => {
            const clientiCount = p.clienti?.length || 0
            const progetti = p.clienti?.flatMap((c: any) => c.progetti || []) || []
            const valore = progetti.reduce((acc: number, pr: any) => acc + (pr.importo_netto || 0), 0)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💼</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{p.nome}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{clientiCount} clienti · {progetti.length} progetti</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{fmt(valore)}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>valore ordini</div>
                </div>
                <button onClick={() => elimina(p.id)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', fontSize: 11, cursor: 'pointer' }}>🗑</button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
