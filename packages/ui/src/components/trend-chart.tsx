"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../primitives/chart";

import type { TrendPointData } from "../types";

const config = {
  percent: { label: "Completed", color: "var(--color-blue-700)" },
} satisfies ChartConfig;

/** The only chart in the product. One series, no legend, no second axis. */
export function TrendChart({ data }: { data: TrendPointData[] }) {
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke="var(--color-gray-300)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          dy={8}
          tick={{ fill: "var(--color-gray-600)", fontSize: 13 }}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          tickFormatter={(v) => `${v}%`}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-gray-600)", fontSize: 12 }}
        />
        <ChartTooltip
          cursor={{ fill: "var(--color-gray-100)" }}
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => (
                <span className="tabular">
                  {`${value}% — ${item.payload.done} of ${item.payload.due} completed`}
                </span>
              )}
            />
          }
        />
        <Bar dataKey="percent" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            // The most recent day is the one being asked about, so it leads.
            <Cell
              key={i}
              fill={
                i === data.length - 1 ? "var(--color-blue-700)" : "var(--color-blue-300)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
