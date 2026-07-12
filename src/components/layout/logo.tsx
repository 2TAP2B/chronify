import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />

      <path
        d="M 20 8.5 A 8.5 8.5 0 1 0 20 23.5"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      <circle cx="16" cy="8" r="1.1" fill="white" />
      <circle cx="8" cy="16" r="1.1" fill="white" />
      <circle cx="16" cy="24" r="1.1" fill="white" />

      <line
        x1="16"
        y1="16"
        x2="11.7"
        y2="13.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="16"
        x2="21.5"
        y2="12.8"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <circle cx="16" cy="16" r="1.5" fill="white" />
    </svg>
  );
}