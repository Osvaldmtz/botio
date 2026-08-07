import { cn } from '@/lib/cn';

type Tone = 'positive' | 'negative' | 'warning' | 'accent' | 'muted';

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

const tones: Record<Tone, string> = {
  positive: 'bg-ky-positive-bg text-ky-positive',
  negative: 'bg-ky-negative-bg text-ky-negative',
  warning: 'bg-ky-warning-bg text-ky-warning',
  accent: 'bg-ky-accent-light text-ky-accent',
  muted: 'bg-ky-surface-1 text-ky-text-muted',
};

export function Badge({ tone = 'muted', className, ...props }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-ky-badge px-2.5 py-1 text-ky-caption',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
