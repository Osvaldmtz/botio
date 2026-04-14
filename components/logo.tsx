type LogoProps = {
  className?: string;
  'aria-label'?: string;
};

export function Logo({ className, ...rest }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      role="img"
      aria-label={rest['aria-label'] ?? 'Botio logo'}
    >
      {/* antenna */}
      <line
        x1="32"
        y1="6"
        x2="32"
        y2="14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="32" cy="5" r="3" fill="currentColor" />
      {/* head */}
      <rect
        x="10"
        y="14"
        width="44"
        height="38"
        rx="10"
        ry="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      {/* eyes */}
      <circle cx="24" cy="31" r="3.5" fill="currentColor" />
      <circle cx="40" cy="31" r="3.5" fill="currentColor" />
      {/* smile */}
      <path
        d="M22 40 Q32 48 42 40"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
