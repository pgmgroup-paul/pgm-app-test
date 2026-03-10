-- Purchase orders core schema

-- Sequence for PO numbers: PO + 6 digits (e.g., PO101123)
create sequence if not exists purchase_order_seq
  as bigint
  start with 101000
  increment by 1;

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique default (
    'PO' || to_char(nextval('purchase_order_seq'), 'FM000000')
  ),
  supplier text,
  terms text,
  status text not null default 'open', -- 'open' | 'closed' | 'cancelled'
  ship_date date,
  eta date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  sku text,
  sku_var text,
  description text,
  quantity_cases integer not null,
  price numeric,
  sku_volume_m3 numeric,
  created_at timestamptz not null default now()
);
