-- Run this in Supabase SQL Editor

-- Profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  mmr integer default 1000,
  wins integer default 0,
  losses integer default 0,
  streak integer default 0,
  created_at timestamptz default now()
);

-- Rooms table
create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  password text,
  mode text default 'team' check (mode in ('team','solo')),
  status text default 'waiting' check (status in ('waiting','playing','finished')),
  host_id uuid references profiles(id),
  player_count integer default 1,
  max_players integer default 4,
  created_at timestamptz default now()
);

-- Room players
create table if not exists room_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references profiles(id) on delete cascade,
  seat integer not null,
  is_ready boolean default false,
  joined_at timestamptz default now(),
  primary key (room_id, player_id)
);

-- Game states
create table if not exists game_states (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade unique,
  state jsonb not null,
  updated_at timestamptz default now()
);

-- Enable realtime
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_players;
alter publication supabase_realtime add table game_states;

-- RLS Policies
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table room_players enable row level security;
alter table game_states enable row level security;

create policy "Public profiles" on profiles for select using (true);
create policy "Own profile" on profiles for all using (auth.uid() = id);

create policy "Public rooms" on rooms for select using (true);
create policy "Create room" on rooms for insert with check (auth.uid() = host_id);
create policy "Update room" on rooms for update using (true);

create policy "Room players read" on room_players for select using (true);
create policy "Room players write" on room_players for all using (true);

create policy "Game state read" on game_states for select using (true);
create policy "Game state write" on game_states for all using (true);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'Player_' || substr(new.id::text, 1, 6)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
