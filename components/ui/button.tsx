import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md';
};

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover border border-transparent',
  secondary:
    'bg-bg text-fg border border-bg-border hover:bg-bg-elevated',
  ghost: 'bg-transparent text-fg-muted hover:bg-bg-subtle hover:text-fg border border-transparent',
  destructive:
    'bg-semantic-hot text-white hover:opacity-90 border border-transparent',
};

const sizes: Record<'sm' | 'md', string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-2 text-[13px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors duration-150 ease-out disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
