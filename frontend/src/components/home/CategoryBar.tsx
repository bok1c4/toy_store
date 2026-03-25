import Link from 'next/link';
import type { ToyType } from '@/lib/types';

const typeEmojis: Record<string, string> = {
  Slagalica: '🧩',
  Vozilo: '🚗',
  Lutka: '🪆',
  Konstrukcija: '🏗️',
  Sport: '⚽',
  Muzika: '🎵',
  Kreativnost: '🎨',
  Nauka: '🔬',
  Plišana: '🧸',
  Igra: '🎲',
};

interface CategoryBarProps {
  types: ToyType[];
}

export function CategoryBar({ types }: CategoryBarProps) {
  if (types.length === 0) return null;

  return (
    <section className="bg-card border-b border-border py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          <Link
            href="/toys"
            className="flex-shrink-0 inline-flex items-center gap-1.5 font-sans text-sm font-medium px-4 py-2 rounded-full border border-brand-primary text-brand-primary bg-brand-sage hover:opacity-80 transition-opacity whitespace-nowrap"
          >
            🏪 Sve igračke
          </Link>
          {types.map((t) => {
            const emoji = typeEmojis[t.name] ?? '🎁';
            return (
              <Link
                key={t.typeId}
                href={`/toys?type=${encodeURIComponent(t.name)}`}
                className="flex-shrink-0 inline-flex items-center gap-1.5 font-sans text-sm font-medium px-4 py-2 rounded-full border border-border text-foreground hover:border-brand-primary hover:text-brand-primary hover:bg-brand-sage transition-colors whitespace-nowrap"
              >
                {emoji} {t.name}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
