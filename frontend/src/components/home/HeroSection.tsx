import Link from 'next/link';

const showcaseCards = [
  { emoji: '🧩', label: 'Slagalice', href: '/toys?type=Slagalica' },
  { emoji: '🚗', label: 'Vozila', href: '/toys?type=Vozilo' },
  { emoji: '🎨', label: 'Kreativne', href: `/toys?type=${encodeURIComponent('Kreativni set')}` },
  { emoji: '🧸', label: 'Plišane', href: `/toys?type=${encodeURIComponent('Plišana igračka')}` },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-brand-bg dot-grid min-h-[560px] flex items-center">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-sage/80 via-transparent to-brand-surface/60 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="max-w-2xl">
          {/* Eyebrow */}
          <p className="font-sans text-brand-accent font-semibold text-sm uppercase tracking-widest mb-4 animate-fade-in-up">
            Pažljivo birane igračke
          </p>

          {/* Headline */}
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-foreground leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
            Igračke koje<br />
            <span className="text-brand-primary">inspirišu</span> i<br />
            razvijaju
          </h1>

          {/* Subline */}
          <p className="font-sans text-muted-foreground text-lg leading-relaxed mb-8 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
            Pronađite savršenu igračku za svaki uzrast — od prvih koraka do školskih dana.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
            <Link
              href="/toys"
              className="inline-flex items-center gap-2 bg-brand-primary text-white font-sans font-semibold px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
            >
              Istraži kolekciju →
            </Link>
<Link
               href="/toys?ageGroup=0-2"
               className="inline-flex items-center gap-2 border border-brand-primary text-brand-primary font-sans font-semibold px-6 py-3 rounded-full hover:bg-brand-sage transition-colors"
             >
               Pokloni za bebe
             </Link>
          </div>
        </div>

        {/* Showcase cards */}
        <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl">
          {showcaseCards.map((card, i) => (
            <Link
              key={card.label}
              href={card.href}
              className="group flex flex-col items-center gap-2 bg-card/70 backdrop-blur-sm border border-border rounded-2xl p-4 hover:border-brand-primary hover:shadow-md transition-all animate-fade-in-up"
              style={{ animationDelay: `${320 + i * 60}ms` }}
            >
              <span className="text-3xl">{card.emoji}</span>
              <span className="font-sans text-xs font-semibold text-foreground group-hover:text-brand-primary transition-colors">
                {card.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
