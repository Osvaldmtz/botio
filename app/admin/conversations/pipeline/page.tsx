import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBots } from '../lib/conversation-queries';
import {
  fetchPipelineLeads,
  fetchPipelineStats,
} from '../lib/pipeline-queries';
import { PIPELINE_STAGES, normalizeStage } from '@/lib/pipeline-utils';
import { PipelineDashboard } from '../components/pipeline-dashboard';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  if (!isAdmin()) return <LoginForm />;

  const supabase = createAdminClient();

  const [leads, stats, bots] = await Promise.all([
    fetchPipelineLeads(supabase, {}),
    fetchPipelineStats(supabase),
    fetchBots(supabase),
  ]);

  const grouped = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, [] as typeof leads]),
  ) as Record<(typeof PIPELINE_STAGES)[number], typeof leads>;

  for (const lead of leads) {
    const stage = normalizeStage(lead.pipeline_stage);
    grouped[stage].push(lead);
  }

  return (
    <PipelineDashboard
      initial={{
        grouped,
        stats,
        bots,
        fetchedAt: new Date().toISOString(),
      }}
    />
  );
}
