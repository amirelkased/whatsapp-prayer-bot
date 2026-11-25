-- Run this in Supabase Dashboard > SQL Editor, once.
-- State only: which image was sent last, and on which date (Cairo date, YYYY-MM-DD).
-- One row only, id = 1.
-- No captions table — captions come only from CAPTION_TEMPLATE in .env.
-- If you already created a captions table, this removes it:
drop table if exists public.captions;

create table if not exists public.bot_state (
  id int primary key,
  last_index int not null default 0,
  last_sent_date text,
  last_sent_image int,
  updated_at timestamptz not null default now()
);
insert into public.bot_state (id, last_index)
values (1, 0)
on conflict (id) do nothing;

-- The bot uses the service_role key (server only, never in the browser),
-- so no RLS policies are needed for its own reads/writes.
-- If you enable RLS, add a policy allowing service_role full access,
-- or keep RLS off for this table.
