-- Public bucket for weekly marketing report HTML archives.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'weekly-reports',
  'weekly-reports',
  true,
  5242880,
  ARRAY['text/html']
)
ON CONFLICT (id) DO NOTHING;

-- Service role uploads via admin client; public read for download links.
CREATE POLICY "Public read weekly reports"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'weekly-reports');

CREATE POLICY "Service role manage weekly reports"
  ON storage.objects FOR ALL
  USING (bucket_id = 'weekly-reports')
  WITH CHECK (bucket_id = 'weekly-reports');
