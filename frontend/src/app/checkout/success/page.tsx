'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useOrderStore } from '@/store/orderStore';
import { Button } from '@/components/ui/button';
import { CheckCircle, Package, ShoppingBag } from 'lucide-react';

const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat('sr-RS', { style: 'currency', currency: 'RSD', minimumFractionDigits: 0 }).format(amount);
};

const statusLabels: Record<string, string> = {
  pending: 'Na čekanju',
  processing: 'U obradi',
  shipped: 'Poslato',
  delivered: 'Dostavljeno',
  cancelled: 'Otkazano',
};

function CheckoutSuccessContent(): JSX.Element {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const { currentOrder, fetchOrderById, clearCurrentOrder } = useOrderStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrderById(orderId).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }

    return () => {
      clearCurrentOrder();
    };
  }, [orderId, fetchOrderById, clearCurrentOrder]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (!orderId || !currentOrder) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-lg bg-card py-16 text-center shadow-sm">
            <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold text-foreground">Porudžbina nije pronađena</h2>
            <p className="mb-6 text-muted-foreground">Nismo mogli da pronađemo detalje vaše porudžbine.</p>
            <Link href="/toys">
              <Button>Nastavi kupovinu</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-3xl px-4">
        <div className="rounded-lg bg-card p-8 shadow-sm">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">Porudžbina potvrđena!</h1>
            <p className="text-muted-foreground">Hvala na kupovini. Vaša porudžbina je primljena.</p>
          </div>

          <div className="mb-8 rounded-lg bg-muted/50 p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-muted-foreground">ID porudžbine</span>
              <span className="font-mono font-semibold">{currentOrder.id}</span>
            </div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-muted-foreground">Datum porudžbine</span>
              <span>{new Date(currentOrder.created_at).toLocaleDateString('sr-RS')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {statusLabels[currentOrder.status] ?? currentOrder.status}
              </span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Pregled porudžbine</h2>
            <div className="space-y-4">
              {currentOrder.items.map((item) => (
                <div key={item.id} className="flex gap-4 border-b border-border pb-4 last:border-0">
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.toy_image_url ? (
                      <img
                        src={item.toy_image_url}
                        alt={item.toy_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{item.toy_name}</h3>
                    <p className="text-sm text-muted-foreground">Količina: {item.quantity}</p>
                    <p className="font-semibold text-foreground">
                      {formatPrice(item.price_at_purchase * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>Ukupno</span>
                <span>{formatPrice(currentOrder.total_amount)}</span>
              </div>
            </div>
          </div>

          <div className="mb-8 rounded-lg bg-muted/50 p-6">
            <h2 className="mb-2 text-lg font-semibold text-foreground">Adresa dostave</h2>
            <p className="whitespace-pre-wrap text-muted-foreground">{currentOrder.shipping_address}</p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href={`/profile/orders/${currentOrder.id}`} className="flex-1">
              <Button variant="outline" className="w-full">
                <Package className="mr-2 h-4 w-4" />
                Pregled porudžbine
              </Button>
            </Link>
            <Link href="/toys" className="flex-1">
              <Button className="w-full">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Nastavi kupovinu
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage(): JSX.Element {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background py-8">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-foreground" />
          </div>
        </div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
