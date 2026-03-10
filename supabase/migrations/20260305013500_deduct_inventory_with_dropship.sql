-- Wrapper function to run inventory deduction and, when appropriate,
-- also log a dropship transfer in the same transaction.

create or replace function public.deduct_inventory_with_dropship(
  p_warehouse_name text,
  p_location_code text,
  p_product_id uuid,
  p_quantity numeric,
  p_unit text,
  p_reason text,
  p_note text,
  p_order_number text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_movement_id uuid;
  v_sku text;
  v_sku_var text;
begin
  -- Call existing deduct_inventory function (original logic)
  select public.deduct_inventory(
    p_warehouse_name,
    p_location_code,
    p_product_id,
    p_quantity,
    p_unit,
    p_reason,
    p_note,
    p_order_number
  )
  into v_movement_id;

  -- When reason is transfer to dropship, also log into dropship_transfers
  if p_reason = 'transfer_dropship' then
    select sku, sku_var
    into v_sku, v_sku_var
    from public.products
    where id = p_product_id;

    insert into public.dropship_transfers (
      product_id,
      sku,
      sku_var,
      quantity,
      unit,
      source_type,
      source_container_id,
      source_shipment_id,
      created_by
    ) values (
      p_product_id,
      v_sku,
      v_sku_var,
      p_quantity,
      p_unit,
      'inventory',
      null,
      null,
      auth.uid()
    );
  end if;

  return v_movement_id;
end;
$$;
