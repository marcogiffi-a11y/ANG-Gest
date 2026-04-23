'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({ progetti: 0, salSospeso: 0, daFatturare: 0, valore: 0 })
  const [progetti, setProgetti] = useState<any[]>([])
  const [salUrgenti, setSalUrgenti] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: pr } = await supabase
        .from('progetti')
        .select('*, clienti(ragione_sociale, portafogli(nome))')
        .eq('stato', 'attivo')
        .order('created_at', { ascending: false })
        .limit(5)

      const { data: salData } = await supabase
        .from('sal')
        .select('*, progetti(numero_ordine, clienti(ragione_sociale))')
        .in('stato', ['in_attesa', 'da_emettere'])
        .order('data_prevista', { ascending: true })
        .limit(5)

      const { data: tuttiPr } = await supabase.from('progetti').select('importo_netto, stato')
      const totale = tuttiPr?.reduce((s, p) => s + (p.importo_netto || 0), 0) || 0
      const attivi = tuttiPr?.filter(p => p.stato === 'attivo').length || 0
      const daFatt = salData?.filter(s => s.stato === 'da_emettere').length || 0

      setStats({ progetti: attivi, salSospeso: salData?.length || 0, daFatturare: daFatt, valore: totale })
      setProgetti(pr || [])
      setSalUrgenti((salData || []).filter(s => s.stato === 'da_emettere').slice(0, 3))
    }
    load()
  }, [])

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <>
      <Topbar title="Dashboard" subtitle="Panoramica generale" />
      <div style={{ padding: '20px 24px' }}>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Progetti attivi', value: stats.progetti, sub: 'In corso' },
            { label: 'SAL in sospeso', value: stats.salSospeso, sub: 'Da gestire' },
            { label: 'Da fatturare', value: stats.daFatturare, sub: 'Azioni richieste' },
            { label: 'Valore portafoglio', value: fmt(stats.valore), sub: 'Totale ordini' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e5e2' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
          {/* Ultimi progetti */}
          <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Ultimi progetti</div>
              <Link href="/progetti" style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none' }}>Vedi tutti →</Link>
            </div>
            {progetti.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 20 }}>Nessun progetto ancora. <Link href="/ordine/nuovo" style={{ color: '#3b82f6' }}>Crea il primo →</Link></div>}
            {progetti.map(p => (
              <Link key={p.id} href={`/progetti/${p.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: '1px solid #f1f1ef', borderRadius: 8, marginBottom: 5, cursor: 'pointer', background: 'white' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#1d4ed8', flexShrink: 0 }}>
                  {(p.clienti?.ragione_sociale || '??').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{p.clienti?.ragione_sociale}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{p.clienti?.portafogli?.nome} · {p.numero_ordine}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{fmt(p.importo_netto)}</div>
              </Link>
            ))}
          </div>

          {/* SAL urgenti + nuovo */}
          <div>
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>SAL da emettere</div>
              {salUrgenti.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>Nessun SAL urgente 🎉</div>}
              {salUrgenti.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{s.progetti?.clienti?.ragione_sociale} — SAL {s.numero}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.data_prevista ? new Date(s.data_prevista).toLocaleDateString('it-IT') : '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{fmt(s.importo)}</div>
                    <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>Da emettere</span>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/ordine/nuovo" style={{ textDecoration: 'none', display: 'block', background: '#3b82f6', color: 'white', borderRadius: 10, padding: '14px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
              + Nuovo ordine
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
