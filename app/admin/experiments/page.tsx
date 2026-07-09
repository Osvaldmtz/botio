import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBots } from '@/app/admin/conversations/lib/conversation-queries';
import { getExperimentResults, listExperiments } from '@/lib/ab-testing';
import { ExperimentsDashboard } from './components/experiments-dashboard';

export const dynamic = 'force-dynamic';

const KALYO_BOT_ID = process.env.KALYO_BOT_ID ?? '64f6eed2-1522-48fe-a2c6-f858b767df06';

const DEFAULT_VARIANT_A =
  '¡Hola! Soy Sofía de Kalyo 👋 Ayudamos a psicólogos a evaluar pacientes con 91+ pruebas clínicas validadas, todo desde el navegador. ¿Qué te gustaría saber primero: evaluaciones, precios, o cómo funciona la prueba gratis?';

export default async function ExperimentsPage() {
  if (!isAdmin()) return <LoginForm />;

  const supabase = createAdminClient();

  const [experiments, bots] = await Promise.all([
    listExperiments(supabase),
    fetchBots(supabase),
  ]);

  const withResults = await Promise.all(
    experiments.map(async (exp) => {
      const results = await getExperimentResults(supabase, exp.id);
      return { ...exp, results };
    }),
  );

  return (
    <ExperimentsDashboard
      initial={{
        experiments: withResults,
        bots,
        defaults: {
          botId: KALYO_BOT_ID,
          variantA: DEFAULT_VARIANT_A,
        },
        fetchedAt: new Date().toISOString(),
      }}
    />
  );
}
