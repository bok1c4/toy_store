import Link from 'next/link';
import type { AgeGroup } from '@/lib/types';

const ageEmojis: Record<string, string> = {
  '0-2': '👶',
  '3-5': '🧒',
  '6-9': '🧑',
  '10+': '🎓',
};

const ageDescriptions: Record<string, string> = {
  '0-2': 'Senzorne igračke, metuljci, grizalice i prve knjige za radoznale bebe.',
  '3-5': 'Konstruktori, figurice i igre uloga koje razvijaju maštu.',
  '6-9': 'Slagalice, naučni setovi i sportska oprema za aktivnu decu.',
  '10+': 'Kompleksne igre, robotika i kreativni setovi za mlade istraživače.',
};

interface AgeGroupSectionProps {
  ageGroups: AgeGroup[];
}

export function AgeGroupSection({ ageGroups }: AgeGroupSectionProps) {
  if (ageGroups.length === 0) return null;

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="font-sans text-brand-accent font-semibold text-xs uppercase tracking-widest mb-2">
            Po uzrastu
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
            Pronađite pravo za svako dete
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ageGroups.map((ag) => {
            const emoji = ageEmojis[ag.name] ?? '🎁';
            const desc = ageDescriptions[ag.name] ?? ag.description;
            return (
              <Link
                key={ag.ageGroupId}
                href={`/toys?ageGroup=${ag.ageGroupId}`}
                className="group flex flex-col items-center text-center gap-3 bg-card border border-border rounded-2xl p-6 hover:border-brand-primary hover:shadow-md transition-all"
              >
                <span className="text-4xl">{emoji}</span>
                <p className="font-display text-xl font-bold text-foreground group-hover:text-brand-primary transition-colors">
                  {ag.name} god.
                </p>
                <p className="font-sans text-sm text-muted-foreground leading-relaxed">{desc}</p>
                <span className="font-sans text-xs font-semibold text-brand-primary mt-1">
                  Pogledaj →
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
