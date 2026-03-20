'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useOrderStore } from '@/store/orderStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowLeft, Clock, CheckCircle, XCircle, Truck, AlertCircle } from 'lucide-react';

const statusIcons: Record<string, React.ReactNode> = {
  pending:    <Clock className="h-5 w-5" />,
  processing: <Package className="h-5 w-5" />,
  shipped:    <Truck className="h-5 w-5" />,
  delivered:  <CheckCircle className="h-5 w-5" />,
  cancelled:  <XCircle className="h-5 w-5" />,
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

const paymentVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  paid:     'default',
  pending:  'secondary',
  failed:   'destructive',
  refunded: 'outline',
};

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('sr-RS').format(amount) + ' RSD';
}

export default function OrderDetailPage(): JSX.Element {
  const params = useParams();
  const orderId = params.id as string;
  const { currentOrder, isLoading, error, fetchOrderById, clearError, requestCancellation } = useOrderStore();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    if (orderId) fetchOrderById(orderId);
  }, [orderId, fetchOrderById]);

  const handleCancelRequest = async () => {
    if (!cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      await requestCancellation(orderId, cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
      fetchOrderById(orderId);
    } catch {
      // error handled by store
    } finally {
      setCancelLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (!currentOrder) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-lg bg-card border border-border py-16 text-center shadow-sm">
            <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
            <h2 className="mb-2 text-xl font-semibold text-foreground">Porudžbina nije pronađena</h2>
            <p className="mb-6 text-muted-foreground">Nismo mogli da pronađemo ovu porudžbinu.</p>
            <Link href="/profile/orders">
              <Button>Nazad na porudžbine</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-4xl px-4">
        <Link
          href="/profile/orders"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Nazad na porudžbine
        </Link>

        <h1 className="mb-8 font-display text-3xl font-bold text-foreground">Detalji porudžbine</h1>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <button onClick={clearError} className="ml-auto text-sm underline">Zatvori</button>
          </div>
        )}

        <div className="space-y-6">
          {/* Order Header */}
          <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">ID porudžbine</p>
                <p className="font-mono font-semibold text-foreground">{currentOrder.id}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Datum</p>
                <p className="font-medium text-foreground">
                  {new Date(currentOrder.created_at).toLocaleDateString('sr-RS')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Badge variant={statusVariants[currentOrder.status] ?? 'secondary'} className="flex items-center gap-1.5 text-sm px-3 py-1">
                {statusIcons[currentOrder.status]}
                {statusLabels[currentOrder.status] ?? currentOrder.status}
              </Badge>
              <span className="text-2xl font-bold text-brand-primary">
                {formatPrice(currentOrder.total_amount)}
              </span>
            </div>
          </div>

          {/* Order Items */}
          <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Stavke</h2>
            <div className="space-y-4">
              {currentOrder.items.map((item) => (
                <div key={item.id} className="flex gap-4 border-b border-border pb-4 last:border-0">
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.toy_image_url ? (
                      <Image src={item.toy_image_url} alt={item.toy_name} fill className="object-cover" />
                    ) : (
                      <Package className="h-full w-full p-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{item.toy_name}</h3>
                    <p className="text-sm text-muted-foreground">Količina: {item.quantity}</p>
                    <p className="text-sm text-muted-foreground">
                      Cena: {formatPrice(item.price_at_purchase)} po komadu
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      {formatPrice(item.price_at_purchase * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 border-t border-border pt-4">
              <div className="flex justify-between text-lg font-semibold text-foreground">
                <span>Ukupno</span>
                <span>{formatPrice(currentOrder.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Adresa za dostavu</h2>
            <p className="whitespace-pre-wrap text-muted-foreground">{currentOrder.shipping_address}</p>
          </div>

          {/* Payment Status */}
          <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Plaćanje</h2>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status plaćanja:</span>
              <Badge variant={paymentVariants[currentOrder.payment_status] ?? 'secondary'}>
                {currentOrder.payment_status === 'paid' ? 'Plaćeno'
                  : currentOrder.payment_status === 'pending' ? 'Na čekanju'
                  : currentOrder.payment_status === 'failed' ? 'Neuspešno'
                  : currentOrder.payment_status === 'refunded' ? 'Refundirano'
                  : currentOrder.payment_status}
              </Badge>
            </div>
          </div>

          {/* Cancellation Section */}
          {(currentOrder.status === 'pending' || currentOrder.status === 'processing') && (
            <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Otkazivanje porudžbine</h2>

              {!currentOrder.cancellation_requested ? (
                <div>
                  <p className="mb-4 text-muted-foreground">
                    Trebate otkazati porudžbinu? Možete podneti zahtev ispod.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelModal(true)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Zatraži otkazivanje
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg bg-muted p-4">
                  <h3 className="mb-2 font-semibold text-foreground">Otkazivanje zatraženo</h3>
                  <p className="mb-2 text-muted-foreground">
                    <strong>Razlog:</strong> {currentOrder.cancellation_reason}
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Status:</strong>{' '}
                    {currentOrder.cancellation_approved === null && 'Na čekanju'}
                    {currentOrder.cancellation_approved === true && 'Odobreno — Porudžbina otkazana'}
                    {currentOrder.cancellation_approved === false && 'Odbijeno'}
                  </p>
                  {currentOrder.cancellation_response && (
                    <p className="mt-2 text-muted-foreground">
                      <strong>Odgovor:</strong> {currentOrder.cancellation_response}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
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
              <Button onClick={handleCancelRequest} disabled={!cancelReason.trim() || cancelLoading}>
                {cancelLoading ? 'Šalje se...' : 'Pošalji zahtev'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
