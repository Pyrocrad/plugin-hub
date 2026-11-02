-- Stores: the household keeps a short list of the shops it uses; products and
-- shopping items can be tagged with one of them.
alter table public.households add column stores text[] not null default '{}';
alter table public.inventory_items add column store text;
alter table public.shopping_items add column store text;

-- Purchase now records which store it came from (defaults to the shopping item's store).
drop function if exists public.purchase_shopping_item(uuid, boolean, text, date, text, numeric);
create or replace function public.purchase_shopping_item(
  p_item uuid, p_add_to_inventory boolean default true, p_location text default 'fridge',
  p_expiry date default null, p_expiry_type text default 'best_before', p_quantity numeric default null,
  p_store text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare s shopping_items; inv_id uuid;
begin
  select * into s from shopping_items where id = p_item for update;
  if not found or not is_member(s.household_id) then raise exception 'not_found'; end if;
  if s.status = 'purchased' then return null; end if;
  update shopping_items set status='purchased', purchased_by=auth.uid(), purchased_at=now(),
         store = coalesce(p_store, store) where id = p_item;
  if p_add_to_inventory then
    insert into inventory_items(household_id,name,category,quantity,unit,location,purchase_date,expiry_date,expiry_type,store)
    values (s.household_id,s.name,s.category,coalesce(p_quantity,s.quantity,1),coalesce(s.unit,'pcs'),p_location,current_date,p_expiry,p_expiry_type,coalesce(p_store,s.store))
    returning id into inv_id;
  end if;
  return inv_id;
end $$;

-- add_shopping_item gains a store; an existing open entry keeps its store unless it had none.
drop function if exists public.add_shopping_item(uuid, text, text, numeric, text, text, text, uuid);
create or replace function public.add_shopping_item(
  p_household uuid, p_name text, p_normalized text, p_quantity numeric default null,
  p_unit text default null, p_category text default 'other', p_notes text default null, p_recipe uuid default null,
  p_store text default null
) returns public.shopping_items language plpgsql security definer set search_path = public as $$
declare s shopping_items;
begin
  if not is_member(p_household) then raise exception 'forbidden'; end if;
  insert into shopping_items(household_id,name,normalized_name,quantity,unit,category,notes,recipe_id,added_by,store)
  values (p_household,p_name,p_normalized,p_quantity,p_unit,p_category,p_notes,p_recipe,auth.uid(),p_store)
  on conflict (household_id, normalized_name, coalesce(unit,'')) where status = 'open'
  do update set quantity = case when shopping_items.quantity is null or excluded.quantity is null
                                then coalesce(shopping_items.quantity, excluded.quantity)
                                else shopping_items.quantity + excluded.quantity end,
                notes = coalesce(excluded.notes, shopping_items.notes),
                store = coalesce(shopping_items.store, excluded.store)
  returning * into s;
  return s;
end $$;
