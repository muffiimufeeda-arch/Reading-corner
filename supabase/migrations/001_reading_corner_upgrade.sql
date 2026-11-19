-- Non-destructive Reading Corner Upgrade Migration (Supabase / PostgreSQL)
-- Preserves all existing tables, users, reading history, bookmarks, and saved books.
-- Safe to run multiple times (IF NOT EXISTS).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. User Profiles & Phone Auth Metadata
CREATE TABLE IF NOT EXISTS public.rc_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 text UNIQUE NOT NULL,
  phone_verified boolean NOT NULL DEFAULT false,
  full_name text NOT NULL,
  display_handle text NOT NULL,
  bio text NOT NULL DEFAULT '',
  avatar_path text,
  theme text NOT NULL DEFAULT 'instagram' CHECK (theme IN ('instagram', 'emerald', 'dark')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Personal NFC Card & Revocable Secret Links
CREATE TABLE IF NOT EXISTS public.rc_nfc_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.rc_profiles(id) ON DELETE CASCADE,
  token_hash text UNIQUE,
  token_ciphertext text,
  revoked boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Blocking System (Backend-enforced)
CREATE TABLE IF NOT EXISTS public.rc_blocked_users (
  blocker_id uuid NOT NULL REFERENCES public.rc_profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.rc_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- 4. Private Media Objects
CREATE TABLE IF NOT EXISTS public.rc_media_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.rc_profiles(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.rc_profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image', 'video', 'audio')),
  mime_type text NOT NULL,
  storage_path text NOT NULL,
  original_name text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Real-time Private Messages & Read Receipts
CREATE TABLE IF NOT EXISTS public.rc_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_key text NOT NULL,
  sender_id uuid NOT NULL REFERENCES public.rc_profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.rc_profiles(id) ON DELETE CASCADE,
  text text NOT NULL DEFAULT '',
  media_id uuid REFERENCES public.rc_media_objects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_rc_messages_thread ON public.rc_messages(thread_key, created_at);
CREATE INDEX IF NOT EXISTS idx_rc_messages_recipient_seen ON public.rc_messages(recipient_id, seen_at);

-- Helper function: checks whether either party blocked the other
CREATE OR REPLACE FUNCTION public.rc_is_blocked(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rc_blocked_users
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
$$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.rc_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rc_nfc_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rc_blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rc_media_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rc_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Profiles (hide users who blocked the caller; never expose to anon)
CREATE POLICY "rc_profiles_select_authed" ON public.rc_profiles
  FOR SELECT TO authenticated
  USING (NOT public.rc_is_blocked(auth.uid(), id));

CREATE POLICY "rc_profiles_update_own" ON public.rc_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS: NFC Links (strictly owner-only read/write; resolution goes through server/RPC)
CREATE POLICY "rc_nfc_owner_all" ON public.rc_nfc_links
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS: Blocked Users (strictly blocker-only visibility and mutation)
CREATE POLICY "rc_blocks_owner_all" ON public.rc_blocked_users
  FOR ALL TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- RLS: Private Media Objects (only owner or recipient, and not blocked)
CREATE POLICY "rc_media_select_participants" ON public.rc_media_objects
  FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id
    OR (auth.uid() = recipient_id AND NOT public.rc_is_blocked(owner_id, recipient_id))
  );

CREATE POLICY "rc_media_insert_owner" ON public.rc_media_objects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- RLS: Messages (only participants; INSERT strictly rejects blocked pairs!)
CREATE POLICY "rc_messages_select_participants" ON public.rc_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "rc_messages_insert_unblocked" ON public.rc_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT public.rc_is_blocked(sender_id, recipient_id)
  );

CREATE POLICY "rc_messages_update_seen_recipient" ON public.rc_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- 6. Private Per-User Reading Progress, Bookmarks, Favorites & History
CREATE TABLE IF NOT EXISTS public.rc_reading_state (
  user_id uuid PRIMARY KEY REFERENCES public.rc_profiles(id) ON DELETE CASCADE,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rc_reading_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc_reading_state_owner_all" ON public.rc_reading_state
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
