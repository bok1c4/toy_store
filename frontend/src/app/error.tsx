'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-foreground">Nešto je pošlo naopako</h1>
      <p className="text-muted-foreground mt-2">Došlo je do neočekivane greške.</p>
      <Button
        onClick={reset}
        className="mt-4"
      >
        Pokušaj ponovo
      </Button>
    </div>
  );
}
