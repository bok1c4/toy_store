'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';

interface Order {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
}

interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  per_page: number;
}

const ORDER_STATUSES = ['', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const PER_PAGE = 20;

const statusVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending:    'secondary',
  processing: 'default',
  shipped:    'outline',
  delivered:  'outline',
  cancelled:  'destructive',
};

const statusLabels: Record<string, string> = {
  pending:    'Na čekanju',
  processing: 'U obradi',
  shipped:    'Poslato',
  delivered:  'Dostavljeno',
  cancelled:  'Otkazano',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusVariants[status] ?? 'secondary'}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}

function formatRevenue(amount: number): string {
  return new Intl.NumberFormat('sr-RS').format(amount) + ' RSD';
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = () => {
    setLoading(true);
    api
      .get('/admin/orders', {
        params: { page, per_page: PER_PAGE, ...(statusFilter ? { status: statusFilter } : {}) },
      })
      .then((res) => {
        const data: OrdersResponse = res.data;
        setOrders(data.data);
        setTotal(data.total);
      })
      .catch(() => setError('Greška pri učitavanju porudžbina'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdating(orderId);
    try {
      await api.put(`/admin/orders/${orderId}`, { status });
      toast.success('Status ažuriran', {
        description: `Porudžbina promenjena na: ${statusLabels[status] ?? status}`,
      });
      fetchOrders();
    } catch (err) {
      toast.error('Greška pri ažuriranju', { description: getErrorMessage(err) });
    } finally {
      setUpdating(null);
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold text-foreground">Porudžbine</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">{error}</p>
      )}

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s ? (statusLabels[s] ?? s) : 'Svi statusi'}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-card border border-border shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ID porudžbine</th>
                <th className="px-4 py-3">Ukupno</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Plaćanje</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Izmeni status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {order.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatRevenue(order.total_amount)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">
                    {order.payment_status}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString('sr-RS')}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={order.status}
                      disabled={updating === order.id}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none disabled:opacity-50"
                    >
                      {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => (
                        <option key={s} value={s}>{statusLabels[s] ?? s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {orders.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">Nema porudžbina.</p>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-border px-3 py-1 text-sm text-foreground disabled:opacity-50 hover:bg-muted transition-colors"
          >
            Prethodna
          </button>
          <span className="text-sm text-muted-foreground">
            Strana {page} od {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-border px-3 py-1 text-sm text-foreground disabled:opacity-50 hover:bg-muted transition-colors"
          >
            Sledeća
          </button>
        </div>
      )}
    </div>
  );
}
