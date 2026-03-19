export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-foreground">404</h1>
      <p className="text-muted-foreground mt-2">Stranica nije pronađena</p>
      <a href="/" className="mt-4 text-primary hover:underline">
        Nazad na početnu
      </a>
    </div>
  );
}
