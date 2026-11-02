-- Per-store product catalogue with a walking order ("aisle order").
-- Every product ever tagged with a store lands here automatically; the household
-- arranges it once, and the shopping list for that store follows the order.
create table public.store_products (
  household_id uuid not null references public.households(id) on delete cascade,
  store text not null,
  normalized_name text not null,
  name text not null,
  category text not null default 'other',
  position int not null,
  created_at timestamptz not null default now(),
  primary key (household_id, store, normalized_name)
);
alter table public.store_products enable row level security;
create policy "store products all" on public.store_products for all
  using (is_member(household_id)) with check (is_member(household_id));
alter publication supabase_realtime add table public.store_products;

-- Name normalisation in SQL mirrors the simple part of the app's (lowercase, trimmed).
create or replace function public.remember_store_product(p_household uuid, p_store text, p_norm text, p_name text, p_category text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_household) then raise exception 'forbidden'; end if;
  if p_store is null or coalesce(p_norm,'') = '' then return; end if;
  insert into store_products(household_id, store, normalized_name, name, category, position)
  values (p_household, p_store, p_norm, p_name, coalesce(p_category,'other'),
          coalesce((select max(position) + 1 from store_products where household_id = p_household and store = p_store), 0))
  on conflict do nothing;
end $$;

create or replace function public.shopping_remember_store() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform remember_store_product(new.household_id, new.store, new.normalized_name, new.name, new.category);
  return new;
end $$;
create trigger shopping_items_store after insert or update of store on public.shopping_items
  for each row when (new.store is not null) execute function public.shopping_remember_store();

create or replace function public.inventory_remember_store() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform remember_store_product(new.household_id, new.store, lower(trim(new.name)), new.name, new.category);
  return new;
end $$;
create trigger inventory_items_store after insert or update of store on public.inventory_items
  for each row when (new.store is not null) execute function public.inventory_remember_store();

-- Save a new order in one transaction (names not listed keep their relative order, after the listed ones).
create or replace function public.set_store_order(p_household uuid, p_store text, p_names text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_household) then raise exception 'forbidden'; end if;
  update store_products sp set position = o.ord - 1
    from unnest(p_names) with ordinality as o(n, ord)
   where sp.household_id = p_household and sp.store = p_store and sp.normalized_name = o.n;
  update store_products sp set position = array_length(p_names, 1) + sub.rn
    from (select normalized_name, row_number() over (order by position) as rn from store_products
           where household_id = p_household and store = p_store and not (normalized_name = any(p_names))) sub
   where sp.household_id = p_household and sp.store = p_store and sp.normalized_name = sub.normalized_name;
end $$;
