import {
  Card,
  CardDescription,
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
    dailyTarget: string
    weekTarget: string
    days: string
  }
}) {
  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{labels.todayWorked}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.todayHours.toFixed(2)} h
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {labels.dailyTarget}: {data.todayTargetHours.toFixed(2)} h
          </p>
        </CardHeader>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{labels.weekWorked}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.weekHours.toFixed(2)} h
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {labels.weekTarget}: {data.weekTargetHours.toFixed(2)} h
          </p>
        </CardHeader>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{labels.overtimeBalance}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.overtimeHours >= 0 ? "+" : ""}
            {data.overtimeHours.toFixed(2)} h
          </CardTitle>
        </CardHeader>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{labels.vacationRemaining}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {data.vacationRemaining} {labels.days}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {data.vacationTotal} {labels.days}
          </p>
        </CardHeader>
      </Card>
    </div>
  )
}
