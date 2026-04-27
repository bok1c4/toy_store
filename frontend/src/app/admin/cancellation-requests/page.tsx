'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';

interface CancellationItem {
  id: string;
  user_id: string;
  user_username: string;
  user_email: string;
  status: string;
  payment_status: string;
  total_amount: number;
  cancellation_reason?: string | null;
  created_at: string;
}

interface CancellationListResponse {
  data: CancellationItem[];
  total: number;
  page: number;
  per_page: number;
}

const PER_PAGE = 20;

function formatRevenue(amount: number): string {
  return new Intl.NumberFormat('sr-RS').format(amount) + ' RSD';
}

export default function AdminCancellationRequestsPage() {
  const [items, setItems] = useState<CancellationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [responding, setResponding] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<Record<string, string>>({});

  const fetchRequests = () => {
    setLoading(true);
    api
      .get('/admin/cancellation-requests', { params: { page, per_page: PER_PAGE } })
      .then((res) => {
        const data: CancellationListResponse = res.data;
        setItems(data.data);
        setTotal(data.total);
      })
      .catch(() => setError('Greška pri učitavanju zahteva za otkazivanje'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, [page]);

  const respond = async (orderId: string, approve: boolean) => {
    setResponding(orderId);
    try {
      const url = approve
        ? `/admin/cancellation-requests/${orderId}/approve`
        : `/admin/cancellation-requests/${orderId}/decline`;
      await api.put(url, { approved: approve, response: responseText[orderId] ?? '' });
      toast.success(approve ? 'Zahtev odobren' : 'Zahtev odbijen');
      fetchRequests();
    } catch (err) {
      toast.error('Greška', { description: getErrorMessage(err) });
    } finally {
      setResponding(null);
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold text-foreground">
        Zahtevi za otkazivanje
      </h1>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-card border border-border p-8 text-center text-muted-foreground">
          Nema zahteva za otkazivanje na čekanju.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">
                    Porudžbina: {item.id.slice(0, 8)}…
                  </p>
                  <p className="text-sm text-foreground">
                    {item.user_username}{' '}
                    <span className="text-muted-foreground">({item.user_email})</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{item.status}</Badge>
                  <span className="text-sm font-medium text-foreground">
                    {formatRevenue(item.total_amount)}
                  </span>
                </div>
              </div>

              {item.cancellation_reason && (
                <div className="mb-3 rounded bg-muted p-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Razlog
                  </p>
                  <p className="text-sm text-foreground">{item.cancellation_reason}</p>
                </div>
              )}

              <textarea
                value={responseText[item.id] ?? ''}
                onChange={(e) =>
                  setResponseText((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
                placeholder="Odgovor administratora (opciono)"
                rows={2}
                className="mb-3 w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              />

              <div className="flex gap-2">
                <button
                  disabled={responding === item.id}
                  onClick={() => respond(item.id, true)}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Odobri
                </button>
                <button
                  disabled={responding === item.id}
                  onClick={() => respond(item.id, false)}
                  className="rounded border border-destructive bg-background px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Odbij
                </button>
              </div>
            </div>
          ))}
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
