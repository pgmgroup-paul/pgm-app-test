-- Create dropship_transfers table for warehouse → dropship logging
create table if not exists public.dropship_transfers (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null references public.products(id),
  sku text not null,
  sku_var text,

  quantity numeric not null,
  unit text not null check (unit in ('pieces', 'cases')),

  source_type text not null check (source_type in ('container', 'order_leftover', 'inventory')),
  source_container_id uuid references public.shipment_containers(id),
  source_shipment_id uuid references public.so_shipments(id),

  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists dropship_transfers_product_id_idx
  on public.dropship_transfers(product_id);

create index if not exists dropship_transfers_source_container_idx
  on public.dropship_transfers(source_container_id);

create index if not exists dropship_transfers_source_shipment_idx
  on public.dropship_transfers(source_shipment_id);
