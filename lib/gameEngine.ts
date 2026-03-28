// ═══════════════════════════════════════════════
//  WHAN GAME ENGINE
// ═══════════════════════════════════════════════

export const SUITS = ['♠','♥','♦','♣'] as const
export const RANK_ORDER = ['4','5','6','7','8','9','10','J','Q','K','A','2','3','BJ','RJ'] as const
export const POWER: Record<string,number> = Object.fromEntries(RANK_ORDER.map((r,i)=>[r,i]))

export type Card = { rank: string; suit: string; id: string }
export type ComboType = 'single'|'pair'|'triple'|'quad'|'straight'|'ashlan'

// Helper to compare combo types safely
const typeIs = (c: Combo, t: string) => (c.type as string) === t
export type Combo = { type: ComboType; power: number; length?: number; cards: Card[] }
export type GamePhase = 'playing'|'roundEnd'

export const cp   = (c: Card) => POWER[c.rank] ?? -1
export const isW  = (c: Card) => c.rank === 'N'
export const isRJ = (c: Card) => c.rank === 'RJ'
export const isBJ = (c: Card) => c.rank === 'BJ'
export const isJk = (c: Card) => c.rank === 'BJ' || c.rank === 'RJ'
export const is4S = (c: Card) => c.rank === '4' && c.suit === '♠'
export const isRed= (c: Card) => c.suit === '♥' || c.suit === '♦'

export function createDeck(): Card[] {
  const d: Card[] = []
  for (const rank of ['4','5','6','7','8','9','10','J','Q','K','A','2','3'])
    for (const suit of SUITS)
      d.push({ rank, suit, id: `${rank}${suit}` })
  d.push({ rank:'BJ', suit:'', id:'BJ' })
  d.push({ rank:'RJ', suit:'', id:'RJ' })
  d.push({ rank:'N',  suit:'', id:'N'  })
  return d
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]]
  }
  return a
}

export function sortHand(h: Card[]): Card[] {
  return [...h].sort((a,b) => {
    const d = cp(a)-cp(b)
    return d !== 0 ? d : SUITS.indexOf(a.suit as any)-SUITS.indexOf(b.suit as any)
  })
}

// ── ASHLAN: 3+ consecutive pairs (e.g. 5-5/6-6/7-7) ─────────
// No jokers/wilds/specials allowed in ashlan
function detectAshlan(cards: Card[]): Combo | null {
  if (cards.length < 6) return null
  if (cards.length % 2 !== 0) return null
  // No specials
  if (cards.some(c => isJk(c) || isW(c) || ['2','3'].includes(c.rank))) return null
  // Group by rank
  const byRank: Record<string, Card[]> = {}
  for (const c of cards) {
    if (!byRank[c.rank]) byRank[c.rank] = []
    byRank[c.rank].push(c)
  }
  const ranks = Object.keys(byRank)
  // All groups must be pairs
  if (!ranks.every(r => byRank[r].length === 2)) return null
  // Must be consecutive
  const powers = ranks.map(r => POWER[r]).sort((a,b)=>a-b)
  for (let i=1;i<powers.length;i++) {
    if (powers[i] !== powers[i-1]+1) return null
  }
  return {
    type: 'ashlan',
    power: powers[powers.length-1],
    length: cards.length / 2, // number of pairs
    cards
  }
}

export function detectCombo(cards: Card[]): Combo | null {
  if (!cards?.length) return null

  const n = cards.length
  const wilds = cards.filter(isW)
  const real  = cards.filter(c=>!isW(c))
  const wc    = wilds.length

  if (wc === n) return null

  if (n === 1) {
    if (wc === 1) return null
    return { type:'single', power:cp(real[0]), cards }
  }
  if (n === 2) {
    if (wc === 1) return { type:'pair', power:cp(real[0]), cards }
    if (real[0].rank === real[1].rank) return { type:'pair', power:cp(real[0]), cards }
    return null
  }
  if (n === 3) {
    if (wc === 2 && real.length >= 1) return { type:'triple', power:cp(real[0]), cards }
    if (wc === 1 && real.length === 2 && real[0].rank === real[1].rank)
      return { type:'triple', power:cp(real[0]), cards }
    if (wc === 0 && real.every(c=>c.rank===real[0].rank))
      return { type:'triple', power:cp(real[0]), cards }
    return null
  }
  if (n === 4) {
    const u = Array.from(new Set(real.map(c=>c.rank)))
    if (u.length <= 1 && real.length + wc === 4)
      return { type:'quad', power:cp(real[0] ?? {rank:'4',suit:'',id:''}), cards }
  }

  // Try ashlan BEFORE straight (6+ even cards, consecutive pairs)
  if (n >= 6 && n % 2 === 0 && wc === 0) {
    const ash = detectAshlan(cards)
    if (ash) return ash
  }

  if (n >= 4) {
    // Straight cannot contain 2, 3, jokers or wilds
    if (real.some(c => isJk(c) || ['2','3'].includes(c.rank))) return null
    const powers = real.map(cp).sort((a,b)=>a-b)
    // Max straight power is A (index 10), so powers must be <= 10
    if (powers[powers.length-1] > POWER['A']) return null
    if (wc === 0) {
      let ok = true
      for (let i=1;i<powers.length;i++) if(powers[i]!==powers[i-1]+1){ok=false;break}
      if (ok) return { type:'straight', power:powers[powers.length-1], length:n, cards }
    } else if (wc === 1) {
      let gaps = 0
      for (let i=1;i<powers.length;i++) gaps+=powers[i]-powers[i-1]-1
      if (gaps <= 1 && powers[powers.length-1]+gaps <= POWER['A'])
        return { type:'straight', power:powers[powers.length-1]+gaps, length:n, cards }
    }
  }
  return null
}

export function canBeat(atk: Combo, def: Combo): boolean {
  const atkType = atk.type as string
  const defType = def.type as string

  // Quad beats everything
  if (defType === 'quad') return true

  // Red Joker single can't be beaten except by quad
  if (atkType === 'single' && isRJ(atk.cards[0])) return false

  // Ashlan can ONLY be beaten by quad (handled above) — nothing else
  if (atkType === 'ashlan') return false

  // Triple beats single/pair/straight/ashlan
  if (defType === 'triple') {
    if (['single','pair','straight','ashlan'].includes(atkType)) return true
    if (atkType === 'triple') return def.power > atk.power
    return false
  }

  // Same type comparison
  if (atkType === defType) {
    if (atkType === 'straight') return (def.length||0) === (atk.length||0) && def.power > atk.power
    return def.power > atk.power
  }
  return false
}

export function nextActive(from: number, elim: number[], total: number): number {
  let next = (from+1) % total, t = 0
  while (elim.includes(next) && t < total) { next=(next+1)%total; t++ }
  return next
}

export const TEAMS = [[0,2],[1,3]]

export function comboLabel(c: Combo): string {
  const labels: Record<string,string> = {
    single:'Одиночка', pair:'Пара', triple:'Тройка', quad:'Каре', straight:'Стрит', ashlan:'Ашлян'
  }
  if (c.type === 'ashlan') return `Ашлян (${c.length} пар)`
  return `${labels[c.type]||c.type}${c.type==='straight'?` ×${c.length}`:''}`
}

// ── AI ──────────────────────────────────────────────────────
function groupByRank(hand: Card[]) {
  const g: Record<string,Card[]> = {}
  for (const c of hand.filter(c=>!isW(c)&&!isJk(c))) {
    if (!g[c.rank]) g[c.rank]=[]
    g[c.rank].push(c)
  }
  return Object.fromEntries(Object.entries(g).sort((a,b)=>cp({rank:a[0],suit:'',id:''})-cp({rank:b[0],suit:'',id:''})))
}

export function aiChoosePlay(hand: Card[], tableCombo: Combo|null, mustFirst: boolean): Card[]|null {
  // mustFirst just means this player goes first — they can play ANY valid combo
  const wilds = hand.filter(isW)
  const byRank = groupByRank(hand)
  const sorted = sortHand(hand.filter(c=>!isW(c)))
  if (!tableCombo) return sorted.length ? [sorted[0]] : null
  const type = tableCombo.type

  if (type==='single') {
    for (const c of sorted) { const combo=detectCombo([c]); if(combo&&canBeat(tableCombo,combo)) return [c] }
    for (const [,cards] of Object.entries(byRank)) {
      if (cards.length>=3) { const combo=detectCombo(cards.slice(0,3)); if(combo&&canBeat(tableCombo,combo)) return cards.slice(0,3) }
    }
    return null
  }
  if (type==='pair') {
    for (const [rank,cards] of Object.entries(byRank)) {
      if (cards.length>=2 && cp({rank,suit:'',id:''})>tableCombo.power) return cards.slice(0,2)
      if (cards.length>=1 && wilds.length>=1 && cp({rank,suit:'',id:''})>tableCombo.power) return [cards[0],wilds[0]]
    }
    for (const [,cards] of Object.entries(byRank)) {
      if (cards.length>=3) { const combo=detectCombo(cards.slice(0,3)); if(combo&&canBeat(tableCombo,combo)) return cards.slice(0,3) }
    }
    return null
  }
  if (type==='triple') {
    for (const [,cards] of Object.entries(byRank)) {
      if (cards.length>=3) { const combo=detectCombo(cards.slice(0,3)); if(combo&&canBeat(tableCombo,combo)) return cards.slice(0,3) }
    }
    for (const [,cards] of Object.entries(byRank)) { if(cards.length>=4) return cards.slice(0,4) }
    return null
  }
  if (type==='straight') {
    const nonSpec = sortHand(hand.filter(c=>!isJk(c)&&!isW(c)))
    for (let i=0;i<=nonSpec.length-(tableCombo.length||4);i++) {
      const sl = nonSpec.slice(i,i+(tableCombo.length||4))
      const combo = detectCombo(sl)
      if (combo&&canBeat(tableCombo,combo)) return sl
    }
    for (const [,cards] of Object.entries(byRank)) {
      if (cards.length>=3) { const combo=detectCombo(cards.slice(0,3)); if(combo&&canBeat(tableCombo,combo)) return cards.slice(0,3) }
    }
    return null
  }
  if (type==='ashlan') {
    // Try to beat with quad
    for (const [,cards] of Object.entries(byRank)) { if(cards.length>=4) return cards.slice(0,4) }
    return null
  }
  return null
}

// ── Initial game state ───────────────────────────────────────
export function createInitialGameState(playerNames: string[], mode: 'team'|'solo', scores=[0,0], round=1) {
  const playerCount = playerNames.length
  const deck = shuffle(createDeck())
  const hands: Card[][] = Array.from({length:playerCount},()=>[])
  deck.forEach((card,i) => hands[i%playerCount].push(card))
  const sorted = hands.map(sortHand)
  let sp = sorted.findIndex(h=>h.some(is4S))
  if (sp<0) sp=0
  return {
    hands: sorted,
    currentPlayer: sp,
    roundStarter: sp,
    nextRoundStarter: null as number|null,
    tableCombo: null as Combo|null,
    lastPlayer: null as number|null,
    passCount: 0,
    eliminated: [] as number[],
    mustPlay4S: false, // 4♠ just determines WHO goes first, not what they must play
    phase: 'playing' as GamePhase,
    winner: null as number|string|null,
    winPoints: 1,
    scores,
    round,
    playerNames,
    playerCount,
    mode,
    crownPlayer: null as number|null,
    log: [`Игра началась • ${playerNames[sp]} ходит первым (у него 4♠)`],
  }
}
