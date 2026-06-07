// DEPRECATED: El timezone ahora se obtiene de la ciudad declarada por el cliente vía cityToTimezone().
// Esta función se mantiene como fallback inicial pero no debe usarse para demos.

export type CustomerTimezone = 'America/Bogota' | 'America/Mexico_City';

export type CustomerTimezoneLabel = 'Bogotá' | 'CDMX';

export function getCustomerTimezone(phone: string | undefined | null): CustomerTimezone {
  const normalized = (phone ?? '').trim().replace(/^whatsapp:/i, '');
  if (normalized.startsWith('+57')) return 'America/Bogota';
  return 'America/Mexico_City';
}

export function getCustomerTimezoneLabel(phone: string | undefined | null): CustomerTimezoneLabel {
  return getCustomerTimezone(phone) === 'America/Bogota' ? 'Bogotá' : 'CDMX';
}
