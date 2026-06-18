export const LOCALES = [
  { code: 'WEST_COAST', label: 'West Coast' },
  { code: 'EAST_COAST', label: 'East Coast' },
  { code: 'MIDWEST', label: 'Midwest' },
  { code: 'SOUTH', label: 'South' }
];

const aliases = new Map([
  ['WEST', 'WEST_COAST'],
  ['WESTCOAST', 'WEST_COAST'],
  ['WEST_COAST', 'WEST_COAST'],
  ['WEST-COAST', 'WEST_COAST'],
  ['EAST', 'EAST_COAST'],
  ['EASTCOAST', 'EAST_COAST'],
  ['EAST_COAST', 'EAST_COAST'],
  ['EAST-COAST', 'EAST_COAST'],
  ['MIDWEST', 'MIDWEST'],
  ['MID_WEST', 'MIDWEST'],
  ['MID-WEST', 'MIDWEST'],
  ['SOUTH', 'SOUTH']
]);

export function normalizeLocale(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const compact = value.trim().toUpperCase().replace(/\s+/g, '_');
  return aliases.get(compact) || null;
}

export function localeLabel(code) {
  return LOCALES.find((locale) => locale.code === code)?.label || code;
}

