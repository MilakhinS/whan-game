'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(()=>{
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/')
      } else {
        // Try to exchange code for session
        supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session) {
            router.push('/')
          }
        })
      }
    })
  },[])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0800', color:'#c9a84c', fontFamily:'Georgia,serif', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:32, animation:'spin 1s linear infinite' }}>✦</div>
      <div style={{ fontSize:14, opacity:0.6 }}>Входим в систему…</div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
