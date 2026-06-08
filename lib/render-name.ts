export function renderName(name: string | null | undefined): string {
  if (!name || name.trim() === '' || name === 'undefined' || name === 'null') {
    return '';
  }
  return name.trim();
}

/** "Entiendo Roberto," or "Entiendo," */
export function prefixWithName(prefix: string, name: string): string {
  return name ? `${prefix} ${name},` : `${prefix},`;
}

/** "Roberto, entiendo" or "Entiendo" */
export function nameThenVerb(name: string, verb: string): string {
  return name ? `${name}, ${verb}` : verb.charAt(0).toUpperCase() + verb.slice(1);
}

/** "Entendido Roberto." or "Entendido." */
export function prefixWithNamePeriod(prefix: string, name: string): string {
  return name ? `${prefix} ${name}.` : `${prefix}.`;
}

/** "Hola Roberto," or "Hola," */
export function holaName(name: string): string {
  return name ? `Hola ${name},` : 'Hola,';
}
