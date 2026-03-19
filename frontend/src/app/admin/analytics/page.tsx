'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { api } from '@/lib/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Analytics {
  total_revenue: number;
  orders_per_day: { date: string; count: number; revenue: number }[];
  top_toys: { toy_id: number; toy_name: string; total_sold: number }[];
}

function formatRevenue(amount: number): string {
  return new Intl.NumberFormat('sr-RS').format(amount) + ' RSD';
}

export default function AnalyticsPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/admin/analytics')
      .then((res) => setAnalytics(res.data.data))
      .catch(() => setError('Greška pri učitavanju analitike'))
      .finally(() => setLoading(false));
  }, []);

  const chartColors = {
    primary: isDark ? '#6DAF3A' : '#2D5016',
    accent: isDark ? '#E8941A' : '#D4820A',
    grid: isDark ? '#2E2E28' : '#E8E8E0',
    text: isDark ? '#8A8A7A' : '#6B6B60',
    tooltipBg: isDark ? '#1C1C17' : '#FFFFFF',
    tooltipBorder: isDark ? '#2E2E28' : '#E8E8E0',
    tooltipText: isDark ? '#F0F0E8' : '#1A1A18',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-destructive/10 p-4 text-destructive">{error}</p>;
  }

  const topToysData = (analytics?.top_toys ?? []).map((t) => ({
    ...t,
    name: t.toy_name.length > 15 ? t.toy_name.slice(0, 15) + '…' : t.toy_name,
  }));

  return (
    <div className="space-y-10">
      <h1 className="font-display text-2xl font-bold text-foreground">Analitika</h1>

      <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
        <p className="mb-1 text-sm font-medium text-muted-foreground">Ukupan prihod</p>
        <p className="text-4xl font-bold text-foreground">
          {formatRevenue(analytics?.total_revenue ?? 0)}
        </p>
      </div>

      <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Porudžbine po danima (poslednjih 30 dana)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={analytics?.orders_per_day ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: chartColors.text }}
              axisLine={{ stroke: chartColors.grid }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: chartColors.text }}
              axisLine={{ stroke: chartColors.grid }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: chartColors.tooltipBg,
                borderColor: chartColors.tooltipBorder,
                color: chartColors.tooltipText,
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={chartColors.primary}
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Top 10 igračaka po prodatim komadima
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topToysData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: chartColors.text }}
              axisLine={{ stroke: chartColors.grid }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: chartColors.text }}
              axisLine={{ stroke: chartColors.grid }}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [value, 'Prodato komada']}
              contentStyle={{
                backgroundColor: chartColors.tooltipBg,
                borderColor: chartColors.tooltipBorder,
                color: chartColors.tooltipText,
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="total_sold" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
