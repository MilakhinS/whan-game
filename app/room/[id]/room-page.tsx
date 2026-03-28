'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, type Room, type Profile } from '@/lib/supabase'
import { createInitialGameState } from '@/lib/gameEngine'
import { motion } from 'framer-motion'

const GOLD = '#c9a84c'
const GOLD_DIM = '#7a6020'
const panel = (extra={}) => ({ background:'rgba(18,14,4,0.88)', border:'1px solid rgba(201,168,76,0.18)', borderRadius:20, backdropFilter:'blur(12px)', ...extra } as any)
const gbtn = (active=true, extra={}) => ({ padding:'11px 22px', borderRadius:12, border:`1px solid ${active?GOLD:GOLD_DIM+'44'}`, background:active?'linear-gradient(135deg,#3d2a00,#6b4a0a,#3d2a00)':'transparent', color:active?'#f0d080':'#5a4820', cursor:active?'pointer':'not-allowed', fontSize:14, fontWeight:600, boxShadow:active?`0 2px 16px rgba(201,168,76,0.25)`:'none', transition:'all 0.18s', ...extra } as any)

const BOT_NAMES = ['CPU Акбар','CPU Дулат','CPU Нурлан','CPU Айдар','CPU Серик']

type Player = { player_id: string; seat: number; is_ready: boolean; profile?: Profile; isBot?: boolean; botName?: string }

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
  const [botCount, setBotCount] = useState(0)
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

  useEffect(()=>{
    if (room?.status==='playing') router.push(`/game/${roomId}`)
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
    const maxP = room.max_players

    // Build player names array: real players + bots filling empty seats
    const realPlayers = [...players].sort((a,b)=>a.seat-b.seat)
    const takenSeats = realPlayers.map(p=>p.seat)

    // Find empty seats and fill with bots
    const allSeats = Array.from({length:maxP},(_,i)=>i)
    const emptySeats = allSeats.filter(s=>!takenSeats.includes(s))
    const botsToAdd = emptySeats.slice(0, botCount)

    // Build names array indexed by seat
    const names: string[] = Array(maxP).fill('')
    for (const p of realPlayers) {
      names[p.seat] = p.profile?.username || `Игрок ${p.seat+1}`
    }
    let botIdx = 0
    for (const seat of botsToAdd) {
      names[seat] = BOT_NAMES[botIdx % BOT_NAMES.length]
      botIdx++
    }
    // Fill any remaining empty seats with bots too (if botCount > emptySeats)
    for (let i=0;i<maxP;i++) {
      if (!names[i]) names[i] = BOT_NAMES[botIdx++ % BOT_NAMES.length]
    }

    const gs = createInitialGameState(names, room.mode, [0,0], 1)
    // Mark which seats are bots
    gs.botSeats = allSeats.filter(s=>!takenSeats.includes(s) || botsToAdd.includes(s))

    await supabase.from('game_states').upsert({ room_id:roomId, state:gs, updated_at:new Date().toISOString() })
    await supabase.from('rooms').update({ status:'playing' }).eq('id',roomId)
    setLoading(false)
  }

  async function leaveRoom() {
    await supabase.from('room_players').delete().eq('room_id',roomId).eq('player_id',myId)
    await supabase.from('rooms').update({ player_count: Math.max(0,(room?.player_count||1)-1) }).eq('id',roomId)
    router.push('/')
  }

  const maxP        = room?.max_players||4
  const mode        = room?.mode||'team'
  const realCount   = players.length
  const emptySeats  = maxP - realCount
  // Max bots = empty seats, min 0
  const maxBots     = emptySeats
  // Can start: host, ≥2 real players, all real players ready, botCount fills remaining or leaves some
  const totalPlayers = realCount + botCount
  const allReady    = players.length >= 1 && players.every(p=>p.is_ready)
  const canStart    = isHost && realCount >= 1 && allReady && totalPlayers >= 2

  // Seat display: real players + bots preview
  const takenSeats  = players.map(p=>p.seat)
  const botSeats    = Array.from({length:maxP},(_,i)=>i)
    .filter(s=>!takenSeats.includes(s))
    .slice(0, botCount)

  return (
    <div style={{ minHeight:'100vh', padding:16, color:'#e8d5a3', fontFamily:"Georgia,serif", position:'relative' }}>
      {/* Smoke */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
        {[...Array(5)].map((_,i)=>(
          <div key={i} style={{ position:'absolute', bottom:-60, left:`${10+i*18}%`, width:`${60+i*20}px`, height:`${60+i*20}px`, background:'radial-gradient(circle,rgba(201,168,76,0.055) 0%,transparent 70%)', borderRadius:'50%', animation:`smokeRise ${7+i*0.8}s ${i*1.4}s infinite ease-in` }}/>
        ))}
      </div>

      <div style={{ maxWidth:600, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* Header */}
        <div style={{ ...panel(), padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:9, color:'rgba(201,168,76,0.4)', letterSpacing:2 }}>КОМНАТА</div>
            <div style={{ fontSize:18, fontWeight:700, color:GOLD }}>{room?.name||'...'}</div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {room?.password && <span style={{ fontSize:11, color:'rgba(201,168,76,0.5)' }}>🔒</span>}
            <span style={{ fontSize:11, color:'rgba(201,168,76,0.5)', background:'rgba(201,168,76,0.1)', padding:'4px 10px', borderRadius:20, border:'1px solid rgba(201,168,76,0.2)' }}>
              {mode==='team'?'2×2':'Solo'}
            </span>
          </div>
        </div>

        {/* Players */}
        <div style={{ ...panel(), padding:'20px 18px', marginBottom:14 }}>
          <div style={{ fontSize:11, color:'rgba(201,168,76,0.45)', letterSpacing:2, marginBottom:14 }}>ИГРОКИ</div>

          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
            {Array.from({length:maxP},(_,seat)=>{
              const player  = players.find(p=>p.seat===seat)
              const isBot   = botSeats.includes(seat)
              const isMe    = player?.player_id===myId
              const botName = BOT_NAMES[botSeats.indexOf(seat) % BOT_NAMES.length]

              return (
                <motion.div key={seat} animate={{opacity:(player||isBot)?1:0.4}}
                  style={{ ...panel({border:`1px solid ${player?'rgba(201,168,76,0.25)':isBot?'rgba(201,168,76,0.1)':'rgba(255,255,255,0.04)'}`}), padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                    background: player?(player.is_ready?'#27ae60':'#f39c12'):isBot?'#4a7a9b':'#2a2a2a',
                    boxShadow: player?.is_ready?'0 0 8px #27ae60':isBot?'0 0 6px #4a7a9b':'none'
                  }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:player?'#e8d5a3':isBot?'#7aaabb':'rgba(255,255,255,0.2)' }}>
                      {player ? `${player.profile?.username||'...'} ${isMe?'(вы)':''}` : isBot ? `🤖 ${botName}` : 'Ожидание…'}
                    </div>
                    <div style={{ fontSize:10, color:'rgba(201,168,76,0.4)', marginTop:2 }}>
                      {SEAT_LABEL(seat,mode)}
                      {player?.profile?.mmr ? ` · ${player.profile.mmr} MMR` : ''}
                      {isBot ? ' · Бот' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize:11 }}>
                    {player ? (
                      <span style={{ color:player.is_ready?'#27ae60':'#f39c12' }}>
                        {player.is_ready?'✓ Готов':'Не готов'}
                      </span>
                    ) : isBot ? (
                      <span style={{ color:'#4a7a9b' }}>🤖 Авто</span>
                    ) : null}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Bot selector — only for host */}
          {isHost && emptySeats > 0 && (
            <div style={{ ...panel({border:'1px solid rgba(201,168,76,0.12)'}), padding:'14px 16px' }}>
              <div style={{ fontSize:11, color:'rgba(201,168,76,0.45)', letterSpacing:2, marginBottom:12 }}>ДОБАВИТЬ БОТОВ</div>
              <div style={{ fontSize:11, color:'rgba(201,168,76,0.35)', marginBottom:12 }}>
                Свободных мест: {emptySeats} · Выбрано ботов: {botCount}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {Array.from({length:emptySeats+1},(_,i)=>i).map(n=>(
                  <button key={n} onClick={()=>setBotCount(n)} style={{
                    padding:'8px 16px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:13,
                    border:`1.5px solid ${botCount===n?GOLD:GOLD_DIM+'33'}`,
                    background:botCount===n?'linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.05))':'rgba(255,255,255,0.02)',
                    color:botCount===n?GOLD:'#5a4020', transition:'all 0.15s',
                    fontWeight:botCount===n?700:400,
                  }}>
                    {n===0?'Без ботов':`${n} ${n===1?'бот':n<5?'бота':'ботов'}`}
                  </button>
                ))}
              </div>
              {botCount > 0 && (
                <div style={{ marginTop:10, fontSize:11, color:'rgba(201,168,76,0.4)', fontStyle:'italic' }}>
                  Итого за столом: {realCount} игрок{realCount>1?'а':''} + {botCount} {botCount===1?'бот':botCount<5?'бота':'ботов'} = {totalPlayers} участников
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button onClick={leaveRoom} style={gbtn(false,{flex:1,color:GOLD_DIM,border:`1px solid ${GOLD_DIM}33`,cursor:'pointer'})}>← Выйти</button>

          {!myReady && (
            <button onClick={toggleReady} style={gbtn(true,{flex:1})}>✓ Готов</button>
          )}

          {isHost ? (
            canStart ? (
              <button onClick={startGame} disabled={loading}
                style={gbtn(true,{flex:2,background:'linear-gradient(135deg,#0a3d1a,#1e6b3a,#0a3d1a)',border:'1px solid #2a7a3a',color:'#90e8a0'})}>
                {loading?'Запуск…':`▶ Начать (${totalPlayers} уч.)`}
              </button>
            ) : (
              <div style={{ flex:2, textAlign:'center', fontSize:11, color:'rgba(201,168,76,0.3)', alignSelf:'center', lineHeight:1.6 }}>
                {!allReady ? 'Дождись готовности всех игроков' :
                 realCount < 2 ? 'Нужно минимум 2 игрока' :
                 totalPlayers < 2 ? 'Добавь ботов или подожди игроков' : ''}
              </div>
            )
          ) : (
            <div style={{ flex:2, textAlign:'center', fontSize:11, color:'rgba(201,168,76,0.3)', alignSelf:'center' }}>
              {allReady ? 'Ждём хоста…' : `Ждём готовности (${players.filter(p=>p.is_ready).length}/${realCount})`}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ marginTop:14, fontSize:10, color:'rgba(201,168,76,0.25)', textAlign:'center', lineHeight:1.8 }}>
          Хост может начать игру с минимум 2 участниками · Боты заполняют пустые места
        </div>
      </div>
    </div>
  )
}
