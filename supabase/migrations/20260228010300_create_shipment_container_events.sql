-- Create shipment_container_events table
create table if not exists public.shipment_container_events (
  id uuid primary key default gen_random_uuid(),

  -- One row per shipment container
  shipment_container_id uuid not null references public.shipment_containers(id) on delete cascade,

  -- ISF fields
  isf_etd date,
  isf_eta date,
  bol text,

  -- Arrival Notice fields
  telex_release boolean not null default false,
  customs_release boolean not null default false,
  freight_release boolean not null default false,
  cps_hold boolean not null default false,
  terminal text,
  hold_type text,
  arrival_notes text,

  -- Delivery Order
  do_eta date,

  -- Status
  status text not null default 'Not Departed',

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure one row per shipment_container
alter table public.shipment_container_events
  add constraint shipment_container_events_shipment_container_id_key
  unique (shipment_container_id);

-- Make sure columns exist if table was pre-created without them
alter table public.shipment_container_events
  add column if not exists hold_type text;

alter table public.shipment_container_events
  add column if not exists status text not null default 'Not Departed';

-- Check constraint for hold_type
alter table public.shipment_container_events
  add constraint shipment_container_events_hold_type_check
  check (
    hold_type is null
    or hold_type in ('FDA', 'CTF', 'Freight', 'Other')
  );

-- Check constraint for status
alter table public.shipment_container_events
  add constraint shipment_container_events_status_check
  check (
    status in (
      'Not Departed',
      'On Water',
      'Arrived',
      'Arrival Notice',
      'Received',
      'Unloaded'
    )
  );

-- Trigger to keep updated_at in sync
create or replace function public.set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_shipment_container_events_updated_at
before update on public.shipment_container_events
for each row
execute procedure public.set_timestamp();
