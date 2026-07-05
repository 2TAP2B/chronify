"use client"

import * as React from "react"
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type TimeEntryRow = {
  id: string
  date: string
  type: string
  start: string | null
  end: string | null
  breakMinutes: number
  durationHours: number
  note: string | null
}

const typeColors: Record<string, string> = {
  WORK: "text-blue-600 dark:text-blue-400",
  VACATION: "text-green-600 dark:text-green-400",
  SICK: "text-red-600 dark:text-red-400",
  PUBLIC_HOLIDAY: "text-purple-600 dark:text-purple-400",
  PERSONAL: "text-orange-600 dark:text-orange-400",
}

export function DataTable({
  data,
  labels,
}: {
  data: TimeEntryRow[]
  labels: {
    title: string
    date: string
    type: string
    start: string
    end: string
    break: string
    duration: string
    note: string
    noEntries: string
    types: Record<string, string>
  }
}) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "date", desc: true },
  ])

  const columns: ColumnDef<TimeEntryRow>[] = React.useMemo(
    () => [
      {
        accessorKey: "date",
        header: labels.date,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.date}</span>
        ),
      },
      {
        accessorKey: "type",
        header: labels.type,
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              "px-1.5 text-muted-foreground",
              typeColors[row.original.type]
            )}
          >
            {labels.types[row.original.type] ?? row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: "start",
        header: labels.start,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.start ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "end",
        header: labels.end,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.end ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "breakMinutes",
        header: labels.break,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.breakMinutes > 0
              ? `${row.original.breakMinutes} min`
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "durationHours",
        header: () => <div className="text-right">{labels.duration}</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums font-medium">
            {row.original.durationHours > 0
              ? `${row.original.durationHours.toFixed(2)} h`
              : "—"}
          </div>
        ),
      },
      {
        accessorKey: "note",
        header: labels.note,
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-1 max-w-[200px]">
            {row.original.note ?? "—"}
          </span>
        ),
      },
    ],
    [labels]
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">{labels.title}</h2>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {labels.noEntries}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
