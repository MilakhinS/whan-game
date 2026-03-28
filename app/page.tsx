'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Profile, type Room } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

const GOLD = '#c9a84c'
const GOLD_DIM = '#7a6020'
const GOLD_GLOW = 'rgba(201,168,76,0.35)'
const panel = (extra={}) => ({ background:'rgba(18,14,4,0.88)', border:'1px solid rgba(201,168,76,0.18)', borderRadius:20, backdropFilter:'blur(12px)', ...extra })
const inp = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.22)', borderRadius:12, padding:'10px 14px', color:'#e8d5a3', fontSize:14, outline:'none', width:'100%', boxSizing:'border-box' as const }
const gbtn = (active=true, extra={}) => ({ padding:'10px 22px', borderRadius:12, border:`1px solid ${active?GOLD:GOLD_DIM+'44'}`, background:active?'linear-gradient(135deg,#3d2a00,#6b4a0a,#3d2a00)':'rgba(255,255,255,0.03)', color:active?'#f0d080':'#5a4820', cursor:active?'pointer':'not-allowed', fontSize:14, fontWeight:600, boxShadow:active?`0 2px 16px ${GOLD_GLOW}`:'none', transition:'all 0.18s', ...extra })
const badge = (color=GOLD) => ({ display:'inline-block', padding:'2px 10px', borderRadius:20, border:`1px solid ${color}44`, background:`${color}18`, color, fontSize:11, fontWeight:600 })

function Smoke() {
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
      {[...Array(6)].map((_,i)=>(
        <div key={i} style={{ position:'absolute', bottom:-60, left:`${10+i*15}%`, width:`${60+i*20}px`, height:`${60+i*20}px`, background:'radial-gradient(circle,rgba(201,168,76,0.055) 0%,transparent 70%)', borderRadius:'50%', animation:`smokeRise ${7+i*0.8}s ${i*1.4}s infinite ease-in` }}/>
      ))}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${GOLD},transparent)`, opacity:0.5 }}/>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${GOLD},transparent)`, opacity:0.5 }}/>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [profile, setProfile]     = useState<Profile|null>(null)
  const [rooms, setRooms]         = useState<Room[]>([])
  const [search, setSearch]       = useState('')
  const [modeFilter, setModeFilter] = useState<'all'|'team'|'solo'>('all')
  const [creating, setCreating]   = useState(false)
  const [roomName, setRoomName]   = useState('')
  const [roomPass, setRoomPass]   = useState('')
  const [gameMode, setGameMode]   = useState<'team'|'solo'>('team')
  const [pendingRoom, setPendingRoom] = useState<Room|null>(null)
  const [enterPass, setEnterPass] = useState('')
  const [passError, setPassError] = useState('')
  const [toast, setToast]         = useState('')
  const [loading, setLoading]     = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if (!data.user) { router.push('/auth'); return }
      loadProfile(data.user.id)
    })
    loadRooms()

    // Realtime rooms
    const channel = supabase.channel('rooms').on('postgres_changes',{event:'*',schema:'public',table:'rooms'},()=>loadRooms()).subscribe()
    return () => { supabase.removeChannel(channel) }
  },[])

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id',uid).single()
    if (data) setProfile(data)
  }

  async function loadRooms() {
    const { data } = await supabase.from('rooms').select('*').eq('status','waiting').order('created_at',{ascending:false}).limit(20)
    if (data) setRooms(data)
  }

  async function createRoom() {
    if (!roomName.trim()) { showToast('Введите название'); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const maxP = gameMode==='team'?4:6

    // Delete empty rooms first
    await supabase.from('rooms').delete().eq('host_id', user.id).eq('status','waiting').eq('player_count',0)

    const { data, error } = await supabase.from('rooms').insert({
      name: roomName.trim(),
      password: roomPass.trim()||null,
      mode: gameMode,
      host_id: user.id,
      player_count: 1,
      max_players: maxP,
      status: 'waiting'
    }).select().single()
    if (error) { showToast('Ошибка создания комнаты'); setLoading(false); return }
    await supabase.from('room_players').insert({ room_id:data.id, player_id:user.id, seat:0, is_ready:false })
    setRoomName('')
    setRoomPass('')
    setLoading(false)
    router.push(`/room/${data.id}`)
  }

  async function joinRoom(room: Room) {
    if (room.player_count >= room.max_players) { showToast('Комната заполнена'); return }
    if (room.password) {
      setPendingRoom(room); setEnterPass(''); setPassError('')
    } else {
      doJoin(room, '')
    }
  }

  async function doJoin(room: Room, pass: string) {
    if (room.password && pass !== room.password) { setPassError('Неверный пароль'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    // Find free seat
    const { data: players } = await supabase.from('room_players').select('seat').eq('room_id',room.id)
    const taken = (players||[]).map((p:any)=>p.seat)
    const seat = [0,1,2,3,4,5].find(s=>!taken.includes(s)) ?? 0
    await supabase.from('room_players').upsert({ room_id:room.id, player_id:user.id, seat, is_ready:false })
    await supabase.from('rooms').update({ player_count: (players||[]).length+1 }).eq('id',room.id)
    setPendingRoom(null)
    router.push(`/room/${room.id}`)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const filtered = rooms.filter(r=>{
    const m = modeFilter==='all'||r.mode===modeFilter
    const s = r.name.toLowerCase().includes(search.toLowerCase())
    return m&&s
  })

  return (
    <div style={{ minHeight:'100vh', padding:'16px', paddingBottom:32, position:'relative', color:'#e8d5a3', fontFamily:"Georgia,'Times New Roman',serif" }}>
      <Smoke/>

      {/* Password modal */}
      <AnimatePresence>
        {pendingRoom && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
            onClick={e=>{ if(e.target===e.currentTarget) setPendingRoom(null) }}>
            <motion.div initial={{scale:0.85,y:20}} animate={{scale:1,y:0}}
              style={{ ...panel(), padding:'28px 24px', width:'100%', maxWidth:360, border:`1px solid ${GOLD}44` }}>
              <div style={{ fontSize:11, color:'rgba(201,168,76,0.45)', letterSpacing:2, marginBottom:6 }}>ВХОД В КОМНАТУ</div>
              <div style={{ fontSize:17, fontWeight:700, color:GOLD, marginBottom:16 }}>{pendingRoom.name}</div>
              <div style={{ fontSize:12, color:'rgba(201,168,76,0.5)', marginBottom:10 }}>🔒 Комната защищена паролем</div>
              <input style={{...inp,marginBottom:8}} placeholder="Введите пароль" type="password" value={enterPass}
                onChange={e=>{setEnterPass(e.target.value);setPassError('')}}
                onKeyDown={e=>e.key==='Enter'&&doJoin(pendingRoom,enterPass)} autoFocus/>
              {passError && <div style={{ fontSize:12, color:'#e74c3c', marginBottom:10 }}>{passError}</div>}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button onClick={()=>setPendingRoom(null)} style={gbtn(false,{flex:1,color:GOLD_DIM,border:`1px solid ${GOLD_DIM}33`,cursor:'pointer'} as any)}>Отмена</button>
                <button onClick={()=>doJoin(pendingRoom,enterPass)} style={gbtn(true,{flex:2} as any)}>Войти</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ maxWidth:960, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* Header */}
        <div style={{ ...panel(), padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ fontSize:22, fontWeight:700, letterSpacing:6, background:`linear-gradient(180deg,#f5e070,${GOLD})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>WHAN</div>
            <div style={{ fontSize:9, color:'rgba(201,168,76,0.35)', letterSpacing:2 }}>by Milakhin Studio</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            {profile && <>
              {[['👑',profile.wins,'Победы'],['🔥',profile.streak,'Серия'],['💀',profile.losses,'Потери'],['⭐',profile.mmr,'MMR']].map(([icon,val,lbl])=>(
                <div key={String(lbl)} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'rgba(201,168,76,0.4)' }}>{icon} {lbl}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:GOLD }}>{val}</div>
                </div>
              ))}
              <div style={{ width:1, height:32, background:'rgba(201,168,76,0.15)' }}/>
              <div style={{ fontSize:13, color:GOLD, fontWeight:600 }}>{profile.username}</div>
              <button onClick={signOut} style={{ background:'transparent', border:'1px solid rgba(201,168,76,0.2)', borderRadius:8, color:'rgba(201,168,76,0.5)', padding:'6px 12px', fontSize:11, cursor:'pointer' }}>Выйти</button>
            </>}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16 }}>

          {/* Left */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Create */}
            <div style={{ ...panel(), padding:'20px 18px' }}>
              <div style={{ fontSize:11, color:'rgba(201,168,76,0.5)', letterSpacing:2, marginBottom:14 }}>СОЗДАТЬ КОМНАТУ</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <input style={inp} placeholder="Название комнаты" value={roomName} onChange={e=>setRoomName(e.target.value)} autoComplete="off"/>
                <input style={inp} placeholder="Пароль (необязательно)" type="password" value={roomPass} onChange={e=>setRoomPass(e.target.value)} autoComplete="new-password"/>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {([['team','2 × 2','4 игрока'],['solo','Сам за себя','до 6']] as const).map(([mode,title,sub])=>(
                    <button key={mode} onClick={()=>setGameMode(mode)} style={{ padding:'10px 6px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', textAlign:'center', border:`1.5px solid ${gameMode===mode?GOLD:GOLD_DIM+'33'}`, background:gameMode===mode?'linear-gradient(135deg,rgba(201,168,76,0.14),rgba(201,168,76,0.04))':'rgba(255,255,255,0.02)', color:gameMode===mode?GOLD:'#5a4020', transition:'all 0.18s' }}>
                      <div style={{fontSize:12,fontWeight:700}}>{title}</div>
                      <div style={{fontSize:10,opacity:0.6,marginTop:2}}>{sub}</div>
                    </button>
                  ))}
                </div>
                <button onClick={createRoom} disabled={loading} style={gbtn(!loading,{width:'100%'} as any)}>
                  {loading?'Создаём…':'Создать комнату'}
                </button>
              </div>
            </div>

            {/* Rules */}
            <div style={{ ...panel(), padding:'16px 18px' }}>
              <div style={{ fontSize:11, color:'rgba(201,168,76,0.45)', letterSpacing:2, marginBottom:10 }}>ПРАВИЛА</div>
              <div style={{ fontSize:11, color:'rgba(201,168,76,0.5)', lineHeight:2 }}>
                Сила: 4–A · 2 · 3 · 🃏Чёрный · 🃏Красный<br/>
                Тройка бьёт одиночку / пару / стрит<br/>
                Каре бьёт всё<br/>
                ✦ Wild — заменяет любую карту<br/>
                4♠ последней на 1 соперника = +2 очка
              </div>
            </div>
          </div>

          {/* Right: rooms */}
          <div style={{ ...panel(), padding:'18px 16px', display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input style={{...inp,flex:1}} placeholder="🔍  Поиск по названию…" value={search} onChange={e=>setSearch(e.target.value)}/>
              <div style={{ display:'flex', gap:6 }}>
                {([['all','Все'],['team','2×2'],['solo','Solo']] as const).map(([f,lbl])=>(
                  <button key={f} onClick={()=>setModeFilter(f)} style={{ padding:'8px 14px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:12, border:`1px solid ${modeFilter===f?GOLD:GOLD_DIM+'33'}`, background:modeFilter===f?'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.06))':'rgba(255,255,255,0.02)', color:modeFilter===f?GOLD:'#5a4020', transition:'all 0.15s' }}>{lbl}</button>
                ))}
              </div>
            </div>

            <div style={{ height:1, background:`linear-gradient(90deg,transparent,${GOLD_DIM},transparent)` }}/>

            <div style={{ display:'flex', flexDirection:'column', gap:8, overflowY:'auto', maxHeight:500 }}>
              {filtered.length===0 && (
                <div style={{ textAlign:'center', color:'rgba(201,168,76,0.25)', fontSize:13, padding:'60px 0', fontStyle:'italic' }}>
                  {rooms.length===0?'Пока нет комнат — создай первую!':'Нет подходящих комнат'}
                </div>
              )}
              {filtered.map(room=>(
                <motion.div key={room.id} whileHover={{scale:1.005}}
                  style={{ ...panel({border:'1px solid rgba(201,168,76,0.12)'}), padding:'14px 16px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'#e8d5a3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{room.name}</div>
                      {room.password && <span style={{ fontSize:12 }}>🔒</span>}
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={badge(GOLD)}>{room.mode==='team'?'2 × 2':'Solo'}</span>
                      <span style={badge('rgba(200,200,200,0.6)')}>{room.player_count}/{room.max_players} игроков</span>
                      {room.password && <span style={badge('#c08040')}>Закрытая</span>}
                    </div>
                  </div>
                  <div style={{ width:60, textAlign:'center' }}>
                    <div style={{ fontSize:9, color:'rgba(201,168,76,0.4)', marginBottom:4 }}>МЕСТА</div>
                    <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(room.player_count/room.max_players)*100}%`, background:GOLD, borderRadius:2 }}/>
                    </div>
                    <div style={{ fontSize:10, color:GOLD, marginTop:3 }}>{room.max_players-room.player_count} св.</div>
                  </div>
                  <button onClick={()=>joinRoom(room)} disabled={room.player_count>=room.max_players}
                    style={gbtn(room.player_count<room.max_players,{padding:'9px 18px',fontSize:13} as any)}>
                    {room.player_count>=room.max_players?'Полная':'Войти'}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position:'fixed', top:14, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#2d1a00,#6b4f0a)', color:'#f0d080', borderRadius:10, padding:'10px 22px', fontSize:13, fontWeight:600, zIndex:999, border:`1px solid ${GOLD}`, boxShadow:`0 0 24px ${GOLD_GLOW}`, whiteSpace:'nowrap', animation:'popIn 0.2s ease' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
