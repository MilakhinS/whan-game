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

type Player = { player_id: string; seat: number; is_ready: boolean; is_bot?: boolean; profile?: Profile }

const SEAT_LABEL = (seat: number, mode: string) => {
  if (mode==='team') {
    if (seat===0) return 'Ты (Команда A)'
    if (seat===2) return 'Союзник (Команда A)'
    return `Соперник ${seat===1?'1':'2'} (Команда B)`
  }
  return `Место ${seat+1}`
}

const BOT_NAMES = ['Акежан', 'Думан', 'Нурлан', 'Бауыржан', 'Санжар', 'Арман']

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
      if (p.is_bot) return { ...p, profile: { username: p.bot_name||'Бот', mmr:800 } }
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

  async function addBot() {
    const maxP = room?.max_players||4
    if (players.length >= maxP) return
    const takenSeats = players.map(p=>p.seat)
    const freeSeat = [0,1,2,3,4,5].find(s=>!takenSeats.includes(s))
    if (freeSeat===undefined) return
    const botIdx = players.filter((p:any)=>p.is_bot).length
    const botName = BOT_NAMES[botIdx % BOT_NAMES.length]
    const botId = `bot_${Date.now()}`
    await supabase.from('room_players').insert({
      room_id: roomId,
      player_id: botId,
      seat: freeSeat,
      is_ready: true,
      is_bot: true,
      bot_name: botName,
    })
    await supabase.from('rooms').update({ player_count: players.length+1 }).eq('id',roomId)
    loadPlayers()
  }

  async function removeBot(botPlayerId: string) {
    await supabase.from('room_players').delete().eq('room_id',roomId).eq('player_id',botPlayerId)
    await supabase.from('rooms').update({ player_count: Math.max(1,players.length-1) }).eq('id',roomId)
    loadPlayers()
  }

  async function startGame() {
    if (!room) return
    setLoading(true)
    const sorted = [...players].sort((a,b)=>a.seat-b.seat)
    const maxP = room.max_players
    const names = Array.from({length:maxP},(_,i)=>{
      const p = sorted.find(pl=>pl.seat===i)
      if (!p) return `Бот ${i+1}`
      return (p as any).is_bot ? ((p as any).bot_name||`Бот ${i+1}`) : (p.profile?.username||`Игрок ${i+1}`)
    })
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

  const maxP       = room?.max_players||4
  const mode       = room?.mode||'team'
  const totalCount = players.length
  const canStart   = isHost && totalCount >= 2
  const canAddBot  = isHost && totalCount < maxP

  return (
    <div style={{ minHeight:'100vh', padding:16, color:'#e8d5a3', fontFamily:"Georgia,serif", position:'relative' }}>
      {/* Smoke */}
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
            {room?.password && <span style={{ fontSize:11, color:'rgba(201,168,76,0.5)' }}>🔒</span>}
            <span style={{ fontSize:11, color:'rgba(201,168,76,0.5)', background:'rgba(201,168,76,0.1)', padding:'4px 10px', borderRadius:20, border:'1px solid rgba(201,168,76,0.2)' }}>{mode==='team'?'2×2':'Solo'}</span>
            <span style={{ fontSize:11, color:'rgba(201,168,76,0.5)' }}>{totalCount}/{maxP} игроков</span>
          </div>
        </div>

        {/* Players */}
        <div style={{ ...panel(), padding:'20px 18px', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ fontSize:11, color:'rgba(201,168,76,0.45)', letterSpacing:2 }}>ИГРОКИ</div>
            {isHost && canAddBot && (
              <button onClick={addBot} style={{ padding:'6px 14px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:12, border:`1px solid rgba(201,168,76,0.3)`, background:'rgba(201,168,76,0.08)', color:GOLD, transition:'all 0.18s' }}>
                + Добавить бота
              </button>
            )}
          </div>

          <div style={{ fontSize:10, color:'rgba(201,168,76,0.3)', marginBottom:14, lineHeight:1.7 }}>
            {mode==='team' ? 'Места 0,2 = Команда A · Места 1,3 = Команда B' : 'Solo режим — каждый за себя'}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {Array.from({length:maxP},(_,seat)=>{
              const player = players.find(p=>p.seat===seat)
              const isMe   = player?.player_id===myId
              const isBot  = (player as any)?.is_bot
              return (
                <motion.div key={seat} animate={{opacity:player?1:0.4}}
                  style={{ ...panel({border:`1px solid ${player?'rgba(201,168,76,0.2)':'rgba(255,255,255,0.05)'}`}), padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:player?(isBot?'#3498db':player.is_ready?'#27ae60':'#f39c12'):'#2a2a2a', boxShadow:player?.is_ready&&!isBot?'0 0 8px #27ae60':isBot?'0 0 8px #3498db':'none', flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:player?'#e8d5a3':'rgba(255,255,255,0.2)' }}>
                      {isBot ? `🤖 ${(player as any).bot_name||'Бот'}` : player ? `${player.profile?.username||'Загрузка…'}${isMe?' (вы)':''}` : 'Ожидание…'}
                    </div>
                    <div style={{ fontSize:10, color:'rgba(201,168,76,0.4)', marginTop:2 }}>
                      {SEAT_LABEL(seat,mode)}{player?.profile?.mmr&&!isBot?` · ${player.profile.mmr} MMR`:''}
                      {isBot?' · Бот':''}
                    </div>
                  </div>
                  {player && !isBot && <div style={{ fontSize:11, color:player.is_ready?'#27ae60':'#f39c12' }}>{player.is_ready?'Готов':'Не готов'}</div>}
                  {isBot && isHost && (
                    <button onClick={()=>removeBot(player!.player_id)} style={{ background:'transparent', border:'1px solid rgba(231,76,60,0.3)', borderRadius:8, color:'rgba(231,76,60,0.6)', padding:'4px 10px', fontSize:11, cursor:'pointer' }}>✕</button>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button onClick={leaveRoom} style={gbtn(false,{flex:1,color:GOLD_DIM,border:`1px solid ${GOLD_DIM}33`,cursor:'pointer'})}>← Выйти</button>

          {!myReady && !players.find(p=>p.player_id===myId)?.is_ready && (
            <button onClick={toggleReady} style={gbtn(true,{flex:1})}>✓ Готов</button>
          )}

          {isHost && (
            <button onClick={startGame} disabled={!canStart||loading}
              style={gbtn(canStart&&!loading,{flex:2, background:canStart&&!loading?'linear-gradient(135deg,#0a3d1a,#1e6b3a,#0a3d1a)':'undefined', border:canStart&&!loading?'1px solid #2a7a3a':'undefined', color:canStart&&!loading?'#90e8a0':'undefined'})}>
              {loading?'Запуск…':canStart?`▶ Начать (${totalCount} игроков)`:`Нужно минимум 2 игрока`}
            </button>
          )}

          {!isHost && (
            <div style={{ flex:2, textAlign:'center', fontSize:11, color:'rgba(201,168,76,0.3)', alignSelf:'center' }}>
              Ждём пока хост начнёт игру…
            </div>
          )}
        </div>

        {/* Info */}
        {isHost && (
          <div style={{ marginTop:12, fontSize:11, color:'rgba(201,168,76,0.3)', textAlign:'center', lineHeight:1.7 }}>
            Ты хост · Можешь добавить ботов и начать игру в любой момент
          </div>
        )}
      </div>

      <style>{`@keyframes smokeRise{0%{transform:translateY(0) scale(1);opacity:0}20%{opacity:1}100%{transform:translateY(-80vh) scale(3);opacity:0}}`}</style>
    </div>
  )
}
