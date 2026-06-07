import { cn } from '@/lib/cn';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
};

export function Card({ className, hover, ...props }: Props) {
  return (
    <div
      className={cn(
        'rounded-card border border-bg-border bg-bg p-4 transition-colors duration-150',
        hover && 'hover:border-bg-border-hover',
        className,
      )}
      {...props}
    />
  );
}
