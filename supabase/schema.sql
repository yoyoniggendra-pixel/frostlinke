create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct','group')),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_members (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id,user_id)
);

create table if not exists message_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade not null,
  recipient_id uuid references profiles(id) on delete cascade not null,
  initial_message text,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique(sender_id,recipient_id,status)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  type text not null default 'text' check (type in ('text','image','video','file','gif','sound','embed')),
  body text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists message_reads (
  message_id uuid references messages(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(message_id,user_id)
);

create table if not exists message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  kind text not null check (kind in ('emoji','image')),
  value text not null,
  created_at timestamptz not null default now(),
  unique(message_id,user_id,kind)
);

create table if not exists starred_tabs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null default 'Important',
  created_at timestamptz not null default now()
);

create table if not exists starred_items (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid references starred_tabs(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  title text,
  kind text not null,
  content jsonb not null default '{}'::jsonb,
  colour text,
  created_at timestamptz not null default now()
);

create table if not exists user_settings (
  user_id uuid primary key references profiles(id) on delete cascade,
  background_url text,
  notifications_enabled boolean not null default true,
  notification_sound_enabled boolean not null default true,
  custom_notification_url text,
  welcome_music_url text,
  welcome_music_name text,
  music_library jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx on messages(conversation_id,created_at desc);
create index if not exists profiles_username_idx on profiles(lower(username));
create index if not exists requests_recipient_status_idx on message_requests(recipient_id,status,created_at desc);

alter table profiles enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
alter table message_reads enable row level security;
alter table message_reactions enable row level security;
alter table message_requests enable row level security;
alter table starred_tabs enable row level security;
alter table starred_items enable row level security;
alter table user_settings enable row level security;

-- The API uses the service role after validating the user's Supabase JWT.
-- These policies are intentionally restrictive for direct client access.
create policy "profiles readable" on profiles for select to authenticated using (true);
create policy "own profile insert" on profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on profiles for update to authenticated using (id = auth.uid());
create policy "own settings" on user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own requests" on message_requests for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
