-- Product roadmap (Kalyo features backlog)

CREATE TABLE IF NOT EXISTS public.roadmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'planned', 'in_progress', 'shipped', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'media'
    CHECK (priority IN ('alta', 'media', 'baja')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_status ON public.roadmap (status);
CREATE INDEX IF NOT EXISTS idx_roadmap_priority ON public.roadmap (priority);

CREATE OR REPLACE FUNCTION public.roadmap_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS roadmap_updated_at ON public.roadmap;
CREATE TRIGGER roadmap_updated_at
  BEFORE UPDATE ON public.roadmap
  FOR EACH ROW EXECUTE FUNCTION public.roadmap_set_updated_at();

ALTER TABLE public.roadmap ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_public_read" ON public.roadmap;
CREATE POLICY "deny_public_read" ON public.roadmap
  FOR SELECT USING (false);

INSERT INTO public.roadmap (title, description, status, priority)
VALUES
  (
    'Kalyo Pages — Perfil público del psicólogo',
    'Página pública por psicólogo con URL propia (kalyo.io/p/nombre), personalizable con foto, bio, especialidades, precios y botón de agendar. Enlazada al directorio kalyo.io. Psicólogos en Kalyo aparecen como "Verificados". Los no registrados ven "Reclama tu perfil".',
    'backlog',
    'alta'
  ),
  (
    'Testimonios verificados',
    'Al terminar terapia, Sofía invita al paciente a dejar reseña anónima verificada. Aparece en Kalyo Page del psicólogo y en el directorio. Diferenciador vs Doctoralia.',
    'backlog',
    'alta'
  );
