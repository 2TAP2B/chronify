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
        d="M 21 8.8 A 9 9 0 1 0 21 23.2"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="16"
        x2="13"
        y2="14.3"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="16"
        x2="20.3"
        y2="13.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="1.3" fill="white" />
    </svg>
  );
}