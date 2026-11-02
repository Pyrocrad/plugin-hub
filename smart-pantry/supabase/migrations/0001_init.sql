-- Smart Pantry – initial schema
-- One household = one shared source of truth. Every row carries household_id and is
-- protected by Row Level Security. Quantity changes go through SECURITY DEFINER
-- functions that lock the row, check an optimistic version and write an audit event
-- in the same transaction.

create extension if not exists pgcrypto;

-- ───────────────────────── Profiles & households ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Me',
  avatar_color text not null default '#16a34a',
  diet text[] not null default '{}',        -- e.g. {vegetarian}
  allergies text[] not null default '{}',   -- hard constraints, never violated
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  currency text not null default 'EUR',
  expiry_alert_days int not null default 3,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members(user_id);

create table public.household_invites (
  code text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users(id),
  used_at timestamptz
);

-- Membership check used by every policy. SECURITY DEFINER avoids policy recursion.
create or replace function public.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid());
$$;

-- ───────────────────────── Inventory ─────────────────────────
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text not null default 'other',
  quantity numeric(12,3) not null check (quantity >= 0),
  unit text not null default 'pcs',
  location text not null default 'fridge' check (location in ('fridge','freezer','pantry','other')),
  purchase_date date,
  expiry_date date,
  expiry_type text not null default 'best_before' check (expiry_type in ('use_by','best_before','none')),
  opened_at date,
  days_after_opening int,                  -- shelf life once opened (e.g. milk: 4)
  low_stock_threshold numeric(12,3),
  barcode text,
  notes text,
  status text not null default 'active' check (status in ('active','consumed','spoiled','discarded')),
  version int not null default 1,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.inventory_items(household_id, status);
create index on public.inventory_items(household_id, expiry_date) where status = 'active';

create table public.inventory_events (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  user_id uuid references auth.users(id),
  reason text not null check (reason in ('purchased','consumed','cooked','spoiled','discarded','corrected','moved','opened','restocked')),
  quantity_before numeric(12,3),
  quantity_after numeric(12,3),
  delta numeric(12,3),
  unit text,
  location_from text,
  location_to text,
  cooking_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index on public.inventory_events(household_id, created_at desc);
create index on public.inventory_events(item_id);

-- Stamp who/when on every update and bump the optimistic-lock version.
create or replace function public.touch_item() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.version := old.version + 1;
  return new;
end $$;
create trigger inventory_items_touch before update on public.inventory_items
  for each row execute function public.touch_item();

-- Log creation as a purchase.
create or replace function public.log_item_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into inventory_events(household_id,item_id,user_id,reason,quantity_before,quantity_after,delta,unit,location_to)
  values (new.household_id,new.id,auth.uid(),'purchased',0,new.quantity,new.quantity,new.unit,new.location);
  return new;
end $$;
create trigger inventory_items_log_insert after insert on public.inventory_items
  for each row execute function public.log_item_insert();

create or replace function public.stamp_creator() returns trigger language plpgsql as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.updated_by := new.created_by;
  return new;
end $$;
create trigger inventory_items_creator before insert on public.inventory_items
  for each row execute function public.stamp_creator();

-- ───────────────────────── Recipes, cooking, ratings ─────────────────────────
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  description text,
  cuisine text,
  tags text[] not null default '{}',
  main_ingredients text[] not null default '{}', -- normalised names, used for learning
  methods text[] not null default '{}',          -- e.g. {roast, stir-fry}
  ingredients jsonb not null default '[]',       -- [{name, quantity, unit, optional}]
  steps jsonb not null default '[]',             -- [text]
  prep_minutes int,
  cook_minutes int,
  difficulty text check (difficulty in ('easy','medium','hard')),
  servings int,
  image_url text,
  kind text,                                     -- favourite | practical | discovery | manual
  source text not null default 'ai' check (source in ('ai','manual')),
  saved boolean not null default false,
  estimated_missing_cost numeric(10,2),
  nutrition jsonb,                               -- {kcal, protein_g} per serving (estimate)
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.recipes(household_id, created_at desc);

create table public.cookings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  cooked_by uuid not null references auth.users(id),
  cooked_at timestamptz not null default now(),
  followed_exactly boolean not null default true,
  modifications text,
  servings int
);
create index on public.cookings(household_id, cooked_at desc);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  cooking_id uuid not null references public.cookings(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (cooking_id, user_id)       -- individual ratings stay separate per person
);

-- Explicit user corrections of learned preferences. These always win over inference.
create table public.preference_overrides (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ingredient','cuisine','method')),
  value text not null,
  stance text not null check (stance in ('love','like','neutral','dislike','never')),
  created_at timestamptz not null default now(),
  unique (user_id, kind, value)
);

-- ───────────────────────── Shopping list ─────────────────────────
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  category text not null default 'other',
  quantity numeric(12,3),
  unit text,
  notes text,
  recipe_id uuid references public.recipes(id) on delete set null,
  status text not null default 'open' check (status in ('open','purchased')),
  added_by uuid references auth.users(id),
  purchased_by uuid references auth.users(id),
  purchased_at timestamptz,
  created_at timestamptz not null default now()
);
-- No duplicate open entries for the same product + unit.
create unique index shopping_items_open_unique
  on public.shopping_items(household_id, normalized_name, coalesce(unit,''))
  where status = 'open';

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_events enable row level security;
alter table public.recipes enable row level security;
alter table public.cookings enable row level security;
alter table public.ratings enable row level security;
alter table public.preference_overrides enable row level security;
alter table public.shopping_items enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "housemates profiles" on public.profiles for select using (
  exists (select 1 from household_members a join household_members b on a.household_id = b.household_id
          where a.user_id = auth.uid() and b.user_id = profiles.id));

create policy "member reads household" on public.households for select using (is_member(id));
create policy "member updates household" on public.households for update using (is_member(id));
create policy "member reads members" on public.household_members for select using (is_member(household_id));
create policy "member reads invites" on public.household_invites for select using (is_member(household_id));

-- Inventory: read/insert/update by members. Deletion is not allowed – history is kept.
create policy "inv select" on public.inventory_items for select using (is_member(household_id));
create policy "inv insert" on public.inventory_items for insert with check (is_member(household_id));
create policy "inv update" on public.inventory_items for update using (is_member(household_id)) with check (is_member(household_id));
create policy "events select" on public.inventory_events for select using (is_member(household_id));

create policy "recipes all" on public.recipes for all using (is_member(household_id)) with check (is_member(household_id));
create policy "cookings select" on public.cookings for select using (is_member(household_id));
create policy "cookings update own" on public.cookings for update using (is_member(household_id) and cooked_by = auth.uid());
create policy "ratings select" on public.ratings for select using (is_member(household_id));
create policy "ratings own write" on public.ratings for all
  using (is_member(household_id) and user_id = auth.uid())
  with check (is_member(household_id) and user_id = auth.uid());
create policy "prefs select" on public.preference_overrides for select using (is_member(household_id));
create policy "prefs own write" on public.preference_overrides for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_member(household_id));
create policy "shopping all" on public.shopping_items for all using (is_member(household_id)) with check (is_member(household_id));

-- ───────────────────────── Functions (RPC) ─────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into households(name, created_by) values (p_name, auth.uid()) returning id into hid;
  insert into household_members(household_id, user_id, role) values (hid, auth.uid(), 'owner');
  return hid;
end $$;

create or replace function public.create_invite(p_household uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_member(p_household) then raise exception 'forbidden'; end if;
  c := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
  insert into household_invites(code, household_id, created_by) values (c, p_household, auth.uid());
  return c;
end $$;

create or replace function public.join_household(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv household_invites;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into inv from household_invites where code = upper(trim(p_code)) for update;
  if not found or inv.used_at is not null or inv.expires_at < now() then
    raise exception 'invalid_or_expired_invite';
  end if;
  insert into household_members(household_id, user_id) values (inv.household_id, auth.uid())
    on conflict do nothing;
  update household_invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.household_id;
end $$;

-- Change a quantity by delta (negative = consumption). Atomic, audited, conflict-safe.
-- p_expected_version: if given and stale, raises 'version_conflict' so the client can
-- refresh instead of silently overwriting a housemate's change.
create or replace function public.adjust_inventory(
  p_item uuid, p_delta numeric, p_reason text,
  p_expected_version int default null, p_note text default null, p_cooking uuid default null
) returns public.inventory_items
language plpgsql security definer set search_path = public as $$
declare it inventory_items; new_qty numeric; new_status text;
begin
  select * into it from inventory_items where id = p_item for update;
  if not found or not is_member(it.household_id) then raise exception 'not_found'; end if;
  if p_expected_version is not null and it.version <> p_expected_version then
    raise exception 'version_conflict';
  end if;
  if p_reason not in ('consumed','cooked','purchased','restocked','corrected') then
    raise exception 'invalid_reason';
  end if;
  new_qty := it.quantity + p_delta;
  if new_qty < -0.0005 then raise exception 'insufficient_quantity'; end if;
  new_qty := greatest(new_qty, 0);
  new_status := case when new_qty = 0 then 'consumed' else 'active' end;
  update inventory_items set quantity = new_qty, status = new_status where id = p_item returning * into it;
  insert into inventory_events(household_id,item_id,user_id,reason,quantity_before,quantity_after,delta,unit,cooking_id,note)
  values (it.household_id,it.id,auth.uid(),p_reason,new_qty - p_delta,new_qty,p_delta,it.unit,p_cooking,p_note);
  return it;
end $$;

-- Set an absolute quantity (manual correction).
create or replace function public.set_inventory_quantity(p_item uuid, p_quantity numeric, p_expected_version int default null)
returns public.inventory_items language plpgsql security definer set search_path = public as $$
declare it inventory_items;
begin
  if p_quantity < 0 then raise exception 'negative_quantity'; end if;
  select * into it from inventory_items where id = p_item for update;
  if not found or not is_member(it.household_id) then raise exception 'not_found'; end if;
  return adjust_inventory(p_item, p_quantity - it.quantity, 'corrected', p_expected_version);
end $$;

-- Mark spoiled / discarded: quantity goes to zero, row kept for waste statistics.
create or replace function public.discard_inventory(p_item uuid, p_reason text, p_note text default null)
returns public.inventory_items language plpgsql security definer set search_path = public as $$
declare it inventory_items; before numeric;
begin
  if p_reason not in ('spoiled','discarded') then raise exception 'invalid_reason'; end if;
  select * into it from inventory_items where id = p_item for update;
  if not found or not is_member(it.household_id) then raise exception 'not_found'; end if;
  before := it.quantity;
  update inventory_items set quantity = 0, status = p_reason where id = p_item returning * into it;
  insert into inventory_events(household_id,item_id,user_id,reason,quantity_before,quantity_after,delta,unit,note)
  values (it.household_id,it.id,auth.uid(),p_reason,before,0,-before,it.unit,p_note);
  return it;
end $$;

-- Move between storage locations; optionally adjust expiry (e.g. freezing extends it).
create or replace function public.move_inventory(p_item uuid, p_location text, p_new_expiry date default null, p_keep_expiry boolean default true)
returns public.inventory_items language plpgsql security definer set search_path = public as $$
declare it inventory_items; old_loc text;
begin
  select * into it from inventory_items where id = p_item for update;
  if not found or not is_member(it.household_id) then raise exception 'not_found'; end if;
  old_loc := it.location;
  update inventory_items
     set location = p_location,
         expiry_date = case when p_keep_expiry then expiry_date else p_new_expiry end
   where id = p_item returning * into it;
  insert into inventory_events(household_id,item_id,user_id,reason,quantity_before,quantity_after,delta,unit,location_from,location_to)
  values (it.household_id,it.id,auth.uid(),'moved',it.quantity,it.quantity,0,it.unit,old_loc,p_location);
  return it;
end $$;

-- "I cooked this": record cooking + deduct the CONFIRMED quantities atomically.
-- p_deductions: [{"item_id": uuid, "amount": numeric}] amounts already in the item's unit.
create or replace function public.cook_recipe(
  p_recipe uuid, p_deductions jsonb, p_followed_exactly boolean default true,
  p_modifications text default null, p_servings int default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare r recipes; cid uuid; d jsonb;
begin
  select * into r from recipes where id = p_recipe;
  if not found or not is_member(r.household_id) then raise exception 'not_found'; end if;
  insert into cookings(household_id, recipe_id, cooked_by, followed_exactly, modifications, servings)
  values (r.household_id, r.id, auth.uid(), p_followed_exactly, p_modifications, p_servings) returning id into cid;
  for d in select * from jsonb_array_elements(coalesce(p_deductions,'[]'::jsonb)) loop
    if (d->>'amount')::numeric > 0 then
      perform 1 from inventory_items where id = (d->>'item_id')::uuid and household_id = r.household_id;
      if not found then raise exception 'item_not_in_household'; end if;
      perform adjust_inventory((d->>'item_id')::uuid, -((d->>'amount')::numeric), 'cooked', null, r.title, cid);
    end if;
  end loop;
  update recipes set saved = true where id = r.id;
  return cid;
end $$;

-- Add to shopping list, merging with an existing open entry instead of duplicating.
create or replace function public.add_shopping_item(
  p_household uuid, p_name text, p_normalized text, p_quantity numeric default null,
  p_unit text default null, p_category text default 'other', p_notes text default null, p_recipe uuid default null
) returns public.shopping_items language plpgsql security definer set search_path = public as $$
declare s shopping_items;
begin
  if not is_member(p_household) then raise exception 'forbidden'; end if;
  insert into shopping_items(household_id,name,normalized_name,quantity,unit,category,notes,recipe_id,added_by)
  values (p_household,p_name,p_normalized,p_quantity,p_unit,p_category,p_notes,p_recipe,auth.uid())
  on conflict (household_id, normalized_name, coalesce(unit,'')) where status = 'open'
  do update set quantity = case when shopping_items.quantity is null or excluded.quantity is null
                                then coalesce(shopping_items.quantity, excluded.quantity)
                                else shopping_items.quantity + excluded.quantity end,
                notes = coalesce(excluded.notes, shopping_items.notes)
  returning * into s;
  return s;
end $$;

-- Tick off a shopping item and optionally put it straight into the inventory.
create or replace function public.purchase_shopping_item(
  p_item uuid, p_add_to_inventory boolean default true, p_location text default 'fridge',
  p_expiry date default null, p_expiry_type text default 'best_before', p_quantity numeric default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare s shopping_items; inv_id uuid;
begin
  select * into s from shopping_items where id = p_item for update;
  if not found or not is_member(s.household_id) then raise exception 'not_found'; end if;
  if s.status = 'purchased' then return null; end if;   -- idempotent: partner already ticked it
  update shopping_items set status='purchased', purchased_by=auth.uid(), purchased_at=now() where id = p_item;
  if p_add_to_inventory then
    insert into inventory_items(household_id,name,category,quantity,unit,location,purchase_date,expiry_date,expiry_type)
    values (s.household_id,s.name,s.category,coalesce(p_quantity,s.quantity,1),coalesce(s.unit,'pcs'),p_location,current_date,p_expiry,p_expiry_type)
    returning id into inv_id;
  end if;
  return inv_id;
end $$;

-- Realtime: broadcast row changes (RLS is enforced on realtime too).
alter publication supabase_realtime add table
  public.inventory_items, public.inventory_events, public.shopping_items,
  public.recipes, public.cookings, public.ratings, public.preference_overrides;
alter table public.inventory_items replica identity full;
alter table public.shopping_items replica identity full;
