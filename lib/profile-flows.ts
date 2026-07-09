import type { ProfileType } from '@/lib/profile-detection';
import { KALYO_PRICING } from '@/lib/kalyo-pricing-data';

export type RecommendedPlan = 'starter' | 'starter_free';

export type ProfileFlowConfig = {
  recommended_plan: RecommendedPlan;
  offer_trial: boolean;
  offer_demo: boolean;
  offer_volume_discount: boolean;
  key_messages: string[];
  objection_handling: Record<string, string>;
};

export const PROFILE_FLOWS: Record<Exclude<ProfileType, 'unknown'>, ProfileFlowConfig> = {
  private_practice: {
    recommended_plan: 'starter',
    offer_trial: true,
    offer_demo: false,
    offer_volume_discount: false,
    key_messages: [
      'Max recomendado: agenda + videollamadas + transcripción',
      'reportes IA ahorran horas por paciente',
      '91+ evaluaciones validadas (PHQ-9, Beck, etc.)',
    ],
    objection_handling: {
      precio:
        'El plan Max ($39/mes) suele pagarse solo con 1-2 pacientes extra al mes. Pro ($29/mes) si busca algo más básico.',
      tiempo: 'La configuración toma menos de 10 minutos; puedes importar pacientes después.',
    },
  },
  clinic_team: {
    recommended_plan: 'starter',
    offer_trial: true,
    offer_demo: true,
    offer_volume_discount: true,
    key_messages: [
      'agrega colegas con permisos diferenciados (Max)',
      'panel administrativo para coordinar pacientes',
      'descuento por volumen disponible (mencionar si pregunta precio en bloque)',
    ],
    objection_handling: {
      precio: 'Para equipos ofrecemos demo y descuentos por volumen — puedo agendarte una llamada corta.',
      integracion: 'Kalyo exporta PDF y funciona con flujos existentes sin reemplazar tu EHR.',
    },
  },
  student: {
    recommended_plan: 'starter_free',
    offer_trial: false,
    offer_demo: false,
    offer_volume_discount: false,
    key_messages: [
      'plan Starter gratis es ideal para empezar',
      'puedes guardar tu progreso de tesis',
      'cuando empieces a atender, ya tendrás todo configurado',
    ],
    objection_handling: {
      precio: `El plan Starter es gratis para siempre con ${KALYO_PRICING.starter.max_patients} pacientes y ${KALYO_PRICING.starter.max_evaluations_per_month} evaluaciones/mes — perfecto mientras estudias.`,
      trial: 'El trial Max es para psicólogos que ya atienden; el Starter gratis te sirve mientras estudias.',
    },
  },
  institution_decision_maker: {
    recommended_plan: 'starter',
    offer_trial: true,
    offer_demo: true,
    offer_volume_discount: true,
    key_messages: [
      'planes corporativos a medida',
      'demo personalizada con tu equipo',
      'integraciones con sistemas existentes (Excel, PDFs, etc.)',
    ],
    objection_handling: {
      presupuesto: 'Podemos armar una propuesta con ROI estimado y piloto para tu institución.',
      seguridad: 'Los datos están en infraestructura cloud con acceso por rol y exportación controlada.',
    },
  },
};

export function buildProfilePromptBlock(profile: ProfileType): string {
  if (profile === 'unknown') return '';

  const flow = PROFILE_FLOWS[profile];
  const objections = Object.entries(flow.objection_handling)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  return `
PERFIL DETECTADO DEL USUARIO: ${profile}
PUNTOS CLAVE A MENCIONAR (cuando sean relevantes, no forzados):
${flow.key_messages.map((m) => `- ${m}`).join('\n')}
PLAN RECOMENDADO: ${flow.recommended_plan === 'starter_free' ? 'Starter gratis' : 'Max ($39) — Pro ($29) como alternativa más básica'}
OFRECER TRIAL PRO: ${flow.offer_trial ? 'sí' : 'no'}
OFRECER DEMO: ${flow.offer_demo ? 'sí' : 'no'}
OFRECER DESCUENTO VOLUMEN: ${flow.offer_volume_discount ? 'sí' : 'no'}
MANEJO DE OBJECIONES (usar solo si el usuario las plantea):
${objections}
`.trim();
}
