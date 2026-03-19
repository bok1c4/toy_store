'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Analytics {
  total_users: number;
  total_orders: number;
  total_revenue: number;
  orders_per_day: { date: string; count: number; revenue: number }[];
}

function formatRevenue(amount: number): string {
  return new Intl.NumberFormat('sr-RS').format(amount) + ' RSD';
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
      <div className="mb-2 h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}

export default function AdminDashboard() {
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

  const ordersToday = (() => {
    if (!analytics) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return analytics.orders_per_day.find((d) => d.date === today)?.count ?? 0;
  })();

  return (
    <div>
      <h1 className="mb-8 font-display text-2xl font-bold text-foreground">Dashboard</h1>

      {error && (
        <p className="mb-6 rounded-lg bg-destructive/10 p-4 text-destructive">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-6">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <MetricCard label="Ukupno korisnika" value={analytics?.total_users ?? 0} />
            <MetricCard label="Ukupno porudžbina" value={analytics?.total_orders ?? 0} />
            <MetricCard
              label="Ukupan prihod"
              value={formatRevenue(analytics?.total_revenue ?? 0)}
            />
            <MetricCard label="Porudžbine danas" value={ordersToday} />
          </>
        )}
      </div>
    </div>
  );
}
