-- Message thread per client request (bug report / idea).
-- Supports ongoing conversation between Joel (admin) and the reporter (owner).
-- When an owner replies to a 'done' request, trg_reopen_request_on_owner_reply
-- reopens the request to 'triaged'.
--
-- NOT auto-applied — run this in the Supabase SQL Editor manually.
-- is_admin() and my_business_id() exist live only.

create table if not exists public.request_messages (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.client_requests(id) on delete cascade,
  business_id   uuid not null references public.businesses(id),
  author_role   text not null check (author_role in ('owner', 'admin')),
  author_id     uuid references public.users(id) on delete set null,
  body          text not null check (char_length(body) between 1 and 4000),
  created_at    timestamptz not null default now()
);

create index if not exists request_messages_request_id_created_at_idx on public.request_messages (request_id, created_at asc);
create index if not exists request_messages_business_id_idx on public.request_messages (business_id);

alter table public.request_messages enable row level security;

-- Admin sees all messages; an owner sees messages for their business
create policy request_messages_select on public.request_messages
  for select to authenticated
  using (is_admin() or business_id = my_business_id());

-- Insert restricted to current authenticated user.
-- Nested disjunction ensures author_id = auth.uid() is strictly enforced for both roles.
create policy request_messages_insert on public.request_messages
  for insert to authenticated
  with check (
    author_id = auth.uid() and (
      (author_role = 'admin' and is_admin()) or
      (author_role = 'owner' and business_id = my_business_id())
    )
  );

-- Explicit grant for PostgREST Data API access
grant select, insert on public.request_messages to authenticated;

-- Auto-reopen request from 'done' to 'triaged' on owner reply
create or replace function public.reopen_request_on_owner_reply()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.author_role = 'owner' then
    update public.client_requests
    set status = 'triaged', updated_at = now()
    where id = new.request_id and business_id = new.business_id and status = 'done';
  end if;
  return new;
end;
$$;

create trigger trg_reopen_request_on_owner_reply
after insert on public.request_messages
for each row
execute function public.reopen_request_on_owner_reply();

-- DOWN:
-- drop trigger if exists trg_reopen_request_on_owner_reply on public.request_messages;
-- drop function if exists public.reopen_request_on_owner_reply();
-- drop table if exists public.request_messages;
