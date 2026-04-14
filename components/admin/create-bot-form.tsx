'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createBotAction, type CreateBotState } from '@/app/admin/actions';

const initialState: CreateBotState = { status: 'idle' };

export function CreateBotForm() {
  const [state, formAction] = useFormState<CreateBotState, FormData>(createBotAction, initialState);

  return (
    <div className="space-y-4">
      {state.status === 'success' && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm">
          <p className="font-semibold text-accent">{state.message}</p>
          {state.botId && (
            <p className="mt-2 text-fg-muted">
              Bot ID: <code className="break-all text-fg">{state.botId}</code>
            </p>
          )}
          {state.webhookUrl && (
            <p className="mt-1 text-fg-muted">
              Webhook URL: <code className="break-all text-fg">{state.webhookUrl}</code>
            </p>
          )}
        </div>
      )}
      {state.status === 'error' && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p className="font-semibold text-red-400">{state.message}</p>
        </div>
      )}

      <form
        action={formAction}
        className="grid gap-4 rounded-lg border border-bg-border bg-bg-elevated p-6"
      >
        <Field label="Business name" name="business_name" required />
        <Field label="Bot name" name="bot_name" required />
        <Field
          label="System prompt"
          name="system_prompt"
          textarea
          placeholder="You are a helpful assistant for..."
        />
        <Field label="Twilio Account SID" name="twilio_account_sid" />
        <Field label="Twilio Auth Token" name="twilio_auth_token" type="password" />
        <Field
          label="Twilio WhatsApp number"
          name="twilio_whatsapp_number"
          placeholder="whatsapp:+1234567890"
        />
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="justify-self-start rounded-md bg-accent px-4 py-2 font-semibold text-bg hover:bg-accent-hover disabled:opacity-50"
    >
      {pending ? 'Creating…' : 'Create bot'}
    </button>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  textarea?: boolean;
};

function Field({ label, name, type = 'text', required, placeholder, textarea }: FieldProps) {
  const classes =
    'border-bg-border bg-bg text-fg focus:border-accent w-full rounded-md border px-3 py-2 outline-none';
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wide text-fg-muted">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          placeholder={placeholder}
          rows={4}
          className={classes}
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          placeholder={placeholder}
          className={classes}
        />
      )}
    </label>
  );
}
