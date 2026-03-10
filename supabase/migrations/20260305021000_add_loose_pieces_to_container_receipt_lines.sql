-- 1) Add loose_pieces_received column to immutable snapshot table
alter table public.container_receipt_lines
  add column if not exists loose_pieces_received bigint not null default 0;
