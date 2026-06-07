'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createBotAction, type CreateBotState } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const initialState: CreateBotState = { status: 'idle' };

export function CreateBotForm() {
  const [state, formAction] = useFormState<CreateBotState, FormData>(createBotAction, initialState);

  return (
    <div className="space-y-4">
      {state.status === 'success' && (
        <div className="rounded border border-accent-muted bg-accent-muted p-4 text-sm">
          <p className="font-medium text-accent-muted-fg">{state.message}</p>
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
        <div role="alert" className="rounded border border-semantic-hot-bg bg-semantic-hot-bg p-4 text-sm">
          <p className="font-medium text-semantic-hot">{state.message}</p>
        </div>
      )}

      <form action={formAction} className="grid gap-4">
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
    <Button type="submit" disabled={pending} className="justify-self-start">
      {pending ? 'Creating…' : 'Create bot'}
    </Button>
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
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
        {label}
      </span>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          placeholder={placeholder}
          rows={4}
          className="w-full rounded border border-bg-border bg-bg px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
        />
      ) : (
        <Input type={type} name={name} required={required} placeholder={placeholder} />
      )}
    </label>
  );
}
