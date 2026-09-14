export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Fixed brand colour — intentionally independent of the active theme. */}
      <rect width="32" height="32" rx="8" fill="#a78bfa" />

      <g fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle
          cx="16"
          cy="16"
          r="11.5"
          pathLength="100"
          strokeDasharray="75 25"
          strokeDashoffset="12.5"
        />
        <circle
          cx="16"
          cy="16"
          r="8"
          pathLength="100"
          strokeDasharray="75 25"
          strokeDashoffset="12.5"
        />
        <circle
          cx="16"
          cy="16"
          r="4.5"
          pathLength="100"
          strokeDasharray="75 25"
          strokeDashoffset="12.5"
        />
      </g>
    </svg>
  );
}
