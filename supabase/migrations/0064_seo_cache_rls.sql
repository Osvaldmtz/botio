-- Internal SEO KPI cache (SEMrush / DataForSEO / PageSpeed).
-- Only the server service_role client reads/writes this table
-- (lib/semrush-api.ts, lib/dataforseo-api.ts via createAdminClient).
-- No policies for anon/authenticated: deny by default under RLS.

ALTER TABLE public.seo_cache ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.seo_cache FROM anon;
REVOKE ALL ON TABLE public.seo_cache FROM authenticated;

-- service_role already has grants and bypasses RLS; keep explicit for clarity.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.seo_cache TO service_role;
