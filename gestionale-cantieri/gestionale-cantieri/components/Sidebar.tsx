'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabasePWA = createSupabaseClient(
  'https://bfcfgxpkwmlhvjhegmxv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmY2ZneHBrd21saHZqaGVnbXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTM5NzIsImV4cCI6MjA5Mjg2OTk3Mn0.PbwbpCklqiZv_rrsCjATxc56rNCNy_s-cXSideAMY0Y'
)
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useEffect, useState } from 'react'

const navItems = [
  { section: 'Principale' },
  { href: '/dashboard',           label: 'Dashboard',             icon: '▦' },
  { href: '/richieste-offerta',   label: 'Richieste di Offerta',  icon: '📲', badgeKey: 'richieste' },
  { href: '/preventivi',          label: 'Preventivi',            icon: '📝' },
  { href: '/ordini',              label: 'Ordini',                 icon: '📄' },
  { href: '/progetti',            label: 'Progetti',              icon: '≡' },
  { href: '/fatture',             label: 'Fatture & SAL',         icon: '📋', dot: true },
  { href: '/scadenze',            label: 'Scadenze',              icon: '📅' },
  { section: 'Inserimento' },
  { href: '/preventivo/nuovo',    label: '+ Nuovo preventivo',    icon: '+' },
  { href: '/ordine/nuovo',        label: '+ Nuovo ordine',        icon: '+' },
  { href: '/clienti',             label: 'Clienti',               icon: '👤' },
  { href: '/portafogli',          label: 'Portafogli',            icon: '💼' },
  { href: '/documenti',           label: 'Documenti',             icon: '📁' },
  { section: 'Configurazione' },
  { href: '/legenda',             label: 'Legenda servizi',       icon: '★' },
  { href: '/utenti',              label: 'Utenti',                icon: '👥' },
  { href: '/impostazioni',        label: 'Impostazioni',          icon: '⚙' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  // Badge: contatore richieste "nuova" non ancora viste
  const [richiesteNuove, setRichiesteNuove] = useState(0)

  useEffect(() => {
    async function loadBadge() {
      const { count } = await supabasePWA
        .from('richieste_offerta')
        .select('*', { count: 'exact', head: true })
        .eq('stato', 'nuova')
      setRichiesteNuove(count ?? 0)
    }
    loadBadge()

    // Aggiorna ogni 60 secondi per rilevare nuove richieste
    const interval = setInterval(loadBadge, 60_000)
    return () => clearInterval(interval)
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const badges: Record<string, number> = {
    richieste: richiesteNuove,
  }

  return (
    <aside style={{
      width: 200, background: '#1e3a5f', display: 'flex', flexDirection: 'column',
      flexShrink: 0, height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 50,
      overflowY: 'auto'
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Image src="/logo.jpg" alt="Athena Next Gen" width={80} height={80} style={{ borderRadius: 8, marginBottom: 6, objectFit: 'contain', background: 'white', padding: 4 }} />
        <div style={{ fontSize: 12, fontWeight: 800, color: 'white', textAlign: 'center', letterSpacing: '.02em' }}>ANG Gest</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Athena Next Gen S.r.l.</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingBottom: 16 }}>
        {navItems.map((item, i) => {
          if ('section' in item) {
            return (
              <div key={i} style={{
                padding: '14px 16px 3px', fontSize: 9, textTransform: 'uppercase',
                letterSpacing: '.1em', color: 'rgba(255,255,255,0.3)'
              }}>{item.section}</div>
            )
          }

          const active = pathname === item.href ||
            (item.href !== '/dashboard' &&
             item.href !== '/preventivo/nuovo' &&
             item.href !== '/ordine/nuovo' &&
             pathname.startsWith(item.href))

          const badgeCount = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0

          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '8px 16px',
              fontSize: 12, color: active ? 'white' : 'rgba(255,255,255,0.55)',
              textDecoration: 'none',
              background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderLeft: active ? '3px solid #6ab04c' : '3px solid transparent',
              transition: 'all .12s'
            }}>
              <span style={{ fontSize: 13, opacity: active ? 1 : 0.6 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>

              {/* Badge richieste nuove */}
              {badgeCount > 0 && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: '#ef4444', color: 'white',
                  fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 5px'
                }}>{badgeCount}</span>
              )}

              {/* Dot SAL */}
              {item.dot && !badgeCount && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={logout} style={{
          width: '100%', padding: '7px 12px', borderRadius: 6, border: 'none',
          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
          fontSize: 11, cursor: 'pointer', textAlign: 'left'
        }}>
          ⎋ Esci
        </button>
      </div>
    </aside>
  )
}
