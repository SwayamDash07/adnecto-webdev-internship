-- Run separately before phase27 so PostgreSQL commits the new enum value first.
alter type public.app_role add value if not exists 'customer_support';
