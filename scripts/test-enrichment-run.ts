import { enrichLead } from '../lib/lead-enrichment';

const now = new Date().toISOString();

const scenarios = [
  {
    label: 'Lead frío — solo exploración',
    input: {
      phone: '+5281123456789',
      name: 'Ana',
      conversationMessages: [
        { role: 'user', content: 'Hola, ¿qué es Kalyo?', created_at: now },
        { role: 'assistant', content: 'Kalyo es una plataforma para psicólogos.', created_at: now },
      ],
    },
  },
  {
    label: 'Lead tibio — precio y funcionalidades',
    input: {
      phone: '+573001234567',
      name: 'Laura Gómez',
      conversationMessages: [
        { role: 'user', content: 'Hola, me interesa conocer Kalyo para psicólogos', created_at: now },
        { role: 'assistant', content: '¡Hola! Kalyo ayuda con evaluaciones clínicas.', created_at: now },
        {
          role: 'user',
          content: '¿Cuánto cuesta el plan Pro? ¿Incluye evaluaciones y transcripción?',
          created_at: now,
        },
        { role: 'assistant', content: 'El plan Pro cuesta $29 USD/mes.', created_at: now },
        { role: 'user', content: 'Tengo 12 pacientes en mi consulta', created_at: now },
      ],
    },
  },
  {
    label: 'Lead caliente — email, precio, pacientes, humano',
    input: {
      phone: '+528127707070',
      name: 'Pedro Ramírez',
      email: 'pedro@example.com',
      conversationMessages: [
        { role: 'user', content: 'Hola, soy psicólogo certificado con cédula profesional', created_at: now },
        { role: 'assistant', content: '¡Hola Pedro!', created_at: now },
        {
          role: 'user',
          content: '¿Cuánto cuesta el plan Pro? Tengo 8 pacientes y necesito evaluaciones ya',
          created_at: now,
        },
        { role: 'assistant', content: 'El Pro cuesta $29/mes.', created_at: now },
        { role: 'user', content: 'Quiero pagar, mi email es pedro@example.com', created_at: now },
        { role: 'assistant', content: 'Perfecto.', created_at: now },
        { role: 'user', content: '¿Puedo hablar con un asesor humano? Es urgente', created_at: now },
        { role: 'assistant', content: 'Claro.', created_at: now },
        { role: 'user', content: 'Me apunto al plan Pro hoy', created_at: now },
      ],
    },
  },
];

for (const scenario of scenarios) {
  const result = enrichLead(scenario.input);
  console.log(`\n=== ${scenario.label} ===`);
  console.log('score:', result.score);
  console.log('temperature:', result.temperature);
  console.log('country:', result.country, result.city ? `| city: ${result.city}` : '');
  console.log('intent:', result.intent);
  console.log('signals:', result.signals.join(', ') || '(ninguna)');
  console.log('recommendedAction:', result.recommendedAction);
}
