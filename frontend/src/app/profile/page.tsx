'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Package, User, Lock, ChevronRight } from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar_url?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
}

export default function ProfilePage(): JSX.Element {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [username, setUsername] = useState('');
  const [address, setAddress] = useState('');

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/user/profile');
      const userData = response.data.data as UserProfile;
      setProfile(userData);
      setUsername(userData.username);
      setAddress(userData.address || '');
    } catch {
      setError('Greška pri učitavanju profila');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setUpdateLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/user/profile', { username, address });
      setSuccess('Profil uspešno ažuriran');
      setIsEditing(false);
      fetchProfile();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri ažuriranju profila');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Lozinke se ne podudaraju');
      return;
    }
    if (newPassword.length < 8) {
      setError('Nova lozinka mora imati najmanje 8 karaktera');
      return;
    }
    setPasswordLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/user/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess('Lozinka uspešno promenjena');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Greška pri promeni lozinke');
    } finally {
      setPasswordLoading(false);
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

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-4xl px-4">
        <h1 className="mb-8 font-display text-3xl font-bold text-foreground">Moj profil</h1>

        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 p-4 text-destructive">
            {error}
            <button onClick={() => setError('')} className="ml-4 text-sm underline">Zatvori</button>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg bg-primary/10 p-4 text-primary">
            {success}
            <button onClick={() => setSuccess('')} className="ml-4 text-sm underline">Zatvori</button>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {/* Sidebar */}
          <div className="space-y-4">
            <Link
              href="/profile/orders"
              className="flex items-center justify-between rounded-lg bg-card border border-border p-4 shadow-sm hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-foreground">Moje porudžbine</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>

            <div className="rounded-lg bg-card border border-border p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-foreground">Profil</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Profile Information */}
            <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Informacije o profilu</h2>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    Izmeni
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Korisničko ime</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Email</label>
                    <input
                      type="email"
                      value={profile?.email}
                      disabled
                      className="w-full rounded-lg border border-input bg-muted px-4 py-2 text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Adresa za dostavu</label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Unesite vašu adresu za dostavu..."
                    />
                  </div>
                  <div className="flex gap-4">
                    <Button onClick={handleUpdateProfile} disabled={updateLoading}>
                      {updateLoading ? 'Čuvanje...' : 'Sačuvaj izmene'}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditing(false);
                      setUsername(profile?.username || '');
                      setAddress(profile?.address || '');
                    }}>
                      Otkaži
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-b border-border pb-4">
                    <span className="text-sm text-muted-foreground">Korisničko ime</span>
                    <p className="font-medium text-foreground">{profile?.username}</p>
                  </div>
                  <div className="border-b border-border pb-4">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <p className="font-medium text-foreground">{profile?.email}</p>
                  </div>
                  <div className="border-b border-border pb-4">
                    <span className="text-sm text-muted-foreground">Uloga</span>
                    <p className="font-medium text-foreground capitalize">{profile?.role}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Adresa za dostavu</span>
                    <p className="font-medium text-foreground whitespace-pre-wrap">
                      {profile?.address || 'Nije podešena'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Password Change */}
            <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">Promena lozinke</h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                >
                  {showPasswordForm ? 'Otkaži' : 'Promeni lozinku'}
                </Button>
              </div>

              {showPasswordForm && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Trenutna lozinka</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Nova lozinka</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Potvrdite novu lozinku</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <Button onClick={handleChangePassword} disabled={passwordLoading}>
                    {passwordLoading ? 'Menja se...' : 'Promeni lozinku'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
