-- Minimal sales orders schema for demand-driven container planning

create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  status text not null default 'open', -- 'open' | 'shipped' | 'cancelled'
  order_date date not null,
  requested_ship_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  sku text not null,
  sku_var text,
  description text,
  quantity_units numeric not null,
  created_at timestamptz not null default now()
);
