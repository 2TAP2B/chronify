import Link from "next/link";

export function YearPicker({ year }: { year: number }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`?year=${year - 1}`}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
      >
        ← {year - 1}
      </Link>
      <span className="font-semibold">{year}</span>
      <Link
        href={`?year=${year + 1}`}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
      >
        {year + 1} →
      </Link>
    </div>
  );
}