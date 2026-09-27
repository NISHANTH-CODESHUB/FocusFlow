import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps, type TooltipValueType } from 'recharts'
import { cn, percent } from '@/lib/utils'

/** Categorical slots in validated order — assign by entity, never cycle. */
export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)']

export interface SeriesDef {
  key: string
  label: string
  color: string
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<TooltipValueType, string | number>) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0)
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="font-medium text-foreground tabular-nums">{p.value}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="mt-1 flex justify-between border-t border-border pt-1 text-muted-foreground">
          <span>Total</span>
          <span className="font-medium text-foreground tabular-nums">{total}</span>
        </div>
      )}
    </div>
  )
}

export function Legend({ series }: { series: SeriesDef[] }) {
  if (series.length < 2) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

const axisProps = {
  stroke: 'var(--chart-axis)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const

interface TimeChartProps {
  data: Array<Record<string, string | number>>
  series: SeriesDef[]
  xKey?: string
  height?: number
  stacked?: boolean
  ariaLabel: string
}

/** Stacked bars over time with thin rounded tops and a 2px surface gap between segments. */
export function TimeBarChart({ data, series, xKey = 'label', height = 220, stacked = true, ariaLabel }: TimeChartProps) {
  const dense = data.length > 14
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap={dense ? 2 : '28%'}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} {...axisProps} interval={dense ? 'preserveStartEnd' : 0} minTickGap={8} />
          <YAxis {...axisProps} allowDecimals={false} width={48} />
          <Tooltip content={ChartTooltip} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? 'a' : undefined}
              fill={s.color}
              stroke="var(--card)"
              strokeWidth={stacked ? 1 : 0}
              radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={36}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TimeLineChart({ data, series, xKey = 'label', height = 220, ariaLabel }: TimeChartProps) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} {...axisProps} minTickGap={12} />
          <YAxis {...axisProps} allowDecimals={false} width={48} />
          <Tooltip content={ChartTooltip} cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Labelled progress rows — clearer than a chart for "x of y done" comparisons. */
export function ProgressRows({
  rows,
  empty,
}: {
  rows: Array<{ key: string; label: ReactNode; done: number; total: number; color?: string; suffix?: ReactNode }>
  empty?: ReactNode
}) {
  if (!rows.length) return <>{empty}</>
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = percent(r.done, r.total)
        return (
          <li key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {r.suffix ?? (
                  <>
                    {r.done}/{r.total} · <span className="font-medium text-foreground">{pct}%</span>
                  </>
                )}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: r.color ?? 'var(--primary)' }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Single stacked bar split into segments, with a legend that carries the values. */
export function SegmentBar({ segments, className }: { segments: Array<{ key: string; label: string; value: number; color: string }>; className?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => <div key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: s.color }} />
            {s.label} <span className="font-medium text-foreground tabular-nums">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Circular progress for single headline percentages. */
export function Ring({ value, size = 56, label }: { value: number; size?: number; label: string }) {
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${v}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={v === 100 ? 'var(--success)' : 'var(--primary)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">{v}%</span>
    </div>
  )
}
