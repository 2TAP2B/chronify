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
        d="M21 9.5a8 8 0 1 0 3 11.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M16 16V10.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 16l4.5-2.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="1.3" fill="white" />
    </svg>
  );
}