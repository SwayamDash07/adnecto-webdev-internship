-- Add the regular administrator role. Run this by itself and commit it before
-- applying phase35_regular_admin_access.sql, because PostgreSQL requires a
-- newly added enum value to be committed before it can be used.
alter type public.app_role add value if not exists 'admin';
