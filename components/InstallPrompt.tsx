'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const GOLD = '#c9a84c'

export default function InstallPrompt() {
  const [show, setShow]       = useState(false)
  const [isIOS, setIsIOS]     = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if already dismissed
    if (localStorage.getItem('install-dismissed')) return

    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua)
    const android = /android/i.test(ua)

    setIsIOS(ios)
    setIsAndroid(android)

    // Show after 3 seconds on mobile
    if (ios || android) {
      setTimeout(() => setShow(true), 3000)
    }

    // Android Chrome install prompt
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setShow(true), 3000)
    })

    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setShow(false)
    })
  }, [])

  function dismiss() {
    localStorage.setItem('install-dismissed', '1')
    setShow(false)
  }

  async function installAndroid() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity:0, y:100 }}
        animate={{ opacity:1, y:0 }}
        exit={{ opacity:0, y:100 }}
        transition={{ type:'spring', damping:20 }}
        style={{
          position:'fixed', bottom:0, left:0, right:0, zIndex:200,
          background:'rgba(8,4,1,0.97)',
          borderTop:`1px solid rgba(201,168,76,0.3)`,
          borderRadius:'20px 20px 0 0',
          padding:'20px 20px 32px',
          backdropFilter:'blur(20px)',
          fontFamily:"Georgia,serif",
          color:'#e8d5a3',
          maxWidth:600,
          margin:'0 auto',
        }}
      >
        {/* Handle bar */}
        <div style={{ width:40, height:4, background:'rgba(201,168,76,0.3)', borderRadius:2, margin:'0 auto 16px' }}/>

        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
          {/* App icon placeholder */}
          <div style={{ width:56, height:56, borderRadius:14, background:'linear-gradient(135deg,#1a0c03,#3d2a00)', border:`1px solid ${GOLD}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ fontSize:28, fontWeight:700, background:`linear-gradient(180deg,#f5e070,${GOLD})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>W</span>
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:GOLD }}>WHAN</div>
            <div style={{ fontSize:12, color:'rgba(201,168,76,0.5)', marginTop:2 }}>by Milakhin Studio</div>
          </div>
        </div>

        <div style={{ fontSize:14, fontWeight:600, color:'#e8d5a3', marginBottom:8 }}>
          Добавить на экран домой
        </div>
        <div style={{ fontSize:12, color:'rgba(201,168,76,0.5)', marginBottom:20, lineHeight:1.6 }}>
          Играй как в настоящем приложении — без браузерной строки, быстрый запуск с иконки 🎴
        </div>

        {/* iOS instructions */}
        {isIOS && (
          <div style={{ background:'rgba(201,168,76,0.06)', border:'1px solid rgba(201,168,76,0.15)', borderRadius:14, padding:'14px', marginBottom:16 }}>
            <div style={{ fontSize:12, color:'rgba(201,168,76,0.7)', lineHeight:2 }}>
              <div>1. Нажми <span style={{ fontSize:16 }}>⬆️</span> <strong style={{color:GOLD}}>Поделиться</strong> внизу Safari</div>
              <div>2. Выбери <strong style={{color:GOLD}}>«На экран домой»</strong></div>
              <div>3. Нажми <strong style={{color:GOLD}}>«Добавить»</strong></div>
            </div>
          </div>
        )}

        {/* Android button */}
        {isAndroid && deferredPrompt && (
          <button onClick={installAndroid} style={{ width:'100%', padding:'14px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, border:`1px solid ${GOLD}`, background:`linear-gradient(135deg,#3d2a00,#6b4a0a,#3d2a00)`, color:'#f0d080', marginBottom:10, boxShadow:`0 2px 16px rgba(201,168,76,0.25)` }}>
            📲 Установить приложение
          </button>
        )}

        {isAndroid && !deferredPrompt && (
          <div style={{ background:'rgba(201,168,76,0.06)', border:'1px solid rgba(201,168,76,0.15)', borderRadius:14, padding:'14px', marginBottom:16 }}>
            <div style={{ fontSize:12, color:'rgba(201,168,76,0.7)', lineHeight:2 }}>
              <div>1. Нажми <strong style={{color:GOLD}}>⋮</strong> меню в браузере</div>
              <div>2. Выбери <strong style={{color:GOLD}}>«Добавить на гл. экран»</strong></div>
            </div>
          </div>
        )}

        <button onClick={dismiss} style={{ width:'100%', padding:'12px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:13, border:'1px solid rgba(201,168,76,0.15)', background:'transparent', color:'rgba(201,168,76,0.4)' }}>
          Не сейчас
        </button>
      </motion.div>

      {/* Backdrop */}
      <motion.div
        initial={{ opacity:0 }}
        animate={{ opacity:1 }}
        exit={{ opacity:0 }}
        onClick={dismiss}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:199 }}
      />
    </AnimatePresence>
  )
}
