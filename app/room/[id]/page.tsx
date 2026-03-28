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

type Player = { player_id: string; seat: number; is_ready: boolean; is_bot?: boolean; bot_name?: string; profile?: Profile }

const BOT_NAMES = ['Акежан', 'Думан', 'Нурлан', 'Бауыржан', 'Санжар', 'Арман']

const SEAT_LABEL = (seat: number, mode: string) => {
  if (mode==='team') {
    if (seat===0) return 'Команда A'
    if (seat===2) return 'Команда A'
    return 'Команда B'
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
  const [myReady, setMyReady] = useState(false)
  const [loading, setLoading] = useState(false)

  const isHost = !!(myId && room && room.host_id === myId)
  const totalCount = players.length
  const maxP = room?.max_players || 4
  const mode = room?.mode || 'team'
  const canStart = isHost && totalCount >= 2
  const canAddBot = isHost && totalCount < maxP

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

  async function loadRoom() {
    const { data } = await supabase.from('rooms').select('*').eq('id',roomId).single()
    if (data) setRoom(data)
  }

  async function loadPlayers() {
    const { data } = await supabase.from('room_players').select('*').eq('room_id',roomId)
    if (!data) return
    const result: Player[] = []
    for (const p of data) {
      if (p.is_bot) {
        result.push({ ...p, profile: { id:p.player_id, username:p.bot_name||'Бот', mmr:800, wins:0, losses:0, streak:0, created_at:'' } })
      } else {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id',p.player_id).single()
        if (prof) result.push({ ...p, profile: prof })
      }
    }
    setPlayers(result)
    const me = data.find((p:any)=>p.player_id===myId)
    if (me) setMyReady(me.is_ready)
  }

  async function toggleReady() {
    const newReady = !myReady
    setMyReady(newReady)
    await supabase.from('room_players').update({ is_ready:newReady }).eq('room_id',roomId).eq('player_id',myId)
  }

  async function addBot() {
    if (!canAddBot) return
    const takenSeats = players.map(p=>p.seat)
    const freeSeat = [0,1,2,3,4,5].find(s=>!takenSeats.includes(s))
    if (freeSeat===undefined) return
    const botIdx = players.filter(p=>p.is_bot).length
    const botName = BOT_NAMES[botIdx % BOT_NAMES.length]
    const botId = crypto.randomUUID()
    const { error } = await supabase.from('room_players').insert({
      room_id: roomId,
      player_id: botId,
      seat: freeSeat,
      is_ready: true,
      is_bot: true,
      bot_name: botName,
    })
    if (error) { console.error(error); return }
    await supabase.from('rooms').update({ player_count: totalCount+1 }).eq('id',roomId)
    loadPlayers()
  }

  async function removeBot(botId: string) {
    await supabase.from('room_players').delete().eq('room_id',roomId).eq('player_id',botId)
    await supabase.from('rooms').update({ player_count: totalCount-1 }).eq('id',roomId)
    loadPlayers()
  }

  async function startGame() {
    if (!room || !canStart) return
    setLoading(true)
    const sorted = [...players].sort((a,b)=>a.seat-b.seat)
    // Build player names array — only for seats that exist
    const actualCount = sorted.length
    const names = sorted.map(p => p.is_bot ? (p.bot_name||'Бот') : (p.profile?.username||'Игрок'))
    // Create game with actual player count, not max
    const gs = createInitialGameState(names, mode as 'team'|'solo', [0,0], 1)
    // Override player count to actual
    gs.hands = gs.hands.slice(0, actualCount)
    await supabase.from('game_states').upsert({ room_id:roomId, state:{...gs, playerCount:actualCount}, updated_at:new Date().toISOString() })
    await supabase.from('rooms').update({ status:'playing' }).eq('id',roomId)
    setLoading(false)
  }

  async function leaveRoom() {
    await supabase.from('room_players').delete().eq('room_id',roomId).eq('player_id',myId)
    const { data: remaining } = await supabase.from('room_players').select('*').eq('room_id',roomId)
    const realRemaining = (remaining||[]).filter((p:any)=>!p.is_bot)
    if (realRemaining.length === 0) {
      await supabase.from('room_players').delete().eq('room_id',roomId)
      await supabase.from('rooms').delete().eq('id',roomId)
    } else {
      await supabase.from('rooms').update({
        player_count: (remaining||[]).length,
        ...(room?.host_id===myId ? { host_id: realRemaining[0].player_id } : {})
      }).eq('id',roomId)
    }
    router.push('/')
  }

  return (
    <div style={{ minHeight:'100vh', padding:16, color:'#e8d5a3', fontFamily:"Georgia,serif", position:'relative' }}>
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
        {[...Array(5)].map((_,i)=><div key={i} style={{ position:'absolute', bottom:-60, left:`${10+i*18}%`, width:`${60+i*20}px`, height:`${60+i*20}px`, background:'radial-gradient(circle,rgba(201,168,76,0.055) 0%,transparent 70%)', borderRadius:'50%', animation:`smokeRise ${7+i*0.8}s ${i*1.4}s infinite ease-in` }}/>)}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${GOLD},transparent)`, opacity:0.5 }}/>
      </div>

      <div style={{ maxWidth:600, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* Header */}
        <div style={{ ...panel(), padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:9, color:'rgba(201,168,76,0.4)', letterSpacing:2 }}>КОМНАТА</div>
            <div style={{ fontSize:18, fontWeight:700, color:GOLD }}>{room?.name||'...'}</div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {room?.password && <span style={{ fontSize:12 }}>🔒</span>}
            <span style={{ fontSize:11, color:'rgba(201,168,76,0.5)', background:'rgba(201,168,76,0.1)', padding:'4px 10px', borderRadius:20, border:'1px solid rgba(201,168,76,0.2)' }}>
              {mode==='team'?'2×2':'Solo'}
            </span>
            <span style={{ fontSize:11, color:'rgba(201,168,76,0.5)' }}>{totalCount}/{maxP}</span>
          </div>
        </div>

        {/* Players */}
        <div style={{ ...panel(), padding:'20px 18px', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ fontSize:11, color:'rgba(201,168,76,0.45)', letterSpacing:2 }}>ИГРОКИ</div>
            {canAddBot && (
              <button onClick={addBot} style={{ padding:'6px 16px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:12, border:`1px solid ${GOLD}44`, background:`${GOLD}11`, color:GOLD, transition:'all 0.18s' }}>
                + Добавить бота
              </button>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {Array.from({length:maxP},(_,seat)=>{
              const player = players.find(p=>p.seat===seat)
              const isMe   = player?.player_id===myId
              const isBot  = player?.is_bot
              return (
                <motion.div key={seat} animate={{opacity:player?1:0.4}}
                  style={{ ...panel({border:`1px solid ${player?'rgba(201,168,76,0.2)':'rgba(255,255,255,0.05)'}`}), padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%',
                    background:player?(isBot?'#3498db':player.is_ready?'#27ae60':'#f39c12'):'#2a2a2a',
                    boxShadow:isBot?'0 0 8px #3498db':player?.is_ready?'0 0 8px #27ae60':'none', flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:player?'#e8d5a3':'rgba(255,255,255,0.2)' }}>
                      {isBot ? `🤖 ${player?.bot_name||'Бот'}`
                        : player ? `${player.profile?.username}${isMe?' (вы)':''}`
                        : 'Ожидание игрока…'}
                    </div>
                    <div style={{ fontSize:10, color:'rgba(201,168,76,0.4)', marginTop:2 }}>
                      {SEAT_LABEL(seat,mode)}{player?.profile?.mmr&&!isBot?` · ${player.profile.mmr} MMR`:''}
                      {isBot?' · Бот':''}
                    </div>
                  </div>
                  {player && !isBot && <div style={{ fontSize:11, color:player.is_ready?'#27ae60':'#f39c12' }}>{player.is_ready?'Готов':'Не готов'}</div>}
                  {isBot && isHost && (
                    <button onClick={()=>removeBot(player!.player_id)} style={{ background:'transparent', border:'1px solid rgba(231,76,60,0.3)', borderRadius:8, color:'rgba(231,76,60,0.7)', padding:'3px 10px', fontSize:11, cursor:'pointer' }}>✕</button>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={leaveRoom} style={gbtn(false,{flex:1,color:GOLD_DIM,border:`1px solid ${GOLD_DIM}33`,cursor:'pointer'})}>← Выйти</button>

          {!myReady && !players.find(p=>p.player_id===myId)?.is_ready && (
            <button onClick={toggleReady} style={gbtn(true,{flex:1})}>✓ Готов</button>
          )}

          {isHost ? (
            <button onClick={startGame} disabled={!canStart||loading}
              style={gbtn(canStart&&!loading,{
                flex:2,
                ...(canStart&&!loading?{background:'linear-gradient(135deg,#0a3d1a,#1e6b3a,#0a3d1a)',border:'1px solid #2a7a3a',color:'#90e8a0'}:{})
              })}>
              {loading?'Запуск…':canStart?`▶ Начать (${totalCount} игроков)`:'Нужно минимум 2 игрока'}
            </button>
          ) : (
            <div style={{ flex:2, textAlign:'center', fontSize:11, color:'rgba(201,168,76,0.3)', alignSelf:'center' }}>
              Ждём пока хост начнёт…
            </div>
          )}
        </div>

        {isHost && (
          <div style={{ marginTop:10, fontSize:10, color:'rgba(201,168,76,0.25)', textAlign:'center' }}>
            Ты хост · Добавляй ботов вручную · Старт от 2 игроков
          </div>
        )}
      </div>
      <style>{`@keyframes smokeRise{0%{transform:translateY(0) scale(1);opacity:0}20%{opacity:1}100%{transform:translateY(-80vh) scale(3);opacity:0}}`}</style>
    </div>
  )
}
