-- Integration test for RLS + inventory RPCs. Run: ./supabase/tests/run.sh
\set ON_ERROR_STOP 1
grant usage on schema public, auth to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public, auth to authenticated;

insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','a@x.io','{"display_name":"Alex"}'),
 ('00000000-0000-0000-0000-00000000000b','b@x.io','{"display_name":"Sam"}'),
 ('00000000-0000-0000-0000-00000000000c','c@x.io','{}');

set role authenticated;
-- A creates a household and an invite; B joins.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select create_household('Home') as hid \gset
select create_invite(:'hid') as code \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select join_household(:'code');
do $$ begin perform join_household('NOPE1234'); raise exception 'should fail'; exception when others then
  if sqlerrm <> 'invalid_or_expired_invite' then raise; end if; end $$;

-- B adds chicken (500 g); A uses 200 g.
insert into inventory_items(household_id,name,category,quantity,unit,location,expiry_date,expiry_type)
values (:'hid','Chicken','meat',500,'g','fridge',current_date+1,'use_by') returning id as chicken, version as v \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select quantity from adjust_inventory(:'chicken', -200, 'consumed', :v);
select (select quantity from inventory_items where id = :'chicken') = 300 as chicken_is_300 \gset
\if :chicken_is_300 \else \echo 'FAIL chicken' \quit \endif

-- Stale version is rejected (concurrent edit protection).
do $$ begin perform adjust_inventory((select id from inventory_items where name='Chicken'), -10, 'consumed', 1);
  raise exception 'should conflict'; exception when others then if sqlerrm <> 'version_conflict' then raise; end if; end $$;
-- Over-consumption is rejected.
do $$ begin perform adjust_inventory((select id from inventory_items where name='Chicken'), -301, 'consumed');
  raise exception 'should be insufficient'; exception when others then if sqlerrm <> 'insufficient_quantity' then raise; end if; end $$;

-- Cooking deducts confirmed amounts atomically and logs who did it.
insert into recipes(household_id,title,ingredients) values (:'hid','Chicken stir-fry','[{"name":"chicken","quantity":300,"unit":"g"}]') returning id as rid \gset
select cook_recipe(:'rid', jsonb_build_array(jsonb_build_object('item_id', :'chicken', 'amount', 300))) as cid \gset
select status = 'consumed' and quantity = 0 as done from inventory_items where id = :'chicken' \gset
\if :done \else \echo 'FAIL cook' \quit \endif
select count(*) = 3 as ev_ok from inventory_events where item_id = :'chicken' \gset
\if :ev_ok \else \echo 'FAIL events' \quit \endif

-- Separate ratings per person.
insert into ratings(household_id,cooking_id,recipe_id,user_id,rating) values (:'hid',:'cid',:'rid',auth.uid(),5);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into ratings(household_id,cooking_id,recipe_id,user_id,rating) values (:'hid',:'cid',:'rid',auth.uid(),2);
do $$ begin
  insert into ratings(household_id,cooking_id,recipe_id,user_id,rating)
  select household_id, cooking_id, recipe_id, '00000000-0000-0000-0000-00000000000a', 1 from ratings limit 1;
  raise exception 'should not rate for partner'; exception when insufficient_privilege then null; end $$;

-- Shopping list merges duplicates; purchase is idempotent and stocks inventory.
select id as s1 from add_shopping_item(:'hid','Milk','milk',1,'l') \gset
select id as s2 from add_shopping_item(:'hid','milk','milk',0.5,'l') \gset
select :'s1' = :'s2' as merged \gset
\if :merged \else \echo 'FAIL merge' \quit \endif
select purchase_shopping_item(:'s1', true, 'fridge') is not null as bought \gset
select purchase_shopping_item(:'s1', true, 'fridge') is null as idempotent \gset
\if :idempotent \else \echo 'FAIL idempotent' \quit \endif
select quantity = 1.5 as milk_ok from inventory_items where lower(name) = 'milk' \gset
\if :milk_ok \else \echo 'FAIL milk qty' \quit \endif

-- Outsider C sees nothing and can't modify.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select count(*) = 0 as hidden from inventory_items \gset
\if :hidden \else \echo 'FAIL RLS' \quit \endif
do $$ begin perform adjust_inventory((select id from inventory_items limit 1), -1, 'consumed');
  exception when others then if sqlerrm <> 'not_found' then raise; end if; end $$;
do $$ begin perform add_shopping_item((select '00000000-0000-0000-0000-000000000000'::uuid), 'x','x');
  raise exception 'should be forbidden'; exception when others then if sqlerrm <> 'forbidden' then raise; end if; end $$;

-- Stores: purchase records the store on the new inventory item.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select id as s3 from add_shopping_item(:'hid','Butter','butter',1,'pcs','dairy',null,null,'Lidl') \gset
select id as s4 from add_shopping_item(:'hid','butter','butter',1,'pcs','dairy',null,null,'Aldi') \gset
select store = 'Lidl' and quantity = 2 as store_kept from shopping_items where id = :'s3' \gset
\if :store_kept \else \echo 'FAIL store merge' \quit \endif
select purchase_shopping_item(:'s3', true, 'fridge', null, 'best_before', null, 'Delhaize') as inv \gset
select store = 'Delhaize' as store_ok from inventory_items where id = :'inv' \gset
\if :store_ok \else \echo 'FAIL store purchase' \quit \endif

-- Store catalogue: tagging adds products; set_store_order reorders.
select add_shopping_item(:'hid','Bread','bread',1,'pcs','bread',null,null,'Lidl') is not null as x \gset
select string_agg(normalized_name, ',' order by position) = 'butter,bread' as cat_ok from store_products where store = 'Lidl' \gset
\if :cat_ok \else \echo 'FAIL catalogue' \quit \endif
select set_store_order(:'hid', 'Lidl', array['bread','butter']);
select string_agg(normalized_name, ',' order by position) = 'bread,butter' as order_ok from store_products where store = 'Lidl' \gset
\if :order_ok \else \echo 'FAIL order' \quit \endif

\echo 'ALL DATABASE TESTS PASSED'
