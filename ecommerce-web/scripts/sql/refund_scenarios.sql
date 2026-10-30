-- Run only after phase21_refunds.sql, phase22_returns.sql, and phase40_returns_refunds.sql.
-- Every fixture and assertion lives in this transaction. The final ROLLBACK removes everything.
begin;

create temporary table refund_scenario_results(name text primary key, passed boolean not null, detail text) on commit drop;
create function pg_temp.refund_check(p_name text,p_ok boolean,p_detail text default '') returns void
language plpgsql as $$
begin
 insert into refund_scenario_results values(p_name,coalesce(p_ok,false),p_detail) on conflict(name) do update set passed=excluded.passed,detail=excluded.detail;
 raise notice '%: % %',case when coalesce(p_ok,false) then 'PASS' else 'FAIL' end,p_name,p_detail;
end $$;

create function pg_temp.refund_fixture(p_user uuid,p_status text,p_method text,p_qty integer,p_unit numeric,p_gst numeric,p_discount numeric,p_returnable boolean,p_delivered_at timestamptz default null)
returns table(order_id bigint,address_id bigint,item_id bigint) language plpgsql as $$
declare product_key bigint; subtotal numeric; paid_total numeric;
begin
 insert into public.products(name,slug,sku,mrp,selling_price,gst,is_returnable)
 values('Refund scenario product '||gen_random_uuid(),'refund-scenario-'||gen_random_uuid(),'RFTEST-'||gen_random_uuid(),p_unit,p_unit,0,p_returnable) returning id into product_key;
 insert into public.inventory(product_id,current_stock,warehouse_stock) values(product_key,100,100) on conflict(product_id) do update set current_stock=100,warehouse_stock=100;
 insert into public.addresses(user_id,label,line1,city,postal_code) values(p_user,'Scenario address','1 Test Road','Test City','560001') returning id into address_id;
 subtotal:=p_qty*p_unit+p_gst-p_discount;
 insert into public.orders(user_id,address_id,status,total,delivered_at,refund_pricing_complete)
 values(p_user,address_id,p_status::public.order_status,subtotal,p_delivered_at,true) returning id into order_id;
 insert into public.order_items(order_id,product_id,quantity,unit_price,gst_amount,discount_amount)
 values(order_id,product_key,p_qty,p_unit,p_gst,p_discount) returning id into item_id;
 insert into public.payments(order_id,method,status,amount)
 values(order_id,p_method,case when lower(p_method)='cod' then 'pending' else 'captured' end,subtotal);
 return next;
end $$;

do $$
declare
 v_customer uuid:=gen_random_uuid(); v_manager uuid:=gen_random_uuid(); v_delivery uuid:=gen_random_uuid(); v_support uuid:=gen_random_uuid();
 v_customer_role bigint; v_manager_role bigint; v_delivery_role bigint; v_support_role bigint;
 v_order bigint; v_address bigint; v_item bigint; v_refund bigint; v_other_refund bigint; v_code text; v_count_before bigint; v_count_after bigint;
 v_amount numeric; v_ref text; v_reason text; v_qty integer; v_can_return boolean; v_refund_only boolean;
 v_day7_order bigint; v_day7_address bigint; v_day7_item bigint; v_day8_order bigint; v_day8_address bigint; v_day8_item bigint;
begin
 insert into public.roles(name) values('customer'::public.app_role),('store_manager'::public.app_role),('delivery_boy'::public.app_role),('customer_support'::public.app_role) on conflict(name) do nothing;
 select id into v_customer_role from public.roles where name::text='customer';
 select id into v_manager_role from public.roles where name::text='store_manager';
 select id into v_delivery_role from public.roles where name::text='delivery_boy';
 select id into v_support_role from public.roles where name::text='customer_support';

 insert into auth.users(id,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(v_customer,'refund-'||v_customer||'@scenario.invalid','',now(),'{}','{}',now(),now()),
       (v_manager,'refund-'||v_manager||'@scenario.invalid','',now(),'{}','{}',now(),now()),
       (v_delivery,'refund-'||v_delivery||'@scenario.invalid','',now(),'{}','{}',now(),now()),
       (v_support,'refund-'||v_support||'@scenario.invalid','',now(),'{}','{}',now(),now());
 insert into public.users(id,full_name,role_id) values(v_customer,'Scenario Customer',v_customer_role),(v_manager,'Scenario Manager',v_manager_role),(v_delivery,'Scenario Delivery',v_delivery_role),(v_support,'Scenario Support',v_support_role)
 on conflict(id) do update set role_id=excluded.role_id;

 -- Prepaid cancellation returns the paid total exactly; COD cancellation produces no refund row.
 select order_id into v_order from pg_temp.refund_fixture(v_customer,'placed','prepaid',1,100,0,0,true,null);
 perform set_config('request.jwt.claim.sub',v_customer::text,true);
 perform public.customer_cancel_order(v_order);
 select amount into v_amount from public.refunds where order_id=v_order and status='refunded';
 perform pg_temp.refund_check('prepaid cancellation full amount',v_amount=100,coalesce(v_amount::text,'no refund'));
 select order_id into v_order from pg_temp.refund_fixture(v_customer,'placed','cod',1,100,0,0,true,null);
 perform public.customer_cancel_order(v_order);
 perform pg_temp.refund_check('COD cancellation has no refund',not exists(select 1 from public.refunds where order_id=v_order),'');

 -- Two units: saved tax 36 and coupon allocation 38 produce a line paid amount 198; one unit is 99.
 select order_id,address_id,item_id into v_order,v_address,v_item from pg_temp.refund_fixture(v_customer,'delivered','prepaid',2,100,36,38,true,now());
 perform set_config('request.jwt.claim.sub',v_customer::text,true);
 select refundable_quantity,return_possible,refund_only_possible,reason_code into v_qty,v_can_return,v_refund_only,v_reason from public.get_return_eligibility(v_order) where order_item_id=v_item;
 perform pg_temp.refund_check('delivered order eligible',v_qty=2 and v_can_return and v_refund_only and v_reason is null,concat_ws(',',v_qty,v_can_return,v_refund_only,v_reason));
 v_refund:=public.create_refund_request(v_order,'Damaged or defective','',jsonb_build_array(jsonb_build_object('order_item_id',v_item,'quantity',1)),'{}','return_and_refund',to_char(current_date+1,'YYYY-MM-DD')||' | 10:00-12:00',v_address);
 select amount,status into v_amount,v_reason from public.refunds where id=v_refund;
 perform pg_temp.refund_check('coupon and GST half-line estimate',v_amount=99 and v_reason='approved',coalesce(v_amount::text,'null')||' / '||coalesce(v_reason,'null'));
 perform set_config('request.jwt.claim.sub',v_manager::text,true);
 perform public.set_refund_status(v_refund,'pickup_scheduled',null,to_char(current_date+1,'YYYY-MM-DD')||' | 10:00-12:00');
 select pickup_code into v_code from public.refunds where id=v_refund;
 perform set_config('request.jwt.claim.sub',v_delivery::text,true);
 perform public.set_refund_status(v_refund,'picked_up',null,null,null,null,null,null,null,v_code);
 perform set_config('request.jwt.claim.sub',v_manager::text,true);
 perform public.set_refund_status(v_refund,'received',null,null,'Good','Checked scenario item',null,null,false);
 perform public.set_refund_status(v_refund,'refunded');
 select coalesce(final_amount,amount) into v_amount from public.refunds where id=v_refund;
 perform pg_temp.refund_check('first unit refund is 99',v_amount=99,coalesce(v_amount::text,'null'));
 perform set_config('request.jwt.claim.sub',v_customer::text,true);
 v_other_refund:=public.create_refund_request(v_order,'Damaged or defective','',jsonb_build_array(jsonb_build_object('order_item_id',v_item,'quantity',1)),'{}','refund_only');
 perform set_config('request.jwt.claim.sub',v_manager::text,true);
 perform public.set_refund_status(v_other_refund,'refunded');
 perform pg_temp.refund_check('second unit may be refunded once',(select sum(ri.quantity)=2 from public.refund_items ri join public.refunds r on r.id=ri.refund_id where r.order_id=v_order),'');
 perform set_config('request.jwt.claim.sub',v_customer::text,true);
 begin
  perform public.create_refund_request(v_order,'Damaged or defective','',jsonb_build_array(jsonb_build_object('order_item_id',v_item,'quantity',1)),'{}','refund_only');
  perform pg_temp.refund_check('third unit is blocked',false,'request unexpectedly succeeded');
 exception when others then perform pg_temp.refund_check('third unit is blocked',sqlerrm like '%ITEM_ALREADY_REQUESTED%' or sqlerrm like '%ITEM_NOT_ELIGIBLE%','blocked by line quantity'); end;
 begin
  insert into public.refunds(order_id,requested_by,status,reason,amount,type) values(v_order,v_customer,'requested','Damaged or defective',1,'refund_only');
  perform pg_temp.refund_check('amount above paid total is blocked',false,'direct insert unexpectedly succeeded');
 exception when others then perform pg_temp.refund_check('amount above paid total is blocked',sqlerrm like '%REFUND_EXCEEDS_AMOUNT_PAID%',''); end;

 -- A non-auto-approved request exercises skip/repeat/reject-after-pickup and support role checks.
 select order_id,address_id,item_id into v_order,v_address,v_item from pg_temp.refund_fixture(v_customer,'delivered','prepaid',1,100,0,0,true,now());
 perform set_config('request.jwt.claim.sub',v_customer::text,true);
 v_refund:=public.create_refund_request(v_order,'Other','Scenario reason',jsonb_build_array(jsonb_build_object('order_item_id',v_item,'quantity',1)),'{}','return_and_refund',to_char(current_date+1,'YYYY-MM-DD')||' | 16:00-18:00',v_address);
 perform set_config('request.jwt.claim.sub',v_manager::text,true);
 begin
  perform public.set_refund_status(v_refund,'picked_up');
  perform pg_temp.refund_check('skipping a step is blocked',false,'skip unexpectedly succeeded');
 exception when others then perform pg_temp.refund_check('skipping a step is blocked',sqlerrm like '%INVALID_REFUND_STEP%',''); end;
 perform public.set_refund_status(v_refund,'approved');
 select count(*) into v_count_before from public.refund_events where refund_id=v_refund;
 perform public.set_refund_status(v_refund,'approved');
 select count(*) into v_count_after from public.refund_events where refund_id=v_refund;
 perform pg_temp.refund_check('repeating a step has no duplicate event',v_count_before=v_count_after,v_count_before||' / '||v_count_after);
 perform public.set_refund_status(v_refund,'pickup_scheduled',null,to_char(current_date+1,'YYYY-MM-DD')||' | 16:00-18:00');
 select pickup_code into v_code from public.refunds where id=v_refund;
 begin
  perform public.set_refund_status(v_refund,'rejected','too late');
  perform pg_temp.refund_check('reject after pickup schedule is blocked',false,'reject unexpectedly succeeded');
 exception when others then perform pg_temp.refund_check('reject after pickup schedule is blocked',sqlerrm like '%INVALID_REFUND_STEP%',''); end;
 perform public.set_refund_status(v_refund,'picked_up',null,null,null,null,null,null,null,v_code);
 perform public.set_refund_status(v_refund,'received',null,null,'Good','Checked scenario item',null,null,false);
 perform set_config('request.jwt.claim.sub',v_support::text,true);
 begin
  perform public.set_refund_status(v_refund,'refunded');
  perform pg_temp.refund_check('customer support cannot mark refunded',false,'refund unexpectedly succeeded');
 exception when others then perform pg_temp.refund_check('customer support cannot mark refunded',sqlerrm like '%FORBIDDEN%',''); end;
 perform set_config('request.jwt.claim.sub',v_manager::text,true);
 perform public.set_refund_status(v_refund,'refunded');
 select refund_reference into v_ref from public.refunds where id=v_refund;
 select count(*) into v_count_before from public.refund_events where refund_id=v_refund;
 perform public.set_refund_status(v_refund,'refunded');
 select count(*) into v_count_after from public.refund_events where refund_id=v_refund;
 perform pg_temp.refund_check('refund reference and repeat refund',v_ref like 'RF-'||extract(year from current_date)::text||'-%' and v_count_before=v_count_after,coalesce(v_ref,'no reference'));

 -- Exact window boundary and non-returnable line check.
 select order_id,item_id into v_day7_order,v_day7_item from pg_temp.refund_fixture(v_customer,'delivered','prepaid',1,100,0,0,true,now()-interval '7 days');
 select order_id,item_id into v_day8_order,v_day8_item from pg_temp.refund_fixture(v_customer,'delivered','prepaid',1,100,0,0,true,now()-interval '8 days');
 perform set_config('request.jwt.claim.sub',v_customer::text,true);
 select reason_code into v_reason from public.get_return_eligibility(v_day7_order) where order_item_id=v_day7_item;
 perform pg_temp.refund_check('day 7 remains eligible',v_reason is null,coalesce(v_reason,'eligible'));
 select reason_code into v_reason from public.get_return_eligibility(v_day8_order) where order_item_id=v_day8_item;
 perform pg_temp.refund_check('day 8 is closed',v_reason='window_closed',coalesce(v_reason,'eligible'));
 select order_id,address_id,item_id into v_order,v_address,v_item from pg_temp.refund_fixture(v_customer,'delivered','prepaid',1,50,0,0,false,now());
 select reason_code,return_possible,refund_only_possible into v_reason,v_can_return,v_refund_only from public.get_return_eligibility(v_order) where order_item_id=v_item;
 perform pg_temp.refund_check('perishable is blocked for return but refund-only is available',v_reason='not_returnable' and not v_can_return and v_refund_only,coalesce(v_reason,'eligible'));
 begin
  perform public.create_refund_request(v_order,'Changed my mind','',jsonb_build_array(jsonb_build_object('order_item_id',v_item,'quantity',1)),'{}','return_and_refund',to_char(current_date+1,'YYYY-MM-DD')||' | 10:00-12:00',v_address);
  perform pg_temp.refund_check('perishable changed-mind return is blocked',false,'request unexpectedly succeeded');
 exception when others then perform pg_temp.refund_check('perishable changed-mind return is blocked',sqlerrm like '%not_returnable%' or sqlerrm like '%ITEM_NOT_ELIGIBLE%',''); end;

 if exists(select 1 from refund_scenario_results where not passed) then raise notice 'Refund scenario summary: % failed of %', (select count(*) from refund_scenario_results where not passed),(select count(*) from refund_scenario_results); else raise notice 'Refund scenario summary: all % checks passed',(select count(*) from refund_scenario_results); end if;
end $$;

table refund_scenario_results;
rollback;
