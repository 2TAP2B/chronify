import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type SectionCardsData = {
  todayHours: number
  todayTargetHours: number
  weekHours: number
  weekTargetHours: number
  overtimeHours: number
  overtimeTrend: "up" | "down" | "neutral"
  vacationRemaining: number
  vacationTotal: number
}

export function SectionCards({
  data,
  labels,
}: {
  data: SectionCardsData
  labels: {
    todayWorked: string
    weekWorked: string
    overtimeBalance: string
    vacationRemaining: string
    todayTarget: string
    weekTarget: string
    ofTarget: string
    days: string
  }
}) {
  const todayDelta = data.todayHours - data.todayTargetHours
  const weekDelta = data.weekHours - data.weekTargetHours
  const todayUp = todayDelta >= 0
  const weekUp = weekDelta >= 0

  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{labels.todayWorked}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.todayHours.toFixed(2)} h
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {todayUp ? (
                <TrendingUpIcon className="size-3" />
              ) : (
                <TrendingDownIcon className="size-3" />
              )}
              {todayDelta >= 0 ? "+" : ""}
              {todayDelta.toFixed(2)} h
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {labels.todayTarget}: {data.todayTargetHours.toFixed(2)} h
          </div>
          <div className="text-muted-foreground">
            {todayUp ? labels.ofTarget : labels.todayTarget}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{labels.weekWorked}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.weekHours.toFixed(2)} h
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {weekUp ? (
                <TrendingUpIcon className="size-3" />
              ) : (
                <TrendingDownIcon className="size-3" />
              )}
              {weekDelta >= 0 ? "+" : ""}
              {weekDelta.toFixed(2)} h
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {labels.weekTarget}: {data.weekTargetHours.toFixed(2)} h
          </div>
          <div className="text-muted-foreground">
            {weekUp ? labels.ofTarget : labels.weekTarget}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{labels.overtimeBalance}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.overtimeHours >= 0 ? "+" : ""}
            {data.overtimeHours.toFixed(2)} h
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {data.overtimeTrend === "up" ? (
                <TrendingUpIcon className="size-3" />
              ) : data.overtimeTrend === "down" ? (
                <TrendingDownIcon className="size-3" />
              ) : null}
              {data.overtimeTrend === "up"
                ? "↑"
                : data.overtimeTrend === "down"
                  ? "↓"
                  : "—"}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {labels.overtimeBalance}
          </div>
          <div className="text-muted-foreground">
            {data.overtimeHours >= 0 ? "Plus" : "Minus"}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{labels.vacationRemaining}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.vacationRemaining} {labels.days}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {data.vacationTotal} {labels.days}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {data.vacationRemaining} / {data.vacationTotal} {labels.days}
          </div>
          <div className="text-muted-foreground">
            {labels.vacationRemaining}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
