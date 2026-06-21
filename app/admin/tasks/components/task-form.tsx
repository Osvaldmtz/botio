'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_CATEGORIES,
  CATEGORY_CONFIG,
  type TaskStatus,
} from '@/lib/tasks/types';
import { cn } from '@/lib/cn';

const fieldClass =
  'w-full rounded border border-bg-border bg-bg px-3 py-2 text-sm text-fg transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted';

type FormState = {
  title: string;
  description: string;
  category: string;
  priority: number;
  due_date: string;
  status: TaskStatus;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: FormState) => Promise<void>;
  loading?: boolean;
};

const DEFAULT: FormState = {
  title: '',
  description: '',
  category: 'bot',
  priority: 3,
  due_date: '',
  status: 'todo',
};

export function TaskForm({ open, onClose, onSubmit, loading }: Props) {
  const [form, setForm] = useState<FormState>(DEFAULT);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await onSubmit(form);
    setForm(DEFAULT);
    onClose();
  }

  return (
    <div className="overflow-hidden rounded-card border border-bg-border bg-bg-elevated">
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-fg-muted">Título</label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-fg-muted">Descripción</label>
          <textarea
            className={cn(fieldClass, 'min-h-[88px] resize-y')}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-muted">Categoría</label>
            <select
              className={fieldClass}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {TASK_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_CONFIG[cat].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-muted">Prioridad</label>
            <select
              className={fieldClass}
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
            >
              {[1, 2, 3, 4].map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-muted">Fecha límite</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-muted">Estado</label>
            <select
              className={fieldClass}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={loading}>
            Crear tarea
          </Button>
        </div>
      </form>
    </div>
  );
}
