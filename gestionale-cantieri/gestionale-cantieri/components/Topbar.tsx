'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const [email, setEmail] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email || '')
    })
  }, [])

  const initials = email ? email.slice(0, 2).toUpperCase() : 'AM'

  return (
    <header style={{
      height: 52, background: 'white', borderBottom: '1px solid #e5e5e2',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', position: 'sticky', top: 0, zIndex: 40
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#94a3b8' }}>{subtitle}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px',
          background: '#f1f5f9', borderRadius: 20, fontSize: 11, color: '#475569', cursor: 'default'
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', background: '#1e3a5f',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700
          }}>{initials}</div>
          {email || 'Utente'}
        </div>
      </div>
    </header>
  )
}
