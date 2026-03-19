'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, LoginForm } from '@/lib/validators';
import { toast } from 'sonner';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState<LoginForm>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    window.location.href = '/toys';
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const errs: Partial<Record<keyof LoginForm, string>> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errs[err.path[0] as keyof LoginForm] = err.message;
      });
      setFieldErrors(errs);
      return;
    }

    setIsLoading(true);
    try {
      const response = await login(formData.email, formData.password);
      if (response.success) {
        toast.success('Dobrodošli!');
        window.location.href = '/toys';
      } else {
        toast.error('Greška pri prijavi', {
          description: response.error || 'Pogrešan email ili lozinka.',
        });
      }
    } catch {
      toast.error('Greška', {
        description: 'Nije moguće povezati se sa serverom. Pokušajte ponovo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center font-display text-3xl font-bold text-foreground">
            Prijavite se na vaš nalog
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Ili{' '}
            <Link href="/register" className="font-medium text-primary hover:text-primary/80">
              kreirajte novi nalog
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                Email adresa
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                placeholder="vas@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {fieldErrors.email && (
                <p className="text-sm text-destructive mt-1">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                Lozinka
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                placeholder="Vaša lozinka"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              {fieldErrors.password && (
                <p className="text-sm text-destructive mt-1">{fieldErrors.password}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2.5 px-4 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Prijava...' : 'Prijavi se'}
          </button>
        </form>
      </div>
    </div>
  );
}
