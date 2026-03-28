'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const GOLD = '#c9a84c'
const panel = { background:'rgba(18,14,4,0.92)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:20, backdropFilter:'blur(12px)' } as const
const inp = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.22)', borderRadius:12, padding:'11px 14px', color:'#e8d5a3', fontSize:14, outline:'none', width:'100%' } as const
const btn = (active=true) => ({ padding:'12px 24px', borderRadius:12, border:`1px solid ${active?GOLD:'rgba(201,168,76,0.2)'}`, background:active?'linear-gradient(135deg,#3d2a00,#6b4a0a,#3d2a00)':'transparent', color:active?'#f0d080':'#5a4820', cursor:active?'pointer':'not-allowed', fontSize:14, fontWeight:600, letterSpacing:'0.04em', width:'100%', boxShadow:active?'0 2px 16px rgba(201,168,76,0.25)':'none', transition:'all 0.18s' })

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode]         = useState<'login'|'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleGoogle() {
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' }
      }
    })
    if (err) setError(err.message)
    setLoading(false)
  }

  async function handleSubmit() {
    setError(''); setLoading(true)
    try {
      if (mode === 'register') {
        if (!username.trim()) { setError('Введите никнейм'); setLoading(false); return }
        if (username.length < 3) { setError('Никнейм минимум 3 символа'); setLoading(false); return }
        const { error: err } = await supabase.auth.signUp({
          email, password,
          options: { data: { username: username.trim() } }
        })
        if (err) throw err
        const returnUrl = sessionStorage.getItem('returnUrl') || '/'
        sessionStorage.removeItem('returnUrl')
        router.push(returnUrl)
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        const returnUrl = sessionStorage.getItem('returnUrl') || '/'
        sessionStorage.removeItem('returnUrl')
        router.push(returnUrl)
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка входа')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, position:'relative' }}>
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
        {[...Array(5)].map((_,i)=>(
          <div key={i} style={{ position:'absolute', bottom:-60, left:`${10+i*18}%`, width:`${60+i*20}px`, height:`${60+i*20}px`, background:'radial-gradient(circle,rgba(201,168,76,0.06) 0%,transparent 70%)', borderRadius:'50%', animation:`smokeRise ${7+i*0.8}s ${i*1.4}s infinite ease-in` }}/>
        ))}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#c9a84c,transparent)', opacity:0.5 }}/>
      </div>

      <div style={{ ...panel, padding:'36px 28px', width:'100%', maxWidth:400, position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:46, fontWeight:700, letterSpacing:8, background:'linear-gradient(180deg,#f5e070,#c9a84c,#7a5010)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 18px rgba(201,168,76,0.4))' }}>
            WHAN
          </div>
          <div style={{ fontSize:10, color:'rgba(201,168,76,0.4)', letterSpacing:3, marginTop:4 }}>by Milakhin Studio</div>
        </div>

        {/* Google button */}
        <button onClick={handleGoogle} disabled={loading} style={{ width:'100%', padding:'13px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, border:'1px solid rgba(201,168,76,0.25)', background:'rgba(255,255,255,0.05)', color:'#e8d5a3', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:16, transition:'all 0.18s' }}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Войти через Google
        </button>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ flex:1, height:1, background:'rgba(201,168,76,0.15)' }}/>
          <div style={{ fontSize:11, color:'rgba(201,168,76,0.3)' }}>или email</div>
          <div style={{ flex:1, height:1, background:'rgba(201,168,76,0.15)' }}/>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:20, background:'rgba(255,255,255,0.03)', borderRadius:12, padding:4 }}>
          {(['login','register'] as const).map(m=>(
            <button key={m} onClick={()=>{setMode(m);setError('')}} style={{ flex:1, padding:'9px', borderRadius:10, border:'none', background:mode===m?'linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.08))':'transparent', color:mode===m?GOLD:'rgba(201,168,76,0.4)', fontSize:13, fontWeight:mode===m?700:400, transition:'all 0.18s', cursor:'pointer', fontFamily:'inherit' }}>
              {m==='login'?'Войти':'Регистрация'}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {mode==='register' && (
            <input style={inp} placeholder="Никнейм (от 3 символов)" value={username} onChange={e=>setUsername(e.target.value)}/>
          )}
          <input style={inp} placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
          <input style={inp} placeholder="Пароль" type="password" value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleSubmit()}/>

          {error && <div style={{ fontSize:12, color:'#e74c3c', textAlign:'center' }}>{error}</div>}

          <button onClick={handleSubmit} disabled={loading} style={btn(!loading)}>
            {loading ? '...' : mode==='login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </div>

        <div style={{ textAlign:'center', marginTop:20, fontSize:11, color:'rgba(201,168,76,0.3)', lineHeight:1.7 }}>
          🪔 Твой MMR и статистика сохраняются<br/>на всех устройствах через аккаунт
        </div>
      </div>

      <style>{`@keyframes smokeRise{0%{transform:translateY(0) scale(1);opacity:0}20%{opacity:1}100%{transform:translateY(-80vh) scale(3);opacity:0}}`}</style>
    </div>
  )
}
