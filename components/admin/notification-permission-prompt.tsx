'use client';

import { useCallback, useEffect, useState } from 'react';

type PermissionState = NotificationPermission | 'unsupported';

export function NotificationPermissionPrompt() {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
    setDismissed(sessionStorage.getItem('hot_lead_prompt_dismissed') === 'true');
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      sessionStorage.setItem('hot_lead_prompt_dismissed', 'true');
      setDismissed(true);
    }
  }, []);

  if (permission === 'unsupported' || dismissed) return null;

  if (permission === 'default') {
    return (
      <div className="border-b border-bg-border bg-semantic-info-bg px-4 py-2 sm:px-6">
        <div className="mx-auto flex max-w-dashboard flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-fg">
            🔔 Activa notificaciones del navegador para alertas HOT
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void requestPermission()}
              className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover"
            >
              Activar
            </button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('hot_lead_prompt_dismissed', 'true');
                setDismissed(true);
              }}
              className="text-xs text-fg-muted hover:text-fg"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="border-b border-bg-border bg-semantic-warning-bg px-4 py-2 sm:px-6">
        <p className="mx-auto max-w-dashboard text-sm text-fg-muted">
          Notificaciones bloqueadas. Reactivar en Configuración del navegador.
        </p>
      </div>
    );
  }

  return null;
}
