export const TASK_CATEGORIES = [
  'bot',
  'landing',
  'ig',
  'contenido',
  'ads',
  'kalyo',
  'manual',
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Task = {
  id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  status: TaskStatus;
  priority: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskStats = {
  todo: number;
  in_progress: number;
  overdue: number;
  completedThisMonth: number;
};

export const PLAN_START_DATE = '2026-06-21';

export const CATEGORY_CONFIG: Record<
  TaskCategory,
  { label: string; shortLabel: string; color: string }
> = {
  bot: { label: 'Botio', shortLabel: 'Botio', color: '#7F77DD' },
  landing: { label: 'Landing', shortLabel: 'Landing', color: '#D85A30' },
  ig: { label: 'Instagram', shortLabel: 'Instagram', color: '#993556' },
  contenido: { label: 'Contenido', shortLabel: 'Contenido', color: '#BA7517' },
  ads: { label: 'Ads', shortLabel: 'Ads', color: '#185FA5' },
  kalyo: { label: 'Kalyo App', shortLabel: 'Kalyo App', color: '#0F6E56' },
  manual: { label: 'Comercial', shortLabel: 'Comercial', color: '#A32D2D' },
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Por hacer',
  in_progress: 'En progreso',
  done: 'Lista',
  blocked: 'Bloqueada',
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Urgente',
  2: 'Alta',
  3: 'Media',
  4: 'Baja',
};

export const KANBAN_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];
