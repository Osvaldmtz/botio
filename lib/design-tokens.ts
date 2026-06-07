export const colors = {
  bg: '#FFFFFF',
  bgSecondary: '#FAFAFA',
  bgTertiary: '#F4F4F5',
  border: '#E4E4E7',
  borderHover: '#D4D4D8',
  text: '#18181B',
  textSecondary: '#71717A',
  textTertiary: '#A1A1AA',
  primary: '#10B981',
  primaryHover: '#059669',
  primaryMuted: '#D1FAE5',
  primaryMutedText: '#047857',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  hot: '#EF4444',
  hotBg: '#FEE2E2',
  info: '#3B82F6',
  infoBg: '#DBEAFE',
} as const;

export const spacing = {
  unit: 4,
  cardPadding: 16,
  sectionGap: 24,
  containerMax: 1400,
} as const;

export const typography = {
  h1: 'text-2xl font-semibold tracking-tight',
  h2: 'text-lg font-semibold tracking-tight',
  body: 'text-sm font-normal',
  small: 'text-[13px] font-normal',
  tiny: 'text-xs font-normal',
} as const;

export const radius = {
  default: '6px',
  card: '8px',
} as const;
