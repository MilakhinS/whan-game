'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Profile, type Room } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { THEMES, type ThemeName } from '@/lib/themes'

export default function HomePage() {
  const router = useRouter()
  const [profile, setProfile]       = useState<Profile|null>(null)
  const [rooms, setRooms]           = useState<Room[]>([])
  const [leaders, setLeaders]       = useState<Profile[]>([])
  const [search, setSearch]         = useState('')
  const [modeFilter, setModeFilter] = useState<'all'|'team'|'solo'>('all')
  const [roomName, setRoomName]     = useState('')
  const [roomPass, setRoomPass]     = useState('')
  const [gameMode, setGameMode]     = useState<'team'|'solo'>('team')
  const [pendingRoom, setPendingRoom] = useState<Room|null>(null)
  const [enterPass, setEnterPass]   = useState('')
  const [passError, setPassError]   = useState('')
  const [toast, setToast]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [activeTab, setActiveTab]   = useState<'rooms'|'create'|'leaders'|'profile'>('rooms')
  const [themeName, setThemeName]   = useState<ThemeName>('hookah')
  const [editUsername, setEditUsername] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [activeGames, setActiveGames] = useState<Room[]>([])

  const T = THEMES[themeName]

  const panel = (extra={}) => ({ background:T.panel, border:`1px solid ${T.panelBorder}`, borderRadius:20, backdropFilter:'blur(12px)', ...extra } as any)
  const gbtn = (active=true, extra={}) => ({ padding:'10px 22px', borderRadius:12, border:`1px solid ${active?T.gold:T.goldDim+'44'}`, background:active?`linear-gradient(135deg,${T.goldDim}88,${T.goldDim}cc,${T.goldDim}88)`:'rgba(255,255,255,0.03)', color:active?T.text:T.goldDim, cursor:active?'pointer':'not-allowed', fontSize:18, fontWeight:600, boxShadow:active?`0 2px 16px ${T.goldGlow}`:'none', transition:'all 0.18s', ...extra } as any)
  const inp = { background:'rgba(255,255,255,0.04)', border:`1px solid ${T.goldDim}55`, borderRadius:12, padding:'10px 14px', color:T.text, fontSize:18, outline:'none', width:'100%', boxSizing:'border-box' as const, fontFamily:'inherit' }
  const badge = (color=T.gold) => ({ display:'inline-block', padding:'2px 10px', borderRadius:20, border:`1px solid ${color}44`, background:`${color}18`, color, fontSize:19, fontWeight:600 })

  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  useEffect(()=>{
    // Apply theme to body
    document.body.style.background = T.bg
  },[themeName])

  useEffect(()=>{
    const params = new URLSearchParams(window.location.search)
    if (params.get('timeout')) {
      showToast('⏱ Игра закрыта из-за бездействия')
      window.history.replaceState({}, '', '/')
    }
  },[])

  useEffect(()=>{
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth'); return }
      const uid = session.user.id
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
      if (!prof) {
        const username = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Player'
        await supabase.from('profiles').insert({ id: uid, username })
        loadProfile(uid)
      } else {
        setProfile(prof)
        setEditUsername(prof.username)
        if (prof.theme) setThemeName(prof.theme as ThemeName)
        else {
          // Load from localStorage as fallback
          const saved = localStorage.getItem('whan-theme') as ThemeName
          if (saved && THEMES[saved]) setThemeName(saved)
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const uid = session.user.id
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
        if (!prof) {
          const username = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Player'
          await supabase.from('profiles').insert({ id: uid, username })
          loadProfile(uid)
        } else {
          setProfile(prof)
          setEditUsername(prof.username)
          if (prof.theme) setThemeName(prof.theme as ThemeName)
        }
      } else if (event === 'SIGNED_OUT') { router.push('/auth') }
    })

    loadRooms()
    loadActiveGames()
    loadLeaders()
    const channel = supabase.channel('rooms').on('postgres_changes',{event:'*',schema:'public',table:'rooms'},()=>{ loadRooms(); loadActiveGames() }).subscribe()
    const interval = setInterval(()=>{ loadRooms(); loadActiveGames() }, 5000)
    return () => { supabase.removeChannel(channel); subscription.unsubscribe(); clearInterval(interval) }
  },[])

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id',uid).single()
    if (data) { setProfile(data); setEditUsername(data.username); if(data.theme) setThemeName(data.theme as ThemeName) }
  }

  async function loadRooms() {
    const { data } = await supabase.from('rooms').select('*').eq('status','waiting').order('created_at',{ascending:false}).limit(20)
    if (data) setRooms(data)
  }

  async function loadActiveGames() {
    const { data } = await supabase.from('rooms').select('*').eq('status','playing').order('created_at',{ascending:false}).limit(10)
    if (data) setActiveGames(data)
  }

  async function loadLeaders() {
    const { data } = await supabase.from('profiles').select('*').order('mmr',{ascending:false}).limit(50)
    if (data) setLeaders(data)
  }

  async function saveProfile() {
    if (!profile || !editUsername.trim()) return
    if (editUsername.length < 3) { showToast('Никнейм минимум 3 символа'); return }
    setSavingProfile(true)
    await supabase.from('profiles').update({ username: editUsername.trim(), theme: themeName }).eq('id', profile.id)
    localStorage.setItem('whan-theme', themeName)
    await loadProfile(profile.id)
    showToast('✓ Профиль сохранён!')
    setSavingProfile(false)
  }

  async function applyTheme(t: ThemeName) {
    setThemeName(t)
    localStorage.setItem('whan-theme', t)
    if (profile) await supabase.from('profiles').update({ theme: t }).eq('id', profile.id)
  }

  async function createRoom() {
    if (!roomName.trim()) { showToast('Введите название'); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const maxP = gameMode==='team'?4:6
    await supabase.from('rooms').delete().eq('host_id', user.id).eq('status','waiting').eq('player_count',0)
    const { data, error } = await supabase.from('rooms').insert({ name:roomName.trim(), password:roomPass.trim()||null, mode:gameMode, host_id:user.id, player_count:1, max_players:maxP, status:'waiting' }).select().single()
    if (error) { showToast('Ошибка создания'); setLoading(false); return }
    await supabase.from('room_players').insert({ room_id:data.id, player_id:user.id, seat:0, is_ready:false })
    setRoomName(''); setRoomPass('')
    setLoading(false)
    router.push(`/room/${data.id}`)
  }

  async function joinActiveGame(room: Room) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    // Check if already in game
    const { data: existing } = await supabase.from('room_players').select('*').eq('room_id', room.id).eq('player_id', user.id).single()
    if (existing) { router.push(`/game/${room.id}`); return }

    // Get game state to find free/bot seats
    const { data: gsData } = await supabase.from('game_states').select('state').eq('room_id', room.id).single()
    if (!gsData) { showToast('Игра не найдена'); return }

    const gs = gsData.state
    const { data: players } = await supabase.from('room_players').select('*').eq('room_id', room.id)
    const takenSeats = (players||[]).filter((p:any)=>!p.is_bot).map((p:any)=>p.seat)
    const botPlayers = (players||[]).filter((p:any)=>p.is_bot)
    const pc = gs.playerCount || gs.playerNames?.length || room.max_players
    const allSeats = Array.from({length:pc},(_,i)=>i)

    // First try free seats, then bot seats
    const freeSeat = allSeats.find(s=>!takenSeats.includes(s) && !botPlayers.find((b:any)=>b.seat===s))
    const botSeat = botPlayers[0]

    if (freeSeat !== undefined) {
      // Join free seat
      await supabase.from('room_players').insert({ room_id:room.id, player_id:user.id, seat:freeSeat, is_ready:true })
      // Update player name in game state
      const newNames = [...gs.playerNames]
      newNames[freeSeat] = profile?.username || 'Игрок'
      const newBotSeats = (gs.botSeats||[]).filter((s:number)=>s!==freeSeat)
      await supabase.from('game_states').update({ state:{...gs, playerNames:newNames, botSeats:newBotSeats, spectators:[...(gs.spectators||[]), {seat:freeSeat, joinRound:gs.round}]}, updated_at:new Date().toISOString() }).eq('room_id',room.id)
      router.push(`/game/${room.id}`)
    } else if (botSeat) {
      // Replace bot
      await supabase.from('room_players').delete().eq('room_id',room.id).eq('player_id',botSeat.player_id)
      await supabase.from('room_players').insert({ room_id:room.id, player_id:user.id, seat:botSeat.seat, is_ready:true })
      const newNames = [...gs.playerNames]
      newNames[botSeat.seat] = profile?.username || 'Игрок'
      const newBotSeats = (gs.botSeats||[]).filter((s:number)=>s!==botSeat.seat)
      await supabase.from('game_states').update({ state:{...gs, playerNames:newNames, botSeats:newBotSeats, spectators:[...(gs.spectators||[]), {seat:botSeat.seat, joinRound:gs.round}]}, updated_at:new Date().toISOString() }).eq('room_id',room.id)
      router.push(`/game/${room.id}`)
    } else {
      showToast('Нет свободных мест')
    }
  }

  async function joinRoom(room: Room) {
    if (room.player_count >= room.max_players) { showToast('Комната заполнена'); return }
    if (room.password) { setPendingRoom(room); setEnterPass(''); setPassError('') }
    else doJoin(room,'')
  }

  async function doJoin(room: Room, pass: string) {
    if (room.password && pass !== room.password) { setPassError('Неверный пароль'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const { data: players } = await supabase.from('room_players').select('seat').eq('room_id',room.id)
    const taken = (players||[]).map((p:any)=>p.seat)
    const seat = [0,1,2,3,4,5].find(s=>!taken.includes(s)) ?? 0
    await supabase.from('room_players').upsert({ room_id:room.id, player_id:user.id, seat, is_ready:false })
    await supabase.from('rooms').update({ player_count: (players||[]).length+1 }).eq('id',room.id)
    setPendingRoom(null)
    router.push(`/room/${room.id}`)
  }

  async function signOut() { await supabase.auth.signOut(); router.push('/auth') }

  const filtered = rooms.filter(r=>{ const m=modeFilter==='all'||r.mode===modeFilter; const s=r.name.toLowerCase().includes(search.toLowerCase()); return m&&s })
  const medalEmoji = (i:number) => i===0?'🥇':i===1?'🥈':i===2?'🥉':'  '
  const myRank = leaders.findIndex(l=>l.id===profile?.id)

  return (
    <div style={{ minHeight:'100vh', maxWidth:600, margin:'0 auto', padding:'12px 12px 80px', position:'relative', color:T.text, fontFamily:"Roboto,-apple-system,sans-serif" }}>

      {/* Smoke */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
        {[...Array(6)].map((_,i)=><div key={i} style={{ position:'absolute', bottom:-60, left:`${10+i*15}%`, width:`${60+i*20}px`, height:`${60+i*20}px`, background:`radial-gradient(circle,${T.smoke} 0%,transparent 70%)`, borderRadius:'50%', animation:`smokeRise ${7+i*0.8}s ${i*1.4}s infinite ease-in` }}/>)}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${T.gold},transparent)`, opacity:0.5 }}/>
      </div>

      {/* Password modal */}
      <AnimatePresence>
        {pendingRoom && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
            onClick={e=>{ if(e.target===e.currentTarget) setPendingRoom(null) }}>
            <motion.div initial={{scale:0.85,y:20}} animate={{scale:1,y:0}}
              style={{ ...panel(), padding:'24px 20px', width:'100%', maxWidth:360, border:`1px solid ${T.gold}44` }}>
              <div style={{ fontSize:19, color:`${T.gold}88`, letterSpacing:2, marginBottom:6 }}>ВХОД В КОМНАТУ</div>
              <div style={{ fontSize:19, fontWeight:700, color:T.gold, marginBottom:16 }}>{pendingRoom.name}</div>
              <input style={{...inp,marginBottom:8}} placeholder="Введите пароль" type="password" value={enterPass} onChange={e=>{setEnterPass(e.target.value);setPassError('')}} onKeyDown={e=>e.key==='Enter'&&doJoin(pendingRoom,enterPass)} autoFocus/>
              {passError && <div style={{ fontSize:18, color:'#e74c3c', marginBottom:10 }}>{passError}</div>}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setPendingRoom(null)} style={gbtn(false,{flex:1,cursor:'pointer'})}>Отмена</button>
                <button onClick={()=>doJoin(pendingRoom,enterPass)} style={gbtn(true,{flex:2})}>Войти</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position:'relative', zIndex:1 }}>

        {/* Header */}
        <div style={{ ...panel(), padding:'12px 16px', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ fontSize:24, fontWeight:700, letterSpacing:5, background:`linear-gradient(180deg,#f5e070,${T.gold})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>WHAN</div>
              <div style={{ fontSize:19, color:`${T.gold}55`, letterSpacing:1 }}>by Milakhin Studio</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {profile && <div style={{ fontSize:19, color:T.gold, fontWeight:600 }}>{profile.username}</div>}
              <button onClick={signOut} style={{ background:'transparent', border:`1px solid ${T.goldDim}44`, borderRadius:8, color:`${T.gold}66`, padding:'5px 10px', fontSize:19, cursor:'pointer' }}>Выйти</button>
            </div>
          </div>
          {profile && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
              {[['👑',profile.wins,'Победы'],['🔥',profile.streak,'Серия'],['💀',profile.losses,'Потери'],['⭐',profile.mmr,'MMR']].map(([icon,val,lbl])=>(
                <div key={String(lbl)} style={{ ...panel({border:`1px solid ${T.goldDim}33`}), padding:'8px 4px', textAlign:'center' }}>
                  <div style={{ fontSize:19, color:`${T.gold}66` }}>{icon} {lbl}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:T.gold, marginTop:2 }}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ROOMS TAB */}
        {activeTab==='rooms' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <input style={inp} placeholder="🔍  Поиск…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <div style={{ display:'flex', gap:6 }}>
              {([['all','Все'],['team','2×2'],['solo','Solo']] as const).map(([f,lbl])=>(
                <button key={f} onClick={()=>setModeFilter(f)} style={{ flex:1, padding:'9px 6px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:18, border:`1px solid ${modeFilter===f?T.gold:T.goldDim+'33'}`, background:modeFilter===f?`${T.gold}22`:'rgba(255,255,255,0.02)', color:modeFilter===f?T.gold:T.goldDim, transition:'all 0.15s' }}>{lbl}</button>
              ))}
            </div>

            {/* Active games */}
            {activeGames.length > 0 && (
              <div>
                <div style={{ fontSize:18, color:`${T.gold}66`, letterSpacing:2, marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#27ae60', boxShadow:'0 0 6px #27ae60' }}/>
                  ИДЁТ ИГРА
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {activeGames.map(room=>(
                    <motion.div key={room.id} whileHover={{scale:1.01}}
                      style={{ ...panel({border:`1px solid rgba(39,174,96,0.25)`}), padding:'12px 14px', display:'flex', alignItems:'center', gap:12, background:'rgba(39,174,96,0.04)' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                          <div style={{ fontSize:19, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{room.name}</div>
                          <span style={{ fontSize:19, color:'#27ae60', background:'rgba(39,174,96,0.15)', border:'1px solid rgba(39,174,96,0.3)', borderRadius:10, padding:'1px 6px' }}>В игре</span>
                        </div>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={badge(T.gold)}>{room.mode==='team'?'2×2':'Solo'}</span>
                          <span style={badge(`${T.text}88`)}>{room.player_count}/{room.max_players} 👤</span>
                        </div>
                      </div>
                      <button onClick={()=>joinActiveGame(room)}
                        style={{ padding:'8px 14px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:18, fontWeight:600, border:'1px solid rgba(39,174,96,0.4)', background:'rgba(39,174,96,0.12)', color:'#27ae60', flexShrink:0 }}>
                        Войти
                      </button>
                    </motion.div>
                  ))}
                </div>
                <div style={{ height:1, background:`linear-gradient(90deg,transparent,${T.goldDim}44,transparent)`, margin:'10px 0' }}/>
              </div>
            )}

            {/* Waiting rooms */}
            {filtered.length===0 ? (
              <div style={{ textAlign:'center', color:`${T.gold}33`, fontSize:19, padding:'40px 0', fontStyle:'italic' }}>
                {rooms.length===0?'Пока нет комнат — создай! ➕':'Нет комнат'}
              </div>
            ) : filtered.map(room=>(
              <motion.div key={room.id} whileHover={{scale:1.01}}
                style={{ ...panel({border:`1px solid ${T.goldDim}33`}), padding:'14px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                    <div style={{ fontSize:18, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{room.name}</div>
                    {room.password && <span>🔒</span>}
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                    <span style={badge(T.gold)}>{room.mode==='team'?'2×2':'Solo'}</span>
                    <span style={badge(`${T.text}88`)}>{room.player_count}/{room.max_players} 👤</span>
                    <div style={{ width:40, height:3, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(room.player_count/room.max_players)*100}%`, background:T.gold, borderRadius:2 }}/>
                    </div>
                  </div>
                </div>
                <button onClick={()=>joinRoom(room)} disabled={room.player_count>=room.max_players} style={gbtn(room.player_count<room.max_players,{padding:'10px 16px',fontSize:19,flexShrink:0})}>
                  {room.player_count>=room.max_players?'Полная':'Войти'}
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* CREATE TAB */}
        {activeTab==='create' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ ...panel(), padding:'20px 16px' }}>
              <div style={{ fontSize:19, color:`${T.gold}88`, letterSpacing:2, marginBottom:14 }}>НОВАЯ КОМНАТА</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <input style={inp} placeholder="Название комнаты" value={roomName} onChange={e=>setRoomName(e.target.value)} autoComplete="off"/>
                <input style={inp} placeholder="Пароль (необязательно)" type="password" value={roomPass} onChange={e=>setRoomPass(e.target.value)} autoComplete="new-password"/>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {([['team','2 × 2','4 игрока'],['solo','Сам за себя','до 6']] as const).map(([mode,title,sub])=>(
                    <button key={mode} onClick={()=>setGameMode(mode)} style={{ padding:'14px 6px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', textAlign:'center', border:`1.5px solid ${gameMode===mode?T.gold:T.goldDim+'33'}`, background:gameMode===mode?`${T.gold}18`:'rgba(255,255,255,0.02)', color:gameMode===mode?T.gold:T.goldDim, transition:'all 0.18s' }}>
                      <div style={{fontSize:18,fontWeight:700}}>{title}</div>
                      <div style={{fontSize:18,opacity:0.6,marginTop:2}}>{sub}</div>
                    </button>
                  ))}
                </div>
                <button onClick={createRoom} disabled={loading} style={gbtn(!loading,{padding:'14px',fontSize:19})}>
                  {loading?'Создаём…':'🎴 Создать комнату'}
                </button>
              </div>
            </div>
            <div style={{ ...panel(), padding:'16px' }}>
              <div style={{ fontSize:19, color:`${T.gold}66`, letterSpacing:2, marginBottom:10 }}>ПРАВИЛА</div>
              <div style={{ fontSize:18, color:`${T.gold}88`, lineHeight:2 }}>
                Сила: 4–A · 2 · 3 · 🃏Чёрный · 🃏Красный<br/>
                Тройка бьёт одиночку / пару / стрит / ашлян<br/>
                Каре бьёт всё · Ашлян — 3+ пары подряд<br/>
                ✦ Wild — заменяет любую карту<br/>
                4♠ последней на 1 соперника = +2 очка
              </div>
            </div>
          </div>
        )}

        {/* LEADERS TAB */}
        {activeTab==='leaders' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {profile && myRank >= 0 && (
              <div style={{ ...panel({border:`1px solid ${T.gold}44`}), padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ fontSize:24, width:36, textAlign:'center' }}>{myRank<3?medalEmoji(myRank):`#${myRank+1}`}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:T.gold }}>{profile.username} <span style={{ fontSize:19, color:`${T.gold}66` }}>(вы)</span></div>
                  <div style={{ fontSize:19, color:`${T.gold}66`, marginTop:2 }}>{profile.wins} побед · {profile.streak} серия</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:24, fontWeight:700, color:T.gold }}>{profile.mmr}</div>
                  <div style={{ fontSize:18, color:`${T.gold}44` }}>MMR</div>
                </div>
              </div>
            )}
            <div style={{ height:1, background:`linear-gradient(90deg,transparent,${T.goldDim},transparent)` }}/>
            {leaders.length >= 3 && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1.2fr 1fr', gap:8, marginBottom:4 }}>
                <div style={{ ...panel({border:`1px solid ${T.goldDim}33`}), padding:'14px 8px', textAlign:'center', alignSelf:'flex-end' }}>
                  <div style={{ fontSize:24 }}>🥈</div>
                  <div style={{ fontSize:18, fontWeight:600, color:T.text, marginTop:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{leaders[1]?.username}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:'#c0c0c0', marginTop:4 }}>{leaders[1]?.mmr}</div>
                </div>
                <div style={{ ...panel({border:`1px solid ${T.gold}55`, background:`${T.gold}11`}), padding:'20px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:30 }}>🥇</div>
                  <div style={{ fontSize:19, fontWeight:700, color:T.gold, marginTop:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{leaders[0]?.username}</div>
                  <div style={{ fontSize:24, fontWeight:700, color:T.gold, marginTop:4 }}>{leaders[0]?.mmr}</div>
                </div>
                <div style={{ ...panel({border:`1px solid ${T.goldDim}33`}), padding:'14px 8px', textAlign:'center', alignSelf:'flex-end' }}>
                  <div style={{ fontSize:24 }}>🥉</div>
                  <div style={{ fontSize:18, fontWeight:600, color:T.text, marginTop:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{leaders[2]?.username}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:'#cd7f32', marginTop:4 }}>{leaders[2]?.mmr}</div>
                </div>
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {leaders.map((player,i)=>{
                const isMe = player.id===profile?.id
                return (
                  <motion.div key={player.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.03}}
                    style={{ ...panel({border:`1px solid ${isMe?T.gold+'44':T.goldDim+'22'}`}), padding:'10px 14px', display:'flex', alignItems:'center', gap:12, background:isMe?`${T.gold}08`:undefined }}>
                    <div style={{ fontSize:i<3?20:13, width:32, textAlign:'center', color:i<3?undefined:`${T.gold}55`, fontWeight:600 }}>{i<3?medalEmoji(i):`#${i+1}`}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:19, fontWeight:isMe?700:500, color:isMe?T.gold:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {player.username}{isMe?' 👈':''}
                      </div>
                      <div style={{ fontSize:18, color:`${T.gold}55`, marginTop:1 }}>{player.wins}W · {player.losses}L · {player.streak}🔥</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:18, fontWeight:700, color:i===0?T.gold:i===1?'#c0c0c0':i===2?'#cd7f32':T.text }}>{player.mmr}</div>
                      <div style={{ fontSize:19, color:`${T.gold}44` }}>MMR</div>
                    </div>
                  </motion.div>
                )
              })}
              {leaders.length===0 && <div style={{ textAlign:'center', color:`${T.gold}33`, fontSize:19, padding:'60px 0', fontStyle:'italic' }}>Сыграй первым! 🎴</div>}
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab==='profile' && profile && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Avatar + name */}
            <div style={{ ...panel(), padding:'20px 16px', textAlign:'center' }}>
              <div style={{ width:72, height:72, borderRadius:'50%', background:`linear-gradient(135deg,${T.goldDim},${T.gold})`, margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, color:'#000', boxShadow:`0 0 24px ${T.goldGlow}` }}>
                {profile.username[0]?.toUpperCase()}
              </div>
              <div style={{ fontSize:18, fontWeight:700, color:T.gold }}>{profile.username}</div>
              <div style={{ fontSize:19, color:`${T.gold}55`, marginTop:4 }}>MMR {profile.mmr}</div>
            </div>

            {/* Edit username */}
            <div style={{ ...panel(), padding:'18px 16px' }}>
              <div style={{ fontSize:19, color:`${T.gold}88`, letterSpacing:2, marginBottom:12 }}>ИЗМЕНИТЬ НИКНЕЙМ</div>
              <input style={inp} placeholder="Новый никнейм" value={editUsername} onChange={e=>setEditUsername(e.target.value)} maxLength={20}/>
              <div style={{ fontSize:18, color:`${T.gold}44`, marginTop:6 }}>{editUsername.length}/20 символов</div>
            </div>

            {/* Theme selector */}
            <div style={{ ...panel(), padding:'18px 16px' }}>
              <div style={{ fontSize:19, color:`${T.gold}88`, letterSpacing:2, marginBottom:14 }}>ТЕМА ОФОРМЛЕНИЯ</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][]).map(([key, theme])=>(
                  <button key={key} onClick={()=>applyTheme(key)}
                    style={{ padding:'14px 16px', borderRadius:14, cursor:'pointer', fontFamily:'inherit', textAlign:'left', border:`2px solid ${themeName===key?theme.gold:theme.goldDim+'33'}`, background:themeName===key?`${theme.gold}18`:'rgba(255,255,255,0.02)', transition:'all 0.2s', display:'flex', alignItems:'center', gap:14 }}>
                    {/* Color preview */}
                    <div style={{ width:36, height:36, borderRadius:10, background:theme.bg, border:`1px solid ${theme.gold}66`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                      {theme.emoji}
                    </div>
                    <div>
                      <div style={{ fontSize:18, fontWeight:600, color:theme.gold }}>{theme.name}</div>
                      <div style={{ fontSize:19, color:`${theme.gold}66`, marginTop:2 }}>
                        {key==='hookah'?'Тёмный · Золотой':key==='midnight'?'Тёмный · Фиолетовый':'Тёмный · Нефритовый'}
                      </div>
                    </div>
                    {themeName===key && <div style={{ marginLeft:'auto', fontSize:18, color:theme.gold }}>✓</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Save button */}
            <button onClick={saveProfile} disabled={savingProfile} style={gbtn(!savingProfile,{padding:'14px',fontSize:19,width:'100%'})}>
              {savingProfile?'Сохраняем…':'💾 Сохранить'}
            </button>

            {/* Stats */}
            <div style={{ ...panel(), padding:'16px' }}>
              <div style={{ fontSize:19, color:`${T.gold}88`, letterSpacing:2, marginBottom:12 }}>СТАТИСТИКА</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['🏆 Победы',profile.wins],['💀 Поражения',profile.losses],['🔥 Серия',profile.streak],['⭐ MMR',profile.mmr]].map(([lbl,val])=>(
                  <div key={String(lbl)} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${T.goldDim}33`, borderRadius:12, padding:'12px', textAlign:'center' }}>
                    <div style={{ fontSize:18, color:`${T.gold}66` }}>{lbl}</div>
                    <div style={{ fontSize:24, fontWeight:700, color:T.gold, marginTop:4 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:600, background:`${T.bgSolid}f5`, borderTop:`1px solid ${T.goldDim}33`, backdropFilter:'blur(12px)', zIndex:50, display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', padding:'8px 12px 12px', gap:6 }}>
        {([['rooms','🎮','Комнаты'],['create','➕','Создать'],['leaders','🏆','Рейтинг'],['profile','👤','Профиль']] as const).map(([tab,icon,lbl])=>(
          <button key={tab} onClick={()=>{ setActiveTab(tab); if(tab==='leaders') loadLeaders() }} style={{ padding:'8px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', border:'none', background:activeTab===tab?`${T.gold}22`:'transparent', color:activeTab===tab?T.gold:`${T.gold}44`, transition:'all 0.18s', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <span style={{ fontSize:18 }}>{icon}</span>
            <span style={{ fontSize:19, fontWeight:activeTab===tab?700:400 }}>{lbl}</span>
          </button>
        ))}
      </div>

      {toast && (
        <div style={{ position:'fixed', top:14, left:'50%', transform:'translateX(-50%)', background:`linear-gradient(135deg,${T.goldDim}cc,${T.goldDim})`, color:T.text, borderRadius:10, padding:'10px 22px', fontSize:19, fontWeight:600, zIndex:999, border:`1px solid ${T.gold}`, boxShadow:`0 0 24px ${T.goldGlow}`, whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}

      <style>{`@keyframes smokeRise{0%{transform:translateY(0) scale(1);opacity:0}20%{opacity:1}100%{transform:translateY(-80vh) scale(3);opacity:0}}`}</style>
    </div>
  )
}
