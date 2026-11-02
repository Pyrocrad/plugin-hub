-- Expiry dates filled in by the app's shelf-life table (or AI) are estimates, not printed dates.
alter table public.inventory_items add column expiry_estimated boolean not null default false;

drop function if exists public.purchase_shopping_item(uuid, boolean, text, date, text, numeric, text);
create or replace function public.purchase_shopping_item(
  p_item uuid, p_add_to_inventory boolean default true, p_location text default 'fridge',
  p_expiry date default null, p_expiry_type text default 'best_before', p_quantity numeric default null,
  p_store text default null, p_estimated boolean default false, p_days_after_opening int default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare s shopping_items; inv_id uuid;
begin
  select * into s from shopping_items where id = p_item for update;
  if not found or not is_member(s.household_id) then raise exception 'not_found'; end if;
  if s.status = 'purchased' then return null; end if;
  update shopping_items set status='purchased', purchased_by=auth.uid(), purchased_at=now(),
         store = coalesce(p_store, store) where id = p_item;
  if p_add_to_inventory then
    insert into inventory_items(household_id,name,category,quantity,unit,location,purchase_date,expiry_date,expiry_type,store,expiry_estimated,days_after_opening)
    values (s.household_id,s.name,s.category,coalesce(p_quantity,s.quantity,1),coalesce(s.unit,'pcs'),p_location,current_date,p_expiry,p_expiry_type,
            coalesce(p_store,s.store), p_expiry is not null and p_estimated, p_days_after_opening)
    returning id into inv_id;
  end if;
  return inv_id;
end $$;
