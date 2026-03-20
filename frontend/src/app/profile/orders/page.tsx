'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useOrderStore } from '@/store/orderStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Package, AlertCircle, Clock, CheckCircle, XCircle, Truck } from 'lucide-react';

const statusIcons: Record<string, React.ReactNode> = {
  pending:    <Clock className="h-4 w-4" />,
  processing: <Package className="h-4 w-4" />,
  shipped:    <Truck className="h-4 w-4" />,
  delivered:  <CheckCircle className="h-4 w-4" />,
  cancelled:  <XCircle className="h-4 w-4" />,
};

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

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('sr-RS').format(amount) + ' RSD';
}

export default function OrdersPage(): JSX.Element {
  const { orders, totalOrders, currentPage, perPage, isLoading, error, fetchOrders, clearError } = useOrderStore();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    fetchOrders(1, 10);
  }, [fetchOrders]);

  const totalPages = Math.ceil(totalOrders / perPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) fetchOrders(page, perPage);
  };

  const openCancelModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancelRequest = async () => {
    if (!selectedOrderId || !cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      await useOrderStore.getState().requestCancellation(selectedOrderId, cancelReason);
      setShowCancelModal(false);
      setSelectedOrderId(null);
      setCancelReason('');
    } catch {
      // error handled by store
    } finally {
      setCancelLoading(false);
    }
  };

  if (isLoading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="mx-auto max-w-7xl px-4">
          <h1 className="mb-8 font-display text-3xl font-bold text-foreground">Moje porudžbine</h1>
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        <h1 className="mb-8 font-display text-3xl font-bold text-foreground">Moje porudžbine</h1>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <button onClick={clearError} className="ml-auto text-sm underline">Zatvori</button>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="rounded-lg bg-card border border-border py-16 text-center shadow-sm">
            <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
            <h2 className="mb-2 text-xl font-semibold text-foreground">Još nema porudžbina</h2>
            <p className="mb-6 text-muted-foreground">Još uvek niste naručili ništa.</p>
            <Link href="/toys">
              <Button>Počnite kupovinu</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="rounded-lg bg-card border border-border p-6 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <Link
                        href={`/profile/orders/${order.id}`}
                        className="text-lg font-semibold text-primary hover:underline"
                      >
                        Porudžbina #{order.id.slice(0, 8)}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        Naručeno {new Date(order.created_at).toLocaleDateString('sr-RS')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusVariants[order.status] ?? 'secondary'} className="flex items-center gap-1.5">
                        {statusIcons[order.status]}
                        {statusLabels[order.status] ?? order.status}
                      </Badge>
                      <span className="font-semibold text-foreground">
                        {formatPrice(order.total_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">
                      {order.items.length} stavk{order.items.length === 1 ? 'a' : 'e'}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="relative h-12 w-12 overflow-hidden rounded bg-muted">
                          {item.toy_image_url ? (
                            <Image
                              src={item.toy_image_url}
                              alt={item.toy_name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <Package className="h-full w-full p-2 text-muted-foreground/40" />
                          )}
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <div className="flex h-12 w-12 items-center justify-center rounded bg-muted text-sm font-medium text-muted-foreground">
                          +{order.items.length - 3}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/profile/orders/${order.id}`}>
                      <Button variant="outline" size="sm">Pogledaj detalje</Button>
                    </Link>

                    {(order.status === 'pending' || order.status === 'processing') && !order.cancellation_requested && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCancelModal(order.id)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Zatraži otkazivanje
                      </Button>
                    )}

                    {order.cancellation_requested && (
                      <span className="text-sm text-muted-foreground">
                        Otkazivanje zatraženo
                        {order.cancellation_approved === true && ' — Odobreno'}
                        {order.cancellation_approved === false && ' — Odbijeno'}
                        {order.cancellation_approved === null && ' — Na čekanju'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => { e.preventDefault(); handlePageChange(page); }}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card border border-border p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Zatraži otkazivanje porudžbine</h2>
            <p className="mb-4 text-muted-foreground">Navedite razlog za otkazivanje:</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mb-4 w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              rows={4}
              placeholder="Unesite razlog..."
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCancelModal(false)}>
                Otkaži
              </Button>
              <Button
                onClick={handleCancelRequest}
                disabled={!cancelReason.trim() || cancelLoading}
              >
                {cancelLoading ? 'Šalje se...' : 'Pošalji zahtev'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
