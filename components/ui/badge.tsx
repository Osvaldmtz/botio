import { cn } from '@/lib/cn';

type Tone = 'default' | 'primary' | 'warning' | 'hot' | 'info' | 'gray';

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

const tones: Record<Tone, string> = {
  default: 'bg-bg-subtle text-fg-muted',
  primary: 'bg-accent-muted text-accent-muted-fg',
  warning: 'bg-semantic-warning-bg text-semantic-warning',
  hot: 'bg-semantic-hot-bg text-semantic-hot',
  info: 'bg-semantic-info-bg text-semantic-info',
  gray: 'bg-bg-subtle text-fg-muted',
};

export function Badge({ tone = 'default', className, ...props }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
