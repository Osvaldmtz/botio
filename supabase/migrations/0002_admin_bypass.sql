-- Temporary: allow admin-created businesses without a real auth user.
-- The RLS policy still requires owner_id = auth.uid() for read/write by
-- authenticated users. Rows created by the admin bypass have owner_id = NULL
-- and are only accessible via the service-role key. Revisit when real auth ships.

alter table public.businesses
  alter column owner_id drop not null;
