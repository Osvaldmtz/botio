-- Rollback for supabase/migrations/0064_seo_cache_rls.sql
-- Restores pre-change grants (default Supabase table privileges) and disables RLS.
-- Does NOT delete seo_cache rows.

REVOKE ALL ON TABLE public.seo_cache FROM service_role;
GRANT ALL ON TABLE public.seo_cache TO service_role;

GRANT ALL ON TABLE public.seo_cache TO anon;
GRANT ALL ON TABLE public.seo_cache TO authenticated;

ALTER TABLE public.seo_cache DISABLE ROW LEVEL SECURITY;
