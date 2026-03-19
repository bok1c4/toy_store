'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { useOrderStore } from '@/store/orderStore';
import { Button } from '@/components/ui/button';
import { ShoppingCart, AlertCircle, CreditCard } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const rawStripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripeKey = rawStripeKey.startsWith('pk_') ? rawStripeKey : '';
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat('sr-RS', { style: 'currency', currency: 'RSD', minimumFractionDigits: 0 }).format(amount);
};

function StripeCheckoutForm({ shippingAddress }: { shippingAddress: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { createPaymentIntent, confirmCheckout, isLoading, error, clearError } = useOrderStore();
  const [localError, setLocalError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!shippingAddress.trim() || !stripe || !elements) return;
    clearError();
    setLocalError(null);
    setProcessing(true);

    try {
      const { clientSecret, paymentIntentId } = await createPaymentIntent();

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setLocalError('Element kartice nije pronađen');
        setProcessing(false);
        return;
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (stripeError) {
        setLocalError(stripeError.message ?? 'Plaćanje nije uspelo');
        setProcessing(false);
        return;
      }

      if (paymentIntent?.status !== 'succeeded') {
        setLocalError('Plaćanje nije uspelo');
        setProcessing(false);
        return;
      }

      const order = await confirmCheckout(paymentIntentId, shippingAddress);
      router.push(`/checkout/success?order_id=${order.id}`);
    } catch {
    } finally {
      setProcessing(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="space-y-4">
      {displayError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{displayError}</span>
          <button onClick={() => { clearError(); setLocalError(null); }} className="ml-auto text-sm underline">Zatvori</button>
        </div>
      )}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">Stripe plaćanje (Test režim)</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Koristite karticu 4242 4242 4242 4242 · bilo koji budući datum · bilo koji CVC.
        </p>
      </div>
      <div className="rounded-lg border border-input p-4">
        <CardElement
          options={{
            style: {
              base: { fontSize: '16px', color: '#424770', '::placeholder': { color: '#aab7c4' } },
              invalid: { color: '#9e2146' },
            },
          }}
        />
      </div>
      <Button
        onClick={handlePay}
        disabled={!shippingAddress.trim() || isLoading || processing || !stripe}
        className="w-full"
        size="lg"
      >
        {(isLoading || processing) ? (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
            Obrada...
          </>
        ) : 'Plaćaj sa Stripe'}
      </Button>
    </div>
  );
}

function MockCheckoutForm({ shippingAddress, simulateFailure }: {
  shippingAddress: string;
  simulateFailure: boolean;
}) {
  const router = useRouter();
  const { checkout, isLoading, error, clearError } = useOrderStore();

  const handleCheckout = async () => {
    if (!shippingAddress.trim()) return;
    clearError();
    try {
      const order = await checkout(shippingAddress, simulateFailure);
      router.push(`/checkout/success?order_id=${order.id}`);
    } catch {
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <button onClick={clearError} className="ml-auto text-sm underline">Zatvori</button>
        </div>
      )}
      <div className="rounded-lg border border-yellow-200/50 bg-yellow-50/50 p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-400">
          Režim testiranja — pravo plaćanje se ne obrađuje.
        </p>
      </div>
      <Button
        onClick={handleCheckout}
        disabled={!shippingAddress.trim() || isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
            Obrada...
          </>
        ) : 'Plati (Test režim)'}
      </Button>
    </div>
  );
}

interface CartItemShape {
  id: string;
  quantity: number;
  toy?: { name?: string; imageUrl?: string; price?: number };
}

function CheckoutPage({ items, subtotal, cartLoading }: {
  items: CartItemShape[];
  subtotal: number;
  cartLoading: boolean;
}) {
  const [shippingAddress, setShippingAddress] = useState('');
  const [simulateFailure, setSimulateFailure] = useState(false);

  if (cartLoading && items.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-foreground" />
      </div>
    );
  }

  if (items.length === 0 && !cartLoading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="mx-auto max-w-7xl px-4">
          <h1 className="mb-8 text-3xl font-bold text-foreground">Naplata</h1>
          <div className="rounded-lg bg-card py-16 text-center shadow-sm">
            <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold text-foreground">Vaša korpa je prazna</h2>
            <p className="mb-6 text-muted-foreground">Dodajte artikle u korpu pre naplate.</p>
            <Link href="/toys"><Button>Pogledaj igračke</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const addressError = shippingAddress.length > 0 && shippingAddress.trim().length < 10
    ? 'Adresa dostave mora imati najmanje 10 karaktera'
    : null;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        <h1 className="mb-8 text-3xl font-bold text-foreground">Naplata</h1>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <div className="rounded-lg bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Pregled porudžbine</h2>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4 border-b border-border pb-4 last:border-0">
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.toy?.imageUrl ? (
                        <img src={item.toy.imageUrl} alt={item.toy.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">{item.toy?.name}</h3>
                      <p className="text-sm text-muted-foreground">Količina: {item.quantity}</p>
                      <p className="font-semibold text-foreground">
                        {formatPrice((item.toy?.price ?? 0) * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-border pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Ukupno</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
              </div>
            </div>
            <Link href="/cart" className="mt-4 inline-block text-sm text-primary hover:underline">
              ← Nazad u korpu
            </Link>
          </div>

          <div className="rounded-lg bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Informacije o dostavi</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="shipping-address" className="mb-2 block text-sm font-medium text-foreground">
                  Adresa dostave
                </label>
                <textarea
                  id="shipping-address"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Unesite punu adresu za dostavu..."
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={4}
                  maxLength={500}
                />
                {addressError && <p className="mt-1 text-sm text-destructive">{addressError}</p>}
              </div>

              <div className="rounded-lg border border-yellow-200/50 bg-yellow-50/50 p-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={simulateFailure}
                    onChange={(e) => setSimulateFailure(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm text-yellow-800 dark:text-yellow-400">Simuliraj neuspešno plaćanje (za testiranje)</span>
                </label>
              </div>

              {stripePromise ? (
                <Elements stripe={stripePromise}>
                  <StripeCheckoutForm shippingAddress={shippingAddress} />
                </Elements>
              ) : (
                <MockCheckoutForm
                  shippingAddress={shippingAddress}
                  simulateFailure={simulateFailure}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPageWrapper(): JSX.Element {
  const { items, subtotal, isLoading: cartLoading, fetchCart } = useCart();

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  return <CheckoutPage items={items} subtotal={subtotal} cartLoading={cartLoading} />;
}
