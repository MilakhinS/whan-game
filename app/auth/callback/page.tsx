'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(()=>{
    const url = new URL(window.location.href)
    const error = url.searchParams.get('error')
    const errorDesc = url.searchParams.get('error_description')

    if (error) {
      console.error('OAuth error:', error, errorDesc)
      router.push('/auth')
      return
    }

    // Handle code exchange
    const code = url.searchParams.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error: err }) => {
        if (err) {
          console.error('Exchange error:', err)
          router.push('/auth')
          return
        }
        if (data.session) {
          router.push('/')
        } else {
          router.push('/auth')
        }
      })
      return
    }

    // Fallback: check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/')
      else router.push('/auth')
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
