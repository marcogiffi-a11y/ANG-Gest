'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleEmail() {
    setLoading(true); setError('')
    const fn = mode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password })
    const { error } = await fn
    if (error) setError(error.message)
    else if (mode === 'signup') setSent(true)
    else window.location.href = '/dashboard'
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/api/auth/callback` },
    })
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#1e3a5f' }}>
      {/* Sfondo decorativo */}
      <div style={{ position:'absolute', inset:0, overflow:'hidden', zIndex:0 }}>
        <div style={{ position:'absolute', top:-100, right:-100, width:400, height:400, borderRadius:'50%', background:'rgba(106,176,76,0.08)'}}/>
        <div style={{ position:'absolute', bottom:-150, left:-100, width:500, height:500, borderRadius:'50%', background:'rgba(255,255,255,0.04)'}}/>
      </div>

      <div style={{ position:'relative', zIndex:1, background:'white', borderRadius:16, padding:'40px 36px', width:400, boxShadow:'0 25px 60px rgba(0,0,0,0.3)' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <Image src="/logo.jpg" alt="Athena Next Gen" width={90} height={90} style={{ objectFit:'contain', marginBottom:10 }}/>
          <div style={{ fontSize:20, fontWeight:800, color:'#1e3a5f' }}>ANG Gest</div>
          <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Athena Next Gen S.r.l.</div>
        </div>

        {sent ? (
          <div style={{ textAlign:'center', color:'#16a34a', fontSize:14, padding:16 }}>
            ✅ Controlla la tua email per confermare la registrazione!
          </div>
        ) : (
          <>
            {/* Google */}
            <button onClick={handleGoogle} style={{
              width:'100%', padding:'10px 16px', borderRadius:8, border:'1px solid #e2e8f0',
              background:'white', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex',
              alignItems:'center', justifyContent:'center', gap:8, marginBottom:16
            }}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.16C6.51 42.62 14.62 48 24 48z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.16C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.16C12.43 13.72 17.74 9.5 24 9.5z"/></svg>
              Accedi con Google
            </button>

            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ flex:1, height:1, background:'#f1f5f9' }}/>
              <span style={{ fontSize:11, color:'#94a3b8' }}>oppure</span>
              <div style={{ flex:1, height:1, background:'#f1f5f9' }}/>
            </div>

            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em', display:'block', marginBottom:4 }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="email@azienda.it"
                style={{ width:'100%', padding:'9px 12px', borderRadius:7, border:'1px solid #e2e8f0', fontSize:13 }}/>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em', display:'block', marginBottom:4 }}>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e=>e.key==='Enter'&&handleEmail()}
                style={{ width:'100%', padding:'9px 12px', borderRadius:7, border:'1px solid #e2e8f0', fontSize:13 }}/>
            </div>

            {error && <div style={{ color:'#dc2626', fontSize:12, marginBottom:12, padding:'8px 12px', background:'#fef2f2', borderRadius:6 }}>{error}</div>}

            <button onClick={handleEmail} disabled={loading} style={{
              width:'100%', padding:'10px 16px', borderRadius:8, border:'none',
              background: loading ? '#94a3b8' : '#1e3a5f', color:'white',
              fontSize:13, fontWeight:700, cursor: loading ? 'default' : 'pointer'
            }}>
              {loading ? 'Attendere...' : mode === 'login' ? 'Accedi' : 'Registrati'}
            </button>

            <div style={{ textAlign:'center', marginTop:14, fontSize:12, color:'#64748b' }}>
              {mode === 'login' ? (
                <>Non hai un account? <span style={{ color:'#6ab04c', cursor:'pointer', fontWeight:700 }} onClick={()=>setMode('signup')}>Registrati</span></>
              ) : (
                <>Hai già un account? <span style={{ color:'#6ab04c', cursor:'pointer', fontWeight:700 }} onClick={()=>setMode('login')}>Accedi</span></>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
