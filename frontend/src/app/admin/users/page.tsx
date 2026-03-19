'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  per_page: number;
}

const PER_PAGE = 20;

export default function AdminUsersPage() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    api
      .get('/admin/users', { params: { page, per_page: PER_PAGE } })
      .then((res) => {
        const data: UsersResponse = res.data;
        setAllUsers(data.data);
        setTotal(data.total);
      })
      .catch(() => setError('Greška pri učitavanju korisnika'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const filtered = allUsers.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const updateUser = async (
    user: User,
    updates: { is_active?: boolean; role?: string },
  ) => {
    setActionLoading(user.id);
    try {
      await api.put(`/admin/users/${user.id}`, updates);
      if (updates.is_active !== undefined) {
        toast.success(updates.is_active ? 'Korisnik omogućen' : 'Korisnik onemogućen', {
          description: user.username,
        });
      } else if (updates.role === 'admin') {
        toast.success('Uloga promenjena', {
          description: `${user.username} je sada administrator.`,
        });
      }
      fetchUsers();
    } catch (err) {
      toast.error('Greška', { description: getErrorMessage(err) });
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold text-foreground">Korisnici</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">{error}</p>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Pretraži po korisničkom imenu ili emailu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
        />
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
                <th className="px-4 py-3">Korisnik</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Uloga</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Registrovan</th>
                <th className="px-4 py-3">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{user.username}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role === 'admin' ? 'Admin' : 'Korisnik'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.is_active ? 'outline' : 'destructive'}>
                      {user.is_active ? 'Aktivan' : 'Onemogućen'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString('sr-RS')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        disabled={actionLoading === user.id}
                        onClick={() => updateUser(user, { is_active: !user.is_active })}
                        className="rounded bg-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/70 disabled:opacity-50 transition-colors"
                      >
                        {user.is_active ? 'Onemogući' : 'Omogući'}
                      </button>
                      {user.role !== 'admin' && (
                        <button
                          disabled={actionLoading === user.id}
                          onClick={() => updateUser(user, { role: 'admin' })}
                          className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                        >
                          Postavi za admina
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">Nema korisnika.</p>
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
