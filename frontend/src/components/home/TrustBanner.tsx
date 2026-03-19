const signals = [
  { icon: '🚚', title: 'Besplatna dostava', subtitle: 'za narudžbine preko 3.000 RSD' },
  { icon: '🔒', title: 'Sigurno plaćanje', subtitle: 'SSL zaštita i Stripe' },
  { icon: '↩️', title: 'Povrat u 30 dana', subtitle: 'bez pitanja' },
  { icon: '🌱', title: 'Ekološki materijali', subtitle: 'sertifikovane igračke' },
];

export function TrustBanner() {
  return (
    <section className="bg-[#2D5016] py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {signals.map((s) => (
            <div key={s.title} className="flex flex-col items-center text-center gap-2">
              <span className="text-3xl" aria-hidden="true">{s.icon}</span>
              <p className="text-white font-sans font-semibold text-sm">{s.title}</p>
              <p className="text-white/70 font-sans text-xs">{s.subtitle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
