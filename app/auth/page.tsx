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
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

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
        router.push('/')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        router.push('/')
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка входа')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, position:'relative' }}>
      {/* Smoke */}
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

        {/* Tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:24, background:'rgba(255,255,255,0.03)', borderRadius:12, padding:4 }}>
          {(['login','register'] as const).map(m=>(
            <button key={m} onClick={()=>{setMode(m);setError('')}} style={{ flex:1, padding:'9px', borderRadius:10, border:'none', background:mode===m?'linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.08))':'transparent', color:mode===m?GOLD:'rgba(201,168,76,0.4)', fontSize:13, fontWeight:mode===m?700:400, transition:'all 0.18s' }}>
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
    </div>
  )
}
