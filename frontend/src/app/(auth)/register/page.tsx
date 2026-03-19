'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { registerSchema, RegisterForm } from '@/lib/validators';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [formData, setFormData] = useState<RegisterForm>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const errs: Partial<Record<keyof RegisterForm, string>> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errs[err.path[0] as keyof RegisterForm] = err.message;
      });
      setFieldErrors(errs);
      return;
    }

    setIsLoading(true);
    try {
      const response = await register(formData.username, formData.email, formData.password);
      if (response.success) {
        toast.success('Nalog je kreiran!', {
          description: 'Prijavite se da biste počeli sa kupovinom.',
        });
        router.push('/login');
      } else {
        const msg = response.error || '';
        if (msg.toLowerCase().includes('email')) {
          setFieldErrors((prev) => ({ ...prev, email: 'Ova email adresa je već registrovana' }));
          toast.error('Email adresa je zauzeta', {
            description: 'Pokušajte sa drugom adresom ili se prijavite.',
          });
        } else if (msg.toLowerCase().includes('username') || msg.toLowerCase().includes('korisničko')) {
          setFieldErrors((prev) => ({ ...prev, username: 'Ovo korisničko ime je već zauzeto' }));
          toast.error('Korisničko ime je zauzeto', {
            description: 'Izaberite drugo korisničko ime.',
          });
        } else {
          toast.error('Greška pri registraciji', { description: msg || 'Pokušajte ponovo.' });
        }
      }
    } catch {
      toast.error('Greška', {
        description: 'Nije moguće kreirati nalog. Pokušajte ponovo.',
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
            Kreirajte vaš nalog
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Već imate nalog?{' '}
            <Link href="/login" className="font-medium text-primary hover:text-primary/80">
              Prijavite se
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
                Korisničko ime
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                placeholder="korisnik123"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
              {fieldErrors.username && (
                <p className="text-sm text-destructive mt-1">{fieldErrors.username}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                Email adresa
              </label>
              <input
                id="email"
                name="email"
                type="email"
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
                required
                className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                placeholder="Minimalno 8 karaktera"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              {fieldErrors.password && (
                <p className="text-sm text-destructive mt-1">{fieldErrors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1">
                Potvrdite lozinku
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                placeholder="Ponovite lozinku"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
              {fieldErrors.confirmPassword && (
                <p className="text-sm text-destructive mt-1">{fieldErrors.confirmPassword}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2.5 px-4 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Kreiranje naloga...' : 'Kreiraj nalog'}
          </button>
        </form>
      </div>
    </div>
  );
}
