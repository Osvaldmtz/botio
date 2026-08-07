import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'nav';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md';
};

const variants: Record<Variant, string> = {
  primary:
    'bg-ky-accent text-white hover:bg-ky-accent-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ky-accent',
  secondary:
    'border border-ky-border bg-transparent text-ky-text-primary hover:bg-ky-surface-1',
  ghost: 'bg-transparent text-ky-text-secondary hover:bg-ky-surface-1 hover:text-ky-text-primary',
  nav: 'bg-ky-nav text-white hover:bg-ky-nav/90',
};

const sizes: Record<'sm' | 'md', string> = {
  sm: 'px-3 py-1.5 text-ky-sm',
  md: 'px-5 py-2.5 text-ky-body',
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
        'inline-flex items-center justify-center gap-2 rounded-ky-btn font-medium transition-colors duration-150 ease-out disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
