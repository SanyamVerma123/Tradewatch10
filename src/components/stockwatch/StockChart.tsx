
"use client"

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { format } from "date-fns"
import type { HistoricalHistoryResult } from "yahoo-finance2/dist/esm/src/modules/historical"

interface StockChartProps {
    data: HistoricalHistoryResult | null;
    isPositive: boolean;
}

export function StockChart({ data, isPositive }: StockChartProps) {
  if (!data) return <div className="flex justify-center items-center h-full text-muted-foreground">Loading chart...</div>;

  const chartData = data.map(item => ({
    date: format(item.date, "MMM dd"),
    price: item.close,
  }));
  
  const strokeColor = isPositive ? "hsl(var(--positive))" : "hsl(var(--destructive))";
  const fillColor = isPositive ? "hsl(var(--positive) / 0.1)" : "hsl(var(--destructive) / 0.1)";

  return (
    <ResponsiveContainer width="100%" height="100%">
        <AreaChart 
            data={chartData}
            margin={{ top: 5, right: 20, left: -10, bottom: 0 }}
        >
            <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
                </linearGradient>
            </defs>
            <Tooltip 
                contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                }}
                labelStyle={{ fontWeight: 'bold' }}
                formatter={(value: number) => [`₹${value.toFixed(2)}`, "Price"]}
                position={{ y: 0 }}
                allowEscapeViewBox={{ x: false, y: true }}
                wrapperStyle={{ outline: 'none' }}
                isAnimationActive={false}
            />
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
            <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis domain={['dataMin', 'dataMax']} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value).toFixed(0)}`} />
            <Area type="monotone" dataKey="price" stroke={strokeColor} fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} activeDot={{r: 6}} />
        </AreaChart>
    </ResponsiveContainer>
  );
}
