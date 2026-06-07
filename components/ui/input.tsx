import { cn } from '@/lib/cn';

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        'w-full rounded border border-bg-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-tertiary transition-colors duration-150',
        'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted',
        className,
      )}
      {...props}
    />
  );
}
