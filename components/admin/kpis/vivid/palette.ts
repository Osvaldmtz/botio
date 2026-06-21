export const VIVID = {
  emerald: { from: '#10B981', to: '#14B8A6', light: '#D1FAE5', text: '#065F46' },
  violet: { from: '#8B5CF6', to: '#A78BFA', light: '#EDE9FE', text: '#5B21B6' },
  rose: { from: '#F43F5E', to: '#FB7185', light: '#FFE4E6', text: '#9F1239' },
  amber: { from: '#F59E0B', to: '#FBBF24', light: '#FEF3C7', text: '#92400E' },
  sky: { from: '#0EA5E9', to: '#38BDF8', light: '#E0F2FE', text: '#075985' },
  fuchsia: { from: '#D946EF', to: '#E879F9', light: '#FAE8FF', text: '#86198F' },
  orange: { from: '#F97316', to: '#FB923C', light: '#FFEDD5', text: '#9A3412' },
  indigo: { from: '#6366F1', to: '#818CF8', light: '#E0E7FF', text: '#3730A3' },
} as const;

export type VividAccent = keyof typeof VIVID;

export const CHART_COLORS = [
  '#10B981',
  '#6366F1',
  '#F59E0B',
  '#F43F5E',
  '#0EA5E9',
  '#D946EF',
  '#F97316',
  '#14B8A6',
];
