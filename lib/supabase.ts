import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } }
})

export type Profile = {
  id: string
  username: string
  mmr: number
  wins: number
  losses: number
  streak: number
  created_at: string
}

export type Room = {
  id: string
  name: string
  password: string | null
  mode: 'team' | 'solo'
  status: 'waiting' | 'playing' | 'finished'
  host_id: string
  player_count: number
  max_players: number
  created_at: string
}

export type GameState = {
  id: string
  room_id: string
  state: any
  updated_at: string
}
