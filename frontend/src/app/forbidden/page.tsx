export default function Forbidden() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-foreground">403</h1>
      <p className="text-muted-foreground mt-2">
        Nemate pristup ovoj stranici
      </p>
      <a href="/" className="mt-4 text-primary hover:underline">
        Nazad na početnu
      </a>
    </div>
  );
}
