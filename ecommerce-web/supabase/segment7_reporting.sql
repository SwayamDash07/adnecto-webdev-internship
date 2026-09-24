-- Segment 7 reporting and dashboard metrics.
-- Run after the previous segment migrations.

create or replace view public.report_order_financials as
select o.id as order_id, o.created_at::date as order_day, o.status, o.total,
       coalesce(sum(oi.unit_price * oi.quantity), 0)::numeric as item_revenue,
       coalesce(sum(oi.unit_price * oi.quantity * p.gst / (100 + p.gst)), 0)::numeric as gst_amount,
       coalesce(sum(oi.quantity * (select avg(pi.unit_cost) from public.purchase_items pi where pi.product_id = oi.product_id)), 0)::numeric as estimated_cost
from public.orders o left join public.order_items oi on oi.order_id = o.id left join public.products p on p.id = oi.product_id
group by o.id, o.created_at, o.status, o.total;
alter view public.report_order_financials set (security_invoker = true);

create or replace function public.admin_dashboard_metrics()
returns table(today_sales numeric, weekly_sales numeric, monthly_sales numeric, pending_deliveries integer, low_stock integer, total_customers bigint, refunded_amount numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('accountant') or public.has_role('store_manager')) then raise exception 'REPORT_ROLE_REQUIRED'; end if;
  return query select coalesce(sum(o.total) filter (where o.created_at >= current_date and o.status not in ('cancelled','refunded')),0)::numeric, coalesce(sum(o.total) filter (where o.created_at >= current_date - 6 and o.status not in ('cancelled','refunded')),0)::numeric, coalesce(sum(o.total) filter (where o.created_at >= date_trunc('month', now()) and o.status not in ('cancelled','refunded')),0)::numeric, count(*) filter (where o.status in ('placed','accepted','picking','packed','out_for_delivery'))::integer, (select count(*)::integer from public.inventory where current_stock - reserved_stock <= reorder_level), (select count(*) from public.users u left join public.roles r on r.id = u.role_id where coalesce(r.name::text,'customer') = 'customer'), coalesce((select sum(amount) from public.refunds),0)::numeric from public.orders o;
end;
$$;

create or replace function public.admin_finance_report(p_from date default current_date - 30, p_to date default current_date)
returns table(day date, order_count bigint, gross_sales numeric, refunds numeric, net_sales numeric, gst numeric, estimated_cost numeric, estimated_profit numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('accountant') or public.has_role('store_manager')) then raise exception 'REPORT_ROLE_REQUIRED'; end if;
  return query select d.day::date, count(distinct f.order_id), coalesce(sum(f.total) filter (where f.status not in ('cancelled','refunded')),0), coalesce(sum(r.amount),0), coalesce(sum(f.total) filter (where f.status not in ('cancelled','refunded')),0) - coalesce(sum(r.amount),0), coalesce(sum(f.gst_amount),0), coalesce(sum(f.estimated_cost),0), coalesce(sum(f.total - f.gst_amount - f.estimated_cost) filter (where f.status not in ('cancelled','refunded')),0) from generate_series(p_from, p_to, interval '1 day') d(day) left join public.report_order_financials f on f.order_day = d.day::date left join public.refunds r on r.order_id = f.order_id group by d.day order by d.day;
end;
$$;

create or replace function public.admin_payment_report(p_from date default current_date - 30, p_to date default current_date)
returns table(method text, status text, payment_count bigint, amount numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('accountant') or public.has_role('store_manager')) then raise exception 'REPORT_ROLE_REQUIRED'; end if;
  return query select p.method::text, p.status::text, count(*)::bigint, coalesce(sum(p.amount),0)::numeric from public.payments p where p.created_at::date between p_from and p_to group by p.method, p.status order by p.method, p.status;
end;
$$;

create or replace function public.admin_tax_report(p_from date default current_date - 30, p_to date default current_date)
returns table(hsn text, gst_rate numeric, taxable_value numeric, gst_amount numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('accountant') or public.has_role('store_manager')) then raise exception 'REPORT_ROLE_REQUIRED'; end if;
  return query select coalesce(p.hsn,'UNSPECIFIED'), p.gst, coalesce(sum(oi.unit_price * oi.quantity / (1 + p.gst / 100)),0), coalesce(sum(oi.unit_price * oi.quantity * p.gst / (100 + p.gst)),0) from public.order_items oi join public.orders o on o.id = oi.order_id join public.products p on p.id = oi.product_id where o.created_at::date between p_from and p_to and o.status not in ('cancelled','refunded') group by p.hsn,p.gst order by p.hsn;
end;
$$;

create or replace function public.admin_category_report(p_from date default current_date - 30, p_to date default current_date)
returns table(category text, units_sold bigint, revenue numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('accountant') or public.has_role('store_manager')) then raise exception 'REPORT_ROLE_REQUIRED'; end if;
  return query select coalesce(c.name,'Uncategorized'), coalesce(sum(oi.quantity),0)::bigint, coalesce(sum(oi.quantity * oi.unit_price),0)::numeric from public.order_items oi join public.orders o on o.id = oi.order_id join public.products p on p.id = oi.product_id left join public.categories c on c.id = p.category_id where o.created_at::date between p_from and p_to and o.status not in ('cancelled','refunded') group by c.name order by revenue desc;
end;
$$;

create or replace function public.admin_delivery_report(p_from date default current_date - 30, p_to date default current_date)
returns table(status text, order_count bigint, total_value numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('accountant') or public.has_role('store_manager') or public.has_role('delivery_boy')) then raise exception 'REPORT_ROLE_REQUIRED'; end if;
  return query select o.status::text, count(*)::bigint, coalesce(sum(o.total),0)::numeric from public.orders o where o.created_at::date between p_from and p_to group by o.status order by o.status;
end;
$$;

grant execute on function public.admin_dashboard_metrics() to authenticated;
grant execute on function public.admin_finance_report(date,date) to authenticated;
grant execute on function public.admin_payment_report(date,date) to authenticated;
grant execute on function public.admin_tax_report(date,date) to authenticated;
grant execute on function public.admin_category_report(date,date) to authenticated;
grant execute on function public.admin_delivery_report(date,date) to authenticated;
