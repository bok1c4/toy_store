import { cookies } from 'next/headers';
import { HeroSection } from '@/components/home/HeroSection';
import { CategoryBar } from '@/components/home/CategoryBar';
import { FeaturedToys } from '@/components/home/FeaturedToys';
import { AgeGroupSection } from '@/components/home/AgeGroupSection';
import { TrustBanner } from '@/components/home/TrustBanner';
import type { Toy, AgeGroup, ToyType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? 'http://backend:8080';

async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [toys, ageGroups, toyTypes] = await Promise.all([
    fetchJSON<Toy[]>('/api/toys'),
    fetchJSON<AgeGroup[]>('/api/toys/age-groups'),
    fetchJSON<ToyType[]>('/api/toys/types'),
  ]);

  const cookieStore = await cookies();
  const hasToken = cookieStore.has('access_token');

  return (
    <main>
      <HeroSection />
      <CategoryBar types={toyTypes ?? []} />
      <FeaturedToys toys={toys ?? []} isAuthenticated={hasToken} />
      <AgeGroupSection ageGroups={ageGroups ?? []} />
      <TrustBanner />
    </main>
  );
}
