-- Align the live payment method constraint with the current checkout RPC.
-- Run after the existing checkout/payment migrations, including phase24.
begin;

alter table public.payments
  drop constraint if exists payments_method_check;

-- Preserve historical payment types while normalizing older labels. New
-- checkout rows use `prepaid` or `cod` (phase24_delivery_slot_timestamps.sql).
update public.payments
set method = case
  when lower(trim(method)) in ('prepaid', 'razorpay') then 'prepaid'
  when lower(trim(method)) = 'upi' then 'upi'
  when lower(trim(method)) in ('card', 'credit_card', 'debit_card', 'credit/debit card') then 'card'
  when lower(trim(method)) in ('netbanking', 'net banking') then 'netbanking'
  when lower(trim(method)) = 'wallet' then 'wallet'
  when lower(trim(method)) in ('cod', 'cash on delivery') then 'cod'
  else 'Razorpay'
end
where method is distinct from case
  when lower(trim(method)) in ('prepaid', 'razorpay') then 'prepaid'
  when lower(trim(method)) = 'upi' then 'upi'
  when lower(trim(method)) in ('card', 'credit_card', 'debit_card', 'credit/debit card') then 'card'
  when lower(trim(method)) in ('netbanking', 'net banking') then 'netbanking'
  when lower(trim(method)) = 'wallet' then 'wallet'
  when lower(trim(method)) in ('cod', 'cash on delivery') then 'cod'
  else 'Razorpay'
end;

alter table public.payments
  add constraint payments_method_check
  check (method in ('prepaid', 'upi', 'card', 'netbanking', 'wallet', 'cod', 'Razorpay'));

commit;
