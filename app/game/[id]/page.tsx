'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type Card, type Combo,
  detectCombo, canBeat, sortHand, nextActive, aiChoosePlay,
  is4S, isW, isJk, isRJ, isBJ, isRed, comboLabel, TEAMS
} from '@/lib/gameEngine'

const GOLD = '#c9a84c'
const GOLD_DIM = '#7a6020'
const GOLD_GLOW = 'rgba(201,168,76,0.35)'
const panel = (extra={}) => ({ background:'rgba(18,14,4,0.88)', border:'1px solid rgba(201,168,76,0.18)', borderRadius:16, backdropFilter:'blur(12px)', ...extra })
const gbtn = (active=true, extra={}) => ({ padding:'10px 22px', borderRadius:12, border:`1px solid ${active?GOLD:GOLD_DIM+'44'}`, background:active?'linear-gradient(135deg,#3d2a00,#6b4a0a,#3d2a00)':'rgba(255,255,255,0.03)', color:active?'#f0d080':'#5a4820', cursor:active?'pointer':'not-allowed', fontSize:14, fontWeight:600, boxShadow:active?`0 2px 16px ${GOLD_GLOW}`:'none', transition:'all 0.18s', ...extra })

// ── Card components ──────────────────────────────────────────
function CardFace({ card, selected, onClick, dim, small, tableCard }: { card:Card; selected?:boolean; onClick?:()=>void; dim?:boolean; small?:boolean; tableCard?:boolean }) {
  const gold4s = is4S(card), wild = isW(card), rj = isRJ(card), bj = isBJ(card), jk = isJk(card), red = isRed(card)
  const w = small?34:52, h = small?50:76

  const bg = gold4s ? 'linear-gradient(160deg,#ffe97a,#c9a84c,#7a4f00)'
    : rj  ? 'linear-gradient(160deg,#6b0000,#c0392b,#4a0000)'
    : bj  ? 'linear-gradient(160deg,#0a0a0a,#1a1a1a,#050505)'
    : wild? 'linear-gradient(160deg,#2a1f08,#1a1208)'
    : selected ? 'linear-gradient(160deg,#2a1f08,#1a1004)'
    : 'linear-gradient(160deg,#f5ede0,#e8d8c0)'

  const border = gold4s?'#ffd700': rj?'#ff4444': bj?'#888': selected?GOLD: wild?'#8b6914':'rgba(140,110,70,0.5)'
  const txt = gold4s?'#3d2000': rj?'#ffaaaa': bj?'#cccccc': wild?GOLD: red?'#8b1a1a':'#1a1209'
  const shadow = gold4s ? '0 0 18px rgba(255,215,0,0.6),0 4px 12px rgba(0,0,0,0.5)'
    : rj ? '0 0 14px rgba(255,50,50,0.5),0 4px 10px rgba(0,0,0,0.5)'
    : bj ? '0 0 10px rgba(255,255,255,0.1),0 4px 10px rgba(0,0,0,0.6)'
    : selected ? `0 0 20px ${GOLD_GLOW},0 6px 14px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.35)'

  return (
    <motion.div
      onClick={onClick}
      initial={tableCard ? { y:-30, opacity:0, scale:0.8, rotate: Math.random()*10-5 } : false}
      animate={tableCard ? { y:0, opacity:1, scale:1, rotate:0 } : {}}
      transition={tableCard ? { type:'spring', damping:14, stiffness:200 } : {}}
      whileHover={onClick ? { y:-10, scale:1.06, boxShadow:`0 0 22px ${GOLD_GLOW}` } : {}}
      whileTap={onClick ? { scale:0.96 } : {}}
      style={{ width:w, height:h, background:bg, border:`${selected||gold4s?'2':'1.5'}px solid ${border}`, borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:onClick?'pointer':'default', flexShrink:0, opacity:dim?0.35:1, boxShadow:selected?`0 0 20px ${GOLD_GLOW},0 6px 14px rgba(0,0,0,0.5)`:shadow, transform:selected?'translateY(-14px)':'none', transition:'transform 0.16s,box-shadow 0.16s', userSelect:'none', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:3, left:4, fontSize:small?7:10, fontWeight:700, color:txt, lineHeight:1 }}>
        {wild?'W': rj?'RED': bj?'BLK': card.rank}
      </div>
      <div style={{ position:'absolute', top:small?12:16, left:4, fontSize:small?7:9, color:txt }}>
        {wild?'✦': jk?'🃏': card.suit}
      </div>
      <div style={{ fontSize:small?10:14, color:txt, fontWeight:'bold' }}>
        {wild?'✦': rj?<span style={{fontSize:small?16:24}}>🃏</span>: bj?<span style={{fontSize:small?16:24,filter:'grayscale(1) brightness(1.5)'}}>🃏</span>: card.suit}
      </div>
      <div style={{ position:'absolute', bottom:3, right:4, fontSize:small?7:10, fontWeight:700, color:txt, transform:'rotate(180deg)' }}>
        {wild?'W': rj?'RED': bj?'BLK': card.rank}
      </div>
      {gold4s && <div style={{ position:'absolute', inset:0, background:'linear-gradient(120deg,transparent 30%,rgba(255,255,255,0.25) 50%,transparent 70%)', animation:'shimmer 2.5s infinite' }}/>}
      {selected && <div style={{ position:'absolute', inset:0, background:'linear-gradient(120deg,transparent 20%,rgba(201,168,76,0.12) 50%,transparent 80%)', animation:'shimmer 1.8s infinite' }}/>}
    </motion.div>
  )
}

function CardBack({ small }: { small?: boolean }) {
  const w=small?28:52, h=small?40:76
  return <div style={{ width:w, height:h, flexShrink:0, background:'linear-gradient(145deg,#120c02,#1e1508,#120c02)', border:'1.5px solid rgba(201,168,76,0.2)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ fontSize:9, color:'rgba(201,168,76,0.25)' }}>✦</div></div>
}

// ── Win effect with gold particles ───────────────────────────
function WinEffect({ show, winner }: { show: boolean; winner: any }) {
  if (!show) return null
  const particles = Array.from({length:24},(_,i)=>i)
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          style={{ position:'fixed', inset:0, zIndex:150, pointerEvents:'none', overflow:'hidden' }}>
          {/* Gold particles */}
          {particles.map(i=>(
            <motion.div key={i}
              initial={{ x:`${Math.random()*100}vw`, y:'110vh', opacity:1, scale:Math.random()*0.6+0.4 }}
              animate={{ y:`-${Math.random()*60+20}vh`, x:`${Math.random()*100}vw`, opacity:0, rotate:Math.random()*720 }}
              transition={{ duration:Math.random()*1.5+1, delay:Math.random()*0.8, ease:'easeOut' }}
              style={{ position:'absolute', width:i%3===0?12:i%3===1?8:6, height:i%3===0?12:i%3===1?8:6, borderRadius:i%2===0?'50%':2, background:i%4===0?GOLD:i%4===1?'#f5e070':i%4===2?'#ffffff':'rgba(201,168,76,0.6)' }}
            />
          ))}
          {/* Center glow */}
          <motion.div initial={{scale:0,opacity:0}} animate={{scale:[0,1.5,1],opacity:[0,0.6,0]}} transition={{duration:0.8}}
            style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:300, height:300, borderRadius:'50%', background:`radial-gradient(circle,${GOLD_GLOW} 0%,transparent 70%)` }}/>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Smoke() {
  return <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>{[...Array(5)].map((_,i)=><div key={i} style={{ position:'absolute', bottom:-60, left:`${10+i*18}%`, width:`${60+i*20}px`, height:`${60+i*20}px`, background:'radial-gradient(circle,rgba(201,168,76,0.055) 0%,transparent 70%)', borderRadius:'50%', animation:`smokeRise ${7+i*0.8}s ${i*1.4}s infinite ease-in` }}/>)}</div>
}

function FourSpadeEffect({ show }: { show: boolean }) {
  return (
    <AnimatePresence>{show&&<motion.div initial={{opacity:0,scale:0.5}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:1.5}} transition={{duration:0.4}} style={{ position:'fixed',inset:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none' }}>
      <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse,rgba(255,215,0,0.18) 0%,transparent 70%)' }}/>
      <motion.div animate={{rotate:[0,10,-10,0],scale:[1,1.15,1]}} transition={{repeat:2,duration:0.3}} style={{ fontSize:72,filter:'drop-shadow(0 0 30px gold)' }}>♠</motion.div>
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} style={{ position:'absolute',top:'55%',fontSize:22,fontWeight:'bold',color:GOLD,letterSpacing:4 }}>4 ПИКИ!</motion.div>
    </motion.div>}</AnimatePresence>
  )
}

// ── Main Game Page ───────────────────────────────────────────
export default function GamePage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.id as string

  const [gs, setGs]           = useState<any>(null)
  const [myId, setMyId]       = useState('')
  const [myUsername, setMyUsername] = useState('')
  const [mySeat, setMySeat]   = useState(-1) // -1 = not loaded yet
  const [seatLoaded, setSeatLoaded] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [show4S, setShow4S]   = useState(false)
  const [toast, setToast]     = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [logOpen, setLogOpen]   = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const animRef = useRef(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const prevMsgCount = useRef(0)

  useEffect(()=>{
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  },[messages, chatOpen])

  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''),2500) }

  useEffect(()=>{
    if (chatOpen) {
      setUnreadCount(0)
      prevMsgCount.current = messages.length
    }
  },[chatOpen])

  useEffect(()=>{
    if (!chatOpen && messages.length > prevMsgCount.current) {
      setUnreadCount(messages.length - prevMsgCount.current)
    }
    if (chatOpen) prevMsgCount.current = messages.length
  },[messages.length])

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if (!data.user) { router.push('/auth'); return }
      setMyId(data.user.id)
      supabase.from('room_players').select('seat').eq('room_id',roomId).eq('player_id',data.user.id).single().then(({data:p})=>{ 
        if(p) { setMySeat(p.seat); setSeatLoaded(true) }
        else setSeatLoaded(true) // spectator mode
      })
      supabase.from('profiles').select('username').eq('id',data.user.id).single().then(({data:p})=>{ if(p) setMyUsername(p.username) })
    })
    loadGameState()
    loadMessages()

    const ch = supabase.channel(`game-${roomId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'game_states',filter:`room_id=eq.${roomId}`},({new:n})=>{ if(n) setGs((n as any).state) })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'room_messages',filter:`room_id=eq.${roomId}`},(payload)=>{
        setMessages(prev=>[...prev, payload.new])
        setUnreadCount(prev => prev + 1)
      })
      .subscribe()
    
    // Polling fallback every 3 seconds
    const interval = setInterval(loadGameState, 3000)
    return ()=>{ supabase.removeChannel(ch); clearInterval(interval) }
  },[roomId])

  async function loadGameState() {
    const { data } = await supabase.from('game_states').select('state').eq('room_id',roomId).single()
    if (data) setGs(data.state)
  }

  async function loadMessages() {
    const { data } = await supabase.from('room_messages').select('*').eq('room_id',roomId).order('created_at',{ascending:true}).limit(50)
    if (data) setMessages(data)
  }

  async function sendMessage() {
    const msg = msgInput.trim()
    if (!msg || !myUsername) return
    setMsgInput('')
    await supabase.from('room_messages').insert({ room_id:roomId, player_id:myId, username:myUsername, message:msg })
  }

  function formatTime(ts: string) {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  }

  async function pushState(newGs: any) {
    setGs(newGs)
    await supabase.from('game_states').update({ state:newGs, updated_at:new Date().toISOString() }).eq('room_id',roomId)
  }

  // ── Apply play ──
  const applyPlay = useCallback(async (g: any, seat: number, cards: Card[]) => {
    const combo = detectCombo(cards)
    if (!combo) return
    const newH = g.hands.map((h:Card[],i:number)=>i===seat?h.filter((c:Card)=>!cards.find(s=>s.id===c.id)):h)
    const newElim = [...g.eliminated]
    const played4S = cards.length===1 && is4S(cards[0])
    const pc = g.playerCount || g.playerNames?.length || (g.mode==='team'?4:6)

    if (played4S) { setShow4S(true); setTimeout(()=>setShow4S(false),1800) }

    let firstOut = g.nextRoundStarter
    if (newH[seat].length===0 && !newElim.includes(seat)) {
      newElim.push(seat)
      if (firstOut===null) firstOut=seat
    }

    const mode = g.mode
    let winnerResult: any = null, pts = 1, nextStarter = firstOut

    if (mode==='team' && pc===4) {
      for (let ti=0;ti<TEAMS.length;ti++) {
        if (TEAMS[ti].every((p:number)=>newElim.includes(p))) {
          winnerResult=ti
          const oppActive=TEAMS[1-ti].filter((p:number)=>!newElim.includes(p))
          if (played4S && oppActive.length===1) { pts=2; nextStarter=seat }
          break
        }
      }
    } else {
      // Solo or non-standard count: last player standing wins
      if (newElim.length>=pc-1) winnerResult='solo'
    }

    const next = nextActive(seat, newElim, pc)
    let newCrownPlayer = g.crownPlayer ?? null

    // 4♠ coronation: last card against single opponent
    if (played4S && newH[seat].length===0) {
      const activeOpponents = Array.from({length:pc},(_,i)=>i)
        .filter(i=>i!==seat && !newElim.includes(i))
      if (activeOpponents.length === 1) {
        newCrownPlayer = activeOpponents[0]
        pts = 2
        nextStarter = seat
      }
    }

    const newGs = { ...g, hands:newH, tableCombo:combo, lastPlayer:seat, currentPlayer:next, passCount:0, mustPlay4S:false, eliminated:newElim, nextRoundStarter:nextStarter, phase:winnerResult!==null?'roundEnd':'playing', winner:winnerResult, winPoints:pts, crownPlayer:newCrownPlayer, log:[`${g.playerNames[seat]} ▶ ${comboLabel(combo)}`,...(g.log||[])].slice(0,30) }

    if (winnerResult!==null) {
      const newScores=[...g.scores]
      if (mode==='team') newScores[winnerResult]+=pts
      newGs.scores=newScores
      newGs.log=[`🏆 ${mode==='team'&&pc===4?`Команда ${winnerResult===0?'A':'B'} победила`:'Победитель!'} ${pts>1?'• 4♠ бонус!':''}`, ...newGs.log].slice(0,30)

      // Update MMR for the real player
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id || myId
      if (uid) {
        let mmrDelta = 0
        if (mode==='team' && pc===4) {
          const myTeam = TEAMS.findIndex((t:number[])=>t.includes(mySeat))
          const isWin = winnerResult === myTeam
          mmrDelta = isWin ? (pts>1?20:10) : -5
        } else {
          const elimOrder = newElim.indexOf(mySeat)
          if (elimOrder === 0) mmrDelta = 10        // первый вышел = победитель +10
          else if (elimOrder === -1) mmrDelta = -10  // последний = проигравший -10
          else mmrDelta = 5                           // середина +5
        }
        const { data: prof } = await supabase.from('profiles').select('mmr,wins,losses,streak').eq('id',uid).single()
        if (prof) {
          await supabase.from('profiles').update({
            mmr: Math.max(0, (prof.mmr||1000) + mmrDelta),
            wins: mmrDelta > 0 ? (prof.wins||0)+1 : prof.wins,
            losses: mmrDelta < 0 ? (prof.losses||0)+1 : prof.losses,
            streak: mmrDelta > 0 ? (prof.streak||0)+1 : 0,
          }).eq('id',uid)
        }
      }
    }
    await pushState(newGs)
  }, [mySeat, myId, roomId])

  function setCrownInState(victim: number) { /* handled in state */ }

  // ── Apply pass ──
  const applyPass = useCallback(async (g: any, seat: number) => {
    const pc = g.playerCount || g.playerNames?.length || (g.mode==='team'?4:6)
    const active = pc-g.eliminated.length
    const newPC  = g.passCount+1
    const next   = nextActive(seat, g.eliminated, pc)

    if (newPC>=active-1) {
      const goNext = (g.lastPlayer!==null && !g.eliminated.includes(g.lastPlayer)) ? g.lastPlayer : next
      await pushState({ ...g, tableCombo:null, lastPlayer:null, currentPlayer:goNext, passCount:0, roundStarter:goNext, log:[`Стол очищен — ход у ${g.playerNames[goNext]}`,...(g.log||[])].slice(0,30) })
    } else {
      await pushState({ ...g, currentPlayer:next, passCount:newPC, log:[`${g.playerNames[seat]} — пас`,...(g.log||[])].slice(0,30) })
    }
  }, [roomId])

  // ── AI ── (only host controls bots)
  useEffect(()=>{
    if (!gs || gs.phase!=='playing') return
    if (gs.currentPlayer===mySeat) return
    if (animRef.current) return

    // Only act if current player is a bot
    const botSeats: number[] = gs.botSeats || []
    if (!botSeats.includes(gs.currentPlayer)) return

    // Only the host (seat 0) controls bots to avoid conflicts
    // If no bots, skip. If mySeat is not the lowest real player seat, skip.
    const realSeats = Array.from({length:gs.playerCount||gs.playerNames?.length||4},(_,i)=>i).filter((s:number)=>!botSeats.includes(s))
    const hostSeat = realSeats.length > 0 ? Math.min(...realSeats) : 0
    if (mySeat !== hostSeat) return

    const t = setTimeout(async()=>{
      if (animRef.current) return
      animRef.current=true
      try {
        const p = gs.currentPlayer
        const pc = gs.playerCount || gs.playerNames?.length || (gs.mode==='team'?4:6)
        const hand: Card[] = gs.hands[p]||[]
        if (!hand.length || gs.eliminated.includes(p)) {
          await pushState({...gs,currentPlayer:nextActive(p,gs.eliminated,pc)})
          return
        }
        const playCards = aiChoosePlay(hand, gs.tableCombo, false)
        if (playCards) {
          const combo = detectCombo(playCards)
          if (combo && (!gs.tableCombo || canBeat(gs.tableCombo,combo))) {
            await applyPlay(gs, p, playCards)
          } else { await applyPass(gs, p) }
        } else { await applyPass(gs, p) }
      } finally {
        animRef.current=false
      }
    }, 900)
    return ()=>{ clearTimeout(t); animRef.current=false }
  },[gs?.currentPlayer, gs?.phase, gs?.passCount, mySeat])

  // ── Human actions ──
  async function handlePlay() {
    if (!gs) return
    const myHand: Card[] = gs.hands[mySeat]||[]
    const selCards = myHand.filter((c:Card)=>selected.includes(c.id))
    if (!selCards.length) return
    const combo = detectCombo(selCards)
    if (!combo) { showToast('❌ Недопустимая комбинация'); return }
    if (gs.tableCombo && !canBeat(gs.tableCombo,combo)) { showToast('❌ Не бьёт стол'); return }
    await applyPlay(gs, mySeat, selCards)
    setSelected([])
  }

  async function handlePass() {
    if (!gs || gs.currentPlayer!==mySeat) return
    if (!gs.tableCombo) { showToast('❌ Нельзя пасовать на пустом столе'); return }
    await applyPass(gs, mySeat)
    setSelected([])
  }

  async function nextRound() {
    if (!gs) return
    const { createInitialGameState } = await import('@/lib/gameEngine')
    const newGs = createInitialGameState(gs.playerNames, gs.mode, gs.scores, gs.round+1)
    newGs.botSeats = gs.botSeats || []
    newGs.crownPlayer = gs.crownPlayer ?? null
    // Clear spectators - they join next round
    newGs.spectators = []
    if (gs.nextRoundStarter!==null) {
      newGs.currentPlayer=gs.nextRoundStarter
      newGs.roundStarter=gs.nextRoundStarter
      newGs.mustPlay4S=false
      newGs.log=[`Раунд ${newGs.round} • ${gs.playerNames[gs.nextRoundStarter]} ходит первым`]
    }
    await pushState(newGs)
    setSelected([])
  }

  if (!gs || !seatLoaded) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:GOLD, fontSize:18 }}>Загрузка игры…</div>

  const showWin = gs.phase==='roundEnd'
  // Check if player joined mid-game (spectator until next round)
  const spectatorInfo = (gs.spectators||[]).find((s:any)=>s.seat===mySeat)
  const isSpectator = spectatorInfo && spectatorInfo.joinRound === gs.round

  const myHand   = sortHand(gs.hands[mySeat]||[])
  const isMyTurn = gs.currentPlayer===mySeat && gs.phase==='playing' && !isSpectator
  const myDone   = gs.eliminated.includes(mySeat)
  const selCards: Card[] = myHand.filter((c:Card)=>selected.includes(c.id))
  const selCombo = selCards.length ? detectCombo(selCards) : null
  const mode     = gs.mode
  // Use hands array length as single source of truth for player count
  const pc       = Array.isArray(gs.hands) ? gs.hands.length : (gs.playerCount || gs.playerNames?.length || 4)
  const topSeats = Array.from({length:pc},(_,i)=>i).filter(i=>i!==mySeat)

  function toggleCard(id: string) {
    if (!isMyTurn) return
    setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])
  }

  return (
    <div style={{ minHeight:'100vh', padding:'10px 8px 28px', color:'#e8d5a3', fontFamily:"Georgia,serif", position:'relative', overflow:'hidden' }}>
      <Smoke/>
      <FourSpadeEffect show={show4S}/>
      <WinEffect show={showWin} winner={gs.winner}/>
      <div style={{ position:'fixed', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${GOLD},transparent)`, zIndex:10 }}/>

      {toast && <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#2d1a00,#6b4f0a)', color:'#f0d080', borderRadius:10, padding:'10px 22px', fontSize:13, fontWeight:600, zIndex:999, border:`1px solid ${GOLD}`, boxShadow:`0 0 24px ${GOLD_GLOW}`, whiteSpace:'nowrap' }}>{toast}</div>}

      <div style={{ maxWidth:500, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* Top bar */}
        <div style={{ ...panel(), padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:9, color:'rgba(201,168,76,0.4)', letterSpacing:2 }}>🪔 WHAN</div>
            <div style={{ fontSize:11, color:'rgba(201,168,76,0.55)', marginTop:2 }}>
              Раунд начал: <span style={{color:GOLD,fontWeight:600}}>{gs.playerNames[gs.roundStarter]}</span>
              {' · '}Ходит: <span style={{color:GOLD,fontWeight:600}}>{gs.playerNames[gs.currentPlayer]}</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            {mode==='team' && <div style={{ textAlign:'center' }}><div style={{fontSize:9,color:'rgba(201,168,76,0.4)'}}>Счёт</div><div style={{fontSize:14,color:GOLD,fontWeight:700}}>{gs.scores[0]} : {gs.scores[1]}</div></div>}
            <button onClick={()=>router.push('/')} style={{ background:'transparent', border:'none', color:'rgba(201,168,76,0.4)', cursor:'pointer', fontSize:13 }}>⏻</button>
          </div>
        </div>

        {/* Opponents */}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(topSeats.length,3)},1fr)`, gap:6, marginBottom:10 }}>
          {topSeats.map(seat=>{
            const done = gs.eliminated.includes(seat)
            const active = gs.currentPlayer===seat
            const ally = mode==='team' && TEAMS[TEAMS.findIndex((t:number[])=>t.includes(mySeat))].includes(seat)
            const hasCrown = gs.crownPlayer===seat
            return (
              <motion.div key={seat} animate={{scale:active?1.04:1}}
                style={{ ...panel(), padding:'8px 6px', textAlign:'center', border:`1.5px solid ${active?GOLD:ally?'rgba(201,168,76,0.2)':'rgba(255,255,255,0.06)'}`, boxShadow:active?`0 0 16px ${GOLD_GLOW}`:'none', position:'relative', opacity:done?0.5:1, transition:'all 0.25s' }}>
                <AnimatePresence>
                  {hasCrown && <motion.div initial={{y:-10,opacity:0,scale:0.5}} animate={{y:-20,opacity:1,scale:1}} exit={{opacity:0}} style={{ position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',fontSize:16,filter:'drop-shadow(0 0 6px gold)' }}>👑</motion.div>}
                </AnimatePresence>
                {gs.roundStarter===seat && !active && <div style={{ position:'absolute',top:6,right:6,width:5,height:5,borderRadius:'50%',background:GOLD }}/>}
                <div style={{ fontSize:9, color:'rgba(201,168,76,0.4)', marginBottom:2 }}>{mode==='team'?(ally?'союзник':'соперник'):'соперник'}</div>
                <div style={{ fontSize:11, fontWeight:600, color:active?GOLD:'#b0976a', marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {gs.playerNames[seat]}{active?' 🪔':''}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:2, justifyContent:'center', minHeight:36, alignItems:'center' }}>
                  {done ? <span style={{fontSize:9,color:GOLD}}>вышел ✓</span>
                    : (gs.hands[seat]||[]).slice(0,5).map((_:any,i:number)=><CardBack key={i} small/>)}
                  {!done && (gs.hands[seat]||[]).length>5 && <span style={{fontSize:8,color:'rgba(201,168,76,0.3)'}}>+{(gs.hands[seat]||[]).length-5}</span>}
                </div>
                <div style={{ fontSize:9, color:'rgba(201,168,76,0.25)', marginTop:3 }}>{done?'—':`${(gs.hands[seat]||[]).length} карт`}</div>
              </motion.div>
            )
          })}
        </div>

        {/* Table */}
        <div style={{ ...panel(), padding:'12px 10px', marginBottom:10, minHeight:110, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:9, color:'rgba(201,168,76,0.3)', letterSpacing:3, marginBottom:5 }}>♦  СТОЛ  ♦</div>
          {gs.tableCombo ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap' }}>
                {gs.tableCombo.cards.map((c:Card, i:number)=><CardFace key={c.id} card={c} tableCard/>)}
              </div>
              <div style={{ fontSize:10, marginTop:5, color:'rgba(201,168,76,0.45)' }}>
                {comboLabel(gs.tableCombo)}{gs.lastPlayer!==null?` · ${gs.playerNames[gs.lastPlayer]}`:''}
              </div>
            </div>
          ) : <div style={{ color:'rgba(201,168,76,0.2)', fontStyle:'italic', fontSize:13 }}>Стол пуст — играй что хочешь</div>}
        </div>

        {/* Status */}
        <div style={{ textAlign:'center', fontSize:12, marginBottom:6, minHeight:18 }}>
          {gs.phase==='roundEnd'
            ? <span style={{color:GOLD,fontWeight:700}}>🏆 {mode==='team'?`Команда ${gs.winner===0?'A':'B'} победила`:'Solo раунд завершён'} {gs.winPoints>1?'• +2 бонус!':''}</span>
            : myDone ? <span style={{color:GOLD}}>✅ Ты вышел! Союзник продолжает…</span>
            : isMyTurn ? <span style={{color:GOLD,fontWeight:600}}>🪔 Твой ход</span>
            : <span style={{color:'rgba(201,168,76,0.4)'}}>Ждём {gs.playerNames[gs.currentPlayer]}…</span>}
        </div>

        {/* My hand - hidden for spectator */}
        {!isSpectator && <div style={{ ...panel(), padding:'8px 6px', marginBottom:8, border:`1.5px solid ${isMyTurn?GOLD+'66':'rgba(201,168,76,0.1)'}`, boxShadow:isMyTurn?`0 0 18px ${GOLD_GLOW}`:'none', transition:'all 0.3s' }}>
          <div style={{ fontSize:9, color:'rgba(201,168,76,0.35)', textAlign:'center', marginBottom:6, letterSpacing:2 }}>
            {myDone?'ВЫШЕЛ 🎉':`ТВОИ КАРТЫ (${myHand.length})`}
          </div>
          {myDone ? <div style={{textAlign:'center',fontSize:24,padding:8}}>🎉</div>
            : <div style={{ display:'flex', flexWrap:'wrap', gap:4, justifyContent:'center', maxHeight:220, overflowY:'auto' }}>
                {myHand.map((card:Card)=><CardFace key={card.id} card={card} selected={selected.includes(card.id)} onClick={isMyTurn?()=>toggleCard(card.id):undefined} dim={!isMyTurn&&gs.phase==='playing'}/>)}
              </div>}
        </div>}

        {/* Selection */}
        {selCards.length>0 && <div style={{ textAlign:'center', fontSize:12, marginBottom:6, color:'rgba(201,168,76,0.7)' }}>
          {selCards.length} карт · {selCombo?<span style={{color:GOLD}}>✓ {comboLabel(selCombo)}</span>:<span style={{color:'#8b1a1a'}}>✗ Недопустимо</span>}
        </div>}

        {/* Spectator banner */}
        {isSpectator && (
          <div style={{ ...panel(), padding:'12px 16px', marginBottom:8, textAlign:'center', border:'1px solid rgba(255,165,0,0.3)', background:'rgba(255,165,0,0.06)' }}>
            <div style={{ fontSize:13, color:'#f39c12', fontWeight:600 }}>👁 Ты зритель</div>
            <div style={{ fontSize:11, color:'rgba(255,165,0,0.6)', marginTop:4 }}>Присоединишься к следующему раунду</div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          {gs.phase==='roundEnd' ? <>
            <button onClick={nextRound} style={gbtn(true,{flex:1} as any)}>▶ Новый раунд</button>
            <button onClick={()=>router.push('/')} style={gbtn(false,{flex:1,color:GOLD_DIM,border:`1px solid ${GOLD_DIM}33`,cursor:'pointer'} as any)}>Лобби</button>
          </> : <>
            <button onClick={handlePlay} disabled={!isMyTurn||!selCards.length} style={gbtn(isMyTurn&&!!selCards.length,{flex:2} as any)}>ИГРАТЬ</button>
            <button onClick={handlePass} disabled={!isMyTurn||!gs.tableCombo} style={gbtn(false,{flex:1,color:isMyTurn&&gs.tableCombo?GOLD:GOLD_DIM,border:`1px solid ${isMyTurn&&gs.tableCombo?GOLD_DIM:'rgba(255,255,255,0.05)'}`,cursor:isMyTurn&&gs.tableCombo?'pointer':'not-allowed'} as any)}>ПАС</button>
            <button onClick={()=>{ setChatOpen(o=>!o); setUnreadCount(0); prevMsgCount.current = messages.length }} style={{ padding:'10px 12px', borderRadius:12, border:`1px solid ${chatOpen?GOLD:'rgba(201,168,76,0.2)'}`, background:chatOpen?`rgba(201,168,76,0.15)`:'rgba(255,255,255,0.03)', color:chatOpen?GOLD:'rgba(201,168,76,0.5)', cursor:'pointer', fontSize:16, position:'relative' }}>
              💬
              {unreadCount>0 && !chatOpen && (
                <div style={{ position:'absolute', top:-6, right:-6, minWidth:18, height:18, borderRadius:9, background:'#e74c3c', color:'white', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', border:'2px solid #0a0800' }}>
                  {unreadCount>9?'9+':unreadCount}
                </div>
              )}
            </button>
          </>}
        </div>

        {/* Log dropdown */}
        <button onClick={()=>setLogOpen(o=>!o)} style={{ width:'100%', padding:'7px 12px', borderRadius:10, border:'1px solid rgba(201,168,76,0.08)', background:'rgba(255,255,255,0.02)', color:'rgba(201,168,76,0.4)', cursor:'pointer', fontFamily:'inherit', fontSize:11, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:logOpen?0:0 }}>
          <span>📋 История ходов</span>
          <span>{logOpen?'▲':'▼'}</span>
        </button>
        <AnimatePresence>
          {logOpen && (
            <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} style={{ overflow:'hidden' }}>
              <div style={{ ...panel(), padding:'8px 10px', fontSize:10, color:'rgba(201,168,76,0.45)', maxHeight:140, overflowY:'auto', border:'1px solid rgba(201,168,76,0.06)', borderRadius:12, marginTop:4 }}>
                {(gs.log||[]).length===0 ? <span style={{opacity:0.4}}>Нет ходов</span>
                  : (gs.log||[]).map((l:string,i:number)=><div key={i} style={{borderBottom:'1px solid rgba(201,168,76,0.04)',padding:'2px 0'}}>{l}</div>)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat bottom sheet */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
              transition={{type:'spring',damping:28,stiffness:260}}
              style={{ position:'fixed', bottom:0, left:0, right:0, height:'40vh', background:'rgba(8,4,1,0.97)', borderTop:`1px solid rgba(201,168,76,0.25)`, borderRadius:'16px 16px 0 0', zIndex:60, display:'flex', flexDirection:'column', backdropFilter:'blur(20px)' }}>
              {/* Handle + header */}
              <div style={{ padding:'8px 14px 6px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(201,168,76,0.08)', flexShrink:0, position:'relative' }}>
                <div style={{ width:36, height:4, background:'rgba(201,168,76,0.2)', borderRadius:2, position:'absolute', left:'50%', transform:'translateX(-50%)', top:8 }}/>
                <div style={{ fontSize:12, fontWeight:600, color:GOLD, marginTop:4 }}>💬 Чат</div>
                <button onClick={()=>setChatOpen(false)} style={{ background:'transparent', border:'none', color:'rgba(201,168,76,0.5)', fontSize:20, cursor:'pointer', padding:'0 4px', lineHeight:1 }}>×</button>
              </div>
              {/* Messages */}
              <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:'8px 12px', display:'flex', flexDirection:'column', gap:6 }}>
                {messages.length===0 && <div style={{ textAlign:'center', color:'rgba(201,168,76,0.2)', fontSize:11, marginTop:16, fontStyle:'italic' }}>Напиши первым! 👋</div>}
                {messages.map((msg:any)=>{
                  const isMe = msg.player_id===myId
                  return (
                    <div key={msg.id} style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', gap:6, alignItems:'flex-end' }}>
                      <div style={{ maxWidth:'75%' }}>
                        {!isMe && <div style={{ fontSize:9, color:'rgba(201,168,76,0.4)', marginBottom:2, paddingLeft:4 }}>{msg.username}</div>}
                        <div style={{ background:isMe?'linear-gradient(135deg,#3d2a00,#6b4a0a)':'rgba(255,255,255,0.07)', border:`1px solid ${isMe?'rgba(201,168,76,0.3)':'rgba(255,255,255,0.08)'}`, borderRadius:isMe?'12px 12px 4px 12px':'12px 12px 12px 4px', padding:'6px 10px', fontSize:12, color:'#e8d5a3', lineHeight:1.4, wordBreak:'break-word' }}>
                          {msg.message}
                        </div>
                        <div style={{ fontSize:9, color:'rgba(201,168,76,0.25)', marginTop:2, paddingLeft:4, textAlign:isMe?'right':'left' }}>{formatTime(msg.created_at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Input */}
              <div style={{ padding:'8px 10px 16px', borderTop:'1px solid rgba(201,168,76,0.08)', display:'flex', gap:8, flexShrink:0, background:'rgba(8,4,1,0.97)', paddingBottom:'max(16px, env(safe-area-inset-bottom))' }}>
                <input
                  style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:22, padding:'10px 16px', color:'#e8d5a3', fontSize:16, outline:'none', fontFamily:'inherit' }}
                  placeholder="Сообщение…" value={msgInput}
                  onChange={e=>setMsgInput(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&sendMessage()}
                  onFocus={()=>{
                    // Scroll to bottom of messages when keyboard opens
                    setTimeout(()=>{ if(chatRef.current) chatRef.current.scrollTop=chatRef.current.scrollHeight }, 400)
                  }}
                  maxLength={200}
                  enterKeyHint="send"
                />
                <button onClick={sendMessage} disabled={!msgInput.trim()}
                  style={{ width:44, height:44, borderRadius:'50%', cursor:msgInput.trim()?'pointer':'default', border:`1px solid ${GOLD}44`, background:msgInput.trim()?`linear-gradient(135deg,#3d2a00,#6b4a0a)`:'transparent', color:msgInput.trim()?GOLD:'rgba(201,168,76,0.3)', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>➤</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ position:'fixed', bottom:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${GOLD},transparent)`, zIndex:10 }}/>
      </div>
    </div>
  )
}
