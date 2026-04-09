'use client'
export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#000000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Roboto, -apple-system, sans-serif',
      padding: '24px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 52, fontWeight: 700, letterSpacing: 12,
        background: 'linear-gradient(180deg, #F5E070, #F4C839)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        marginBottom: 8,
      }}>WHAN</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 64, letterSpacing: 1 }}>
        by Milakhin Studio
      </div>
      <div style={{
        background: '#1C1C1E', borderRadius: 24, padding: '40px 32px',
        maxWidth: 380, width: '100%', border: '0.5px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 20,
          background: 'linear-gradient(135deg, #2C2C2E, #1C1C1E)',
          border: '1px solid rgba(244,200,57,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 36,
        }}>🃏</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', marginBottom: 12 }}>
          Мы переехали в приложение!
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 32 }}>
          Веб-версия WHAN больше не поддерживается. Скачай приложение — оно быстрее, красивее и работает офлайн.
        </div>
        <a href="https://apps.apple.com/us/app/whan/id6761418673" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: '#FFFFFF', borderRadius: 14, padding: '14px 24px', marginBottom: 12,
          textDecoration: 'none', color: '#000000', fontSize: 16, fontWeight: 700,
        }}>
          <span style={{ fontSize: 22 }}>🍎</span>
          Скачать в App Store
        </a>
        <a href="https://play.google.com/store/apps/details?id=com.milakhinstudio.whan" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)',
          borderRadius: 14, padding: '14px 24px',
          textDecoration: 'none', color: '#FFFFFF', fontSize: 16, fontWeight: 600,
        }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          Google Play (скоро)
        </a>
      </div>
      <div style={{ marginTop: 32, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
        © 2025 Milakhin Studio · WHAN Card Game
      </div>
    </div>
  )
}
