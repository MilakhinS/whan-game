'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, type Room, type Profile } from '@/lib/supabase'
import { createInitialGameState } from '@/lib/gameEngine'
import { motion } from 'framer-motion'

const GOLD = '#c9a84c'
const GOLD_DIM = '#7a6020'
const panel = (extra={}) => ({ background:'rgba(18,14,4,0.88)', border:'1px solid rgba(201,168,76,0.18)', borderRadius:20, backdropFilter:'blur(12px)', ...extra })
const gbtn = (active=true, extra={}) => ({ padding:'11px 22px', borderRadius:12, border:`1px solid ${active?GOLD:GOLD_DIM+'44'}`, background:active?'linear-gradient(135deg,#3d2a00,#6b4a0a,#3d2a00)':'transparent', color:active?'#f0d080':'#5a4820', cursor:active?'pointer':'not-allowed', fontSize:14, fontWeight:600, boxShadow:active?`0 2px 16px rgba(201,168,76,0.25)`:'none', transition:'all 0.18s', ...extra })

type Player = { player_id: string; seat: number; is_ready: boolean; profile?: Profile }

const SEAT_LABEL = (seat: number, mode: string) => {
  if (mode==='team') {
    if (seat===0) return 'Ты (Команда A)'
    if (seat===2) return 'Союзник (Команда A)'
    return `Соперник ${seat===1?'1':'2'} (Команда B)`
  }
  return `Место ${seat+1}`
}

export default function RoomPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.id as string

  const [room, setRoom]       = useState<Room|null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [myId, setMyId]       = useState<string>('')
  const [isHost, setIsHost]   = useState(false)
  const [myReady, setMyReady] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if (!data.user) { router.push('/auth'); return }
      setMyId(data.user.id)
      loadRoom()
      loadPlayers()
    })

    const ch = supabase.channel(`room-${roomId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'rooms',filter:`id=eq.${roomId}`},()=>loadRoom())
      .on('postgres_changes',{event:'*',schema:'public',table:'room_players',filter:`room_id=eq.${roomId}`},()=>loadPlayers())
      .subscribe()

    return ()=>{ supabase.removeChannel(ch) }
  },[roomId])

  // Watch for game start
  useEffect(()=>{
    if (room?.status==='playing') {
      router.push(`/game/${roomId}`)
    }
  },[room?.status])

  useEffect(()=>{
    if (myId && room) setIsHost(room.host_id===myId)
  },[myId, room])

  async function loadRoom() {
    const { data } = await supabase.from('rooms').select('*').eq('id',roomId).single()
    if (data) setRoom(data)
  }

  async function loadPlayers() {
    const { data } = await supabase.from('room_players').select('*').eq('room_id',roomId)
    if (!data) return
    // Load profiles
    const withProfiles = await Promise.all(data.map(async (p: any)=>{
      const { data: prof } = await supabase.from('profiles').select('*').eq('id',p.player_id).single()
      return { ...p, profile: prof }
    }))
    setPlayers(withProfiles)
    const me = withProfiles.find((p:any)=>p.player_id===myId)
    if (me) setMyReady(me.is_ready)
  }

  async function toggleReady() {
    const newReady = !myReady
    setMyReady(newReady)
    await supabase.from('room_players').update({ is_ready:newReady }).eq('room_id',roomId).eq('player_id',myId)
  }

  async function startGame() {
    if (!room) return
    setLoading(true)
    const sorted = [...players].sort((a,b)=>a.seat-b.seat)
    const names = Array.from({length:room.max_players},(_,i)=>sorted.find(p=>p.seat===i)?.profile?.username||`CPU ${i}`)
    const gs = createInitialGameState(names, room.mode, [0,0], 1)
    await supabase.from('game_states').upsert({ room_id:roomId, state:gs, updated_at:new Date().toISOString() })
    await supabase.from('rooms').update({ status:'playing' }).eq('id',roomId)
    setLoading(false)
  }

  async function leaveRoom() {
    await supabase.from('room_players').delete().eq('room_id',roomId).eq('player_id',myId)
    await supabase.from('rooms').update({ player_count: Math.max(0,(room?.player_count||1)-1) }).eq('id',roomId)
    router.push('/')
  }

  const maxP     = room?.max_players||4
  const allReady = players.length===maxP && players.every(p=>p.is_ready)
  const mode     = room?.mode||'team'

  return (
    <div style={{ minHeight:'100vh', padding:16, color:'#e8d5a3', fontFamily:"Georgia,serif", position:'relative' }}>
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
        {[...Array(5)].map((_,i)=><div key={i} style={{ position:'absolute', bottom:-60, left:`${10+i*18}%`, width:`${60+i*20}px`, height:`${60+i*20}px`, background:'radial-gradient(circle,rgba(201,168,76,0.055) 0%,transparent 70%)', borderRadius:'50%', animation:`smokeRise ${7+i*0.8}s ${i*1.4}s infinite ease-in` }}/>)}
      </div>

      <div style={{ maxWidth:600, margin:'0 auto', position:'relative', zIndex:1 }}>
        <div style={{ ...panel(), padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:9, color:'rgba(201,168,76,0.4)', letterSpacing:2 }}>КОМНАТА</div>
            <div style={{ fontSize:18, fontWeight:700, color:GOLD }}>{room?.name||'...'}</div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {room?.password && <span style={{ fontSize:11, color:'rgba(201,168,76,0.5)' }}>🔒 Закрытая</span>}
            <span style={{ fontSize:11, color:'rgba(201,168,76,0.5)' }}>{mode==='team'?'2×2':'Solo'}</span>
          </div>
        </div>

        <div style={{ ...panel(), padding:'20px 18px', marginBottom:14 }}>
          <div style={{ fontSize:11, color:'rgba(201,168,76,0.45)', letterSpacing:2, marginBottom:14 }}>ИГРОКИ</div>
          <div style={{ fontSize:10, color:'rgba(201,168,76,0.3)', marginBottom:14, lineHeight:1.7 }}>
            Порядок хода: места 1→2→3 (сверху), затем ты (снизу).<br/>
            В режиме 2×2: места 0,2 = Команда A; места 1,3 = Команда B.
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {Array.from({length:maxP},(_,seat)=>{
              const player = players.find(p=>p.seat===seat)
              const isMe   = player?.player_id===myId
              return (
                <motion.div key={seat} animate={{opacity:player?1:0.4}}
                  style={{ ...panel({border:`1px solid ${player?'rgba(201,168,76,0.2)':'rgba(255,255,255,0.05)'}`}), padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:player?(player.is_ready?'#27ae60':'#f39c12'):'#2a2a2a', boxShadow:player?.is_ready?'0 0 8px #27ae60':'none', flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:player?'#e8d5a3':'rgba(255,255,255,0.2)' }}>
                      {player?.profile?.username||(player?'Загрузка…':'Ожидание…')}
                      {isMe?' (вы)':''}
                    </div>
                    <div style={{ fontSize:10, color:'rgba(201,168,76,0.4)', marginTop:2 }}>
                      {SEAT_LABEL(seat,mode)} {player?.profile?.mmr?`• ${player.profile.mmr} MMR`:''}
                    </div>
                  </div>
                  {player && <div style={{ fontSize:11, color:player.is_ready?'#27ae60':'#f39c12' }}>{player.is_ready?'Готов':'Не готов'}</div>}
                </motion.div>
              )
            })}
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={leaveRoom} style={gbtn(false,{flex:1,color:GOLD_DIM,border:`1px solid ${GOLD_DIM}33`,cursor:'pointer'} as any)}>← Выйти</button>
          {!myReady && <button onClick={toggleReady} style={gbtn(true,{flex:1} as any)}>✓ Готов</button>}
          {isHost && allReady && <button onClick={startGame} disabled={loading} style={gbtn(true,{flex:2,background:'linear-gradient(135deg,#0a3d1a,#1e6b3a,#0a3d1a)',border:'1px solid #2a7a3a',color:'#90e8a0'} as any)}>{loading?'Запуск…':'▶ Начать игру'}</button>}
          {!allReady && <div style={{ flex:2, textAlign:'center', fontSize:11, color:'rgba(201,168,76,0.3)', alignSelf:'center' }}>{players.length<maxP?`Ждём ${maxP-players.length} игрока…`:'Ждём готовности всех…'}</div>}
        </div>
      </div>
    </div>
  )
}
