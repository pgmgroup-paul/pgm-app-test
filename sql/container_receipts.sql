-- Container receipts audit table

create table if not exists container_receipts (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id) on delete cascade,
  received_by uuid references profiles(id),
  received_at timestamptz not null default now(),
  status text not null default 'received', -- 'received' | 'undone'
  notes text
);
