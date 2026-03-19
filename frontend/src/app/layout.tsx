import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '600', '700'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Prodavnica igračaka',
  description: 'Kvalitetne igračke za svako dete',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr">
      <body className={`${dmSans.variable} ${playfair.variable} min-h-screen flex flex-col`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <Navbar />
            <div className="flex-grow">{children}</div>
            <Toaster position="top-right" richColors />
            <footer className="bg-muted border-t border-border">
              <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <p className="text-center text-muted-foreground font-sans text-sm">
                  © 2026 Prodavnica igračaka. Sva prava zadržana.
                </p>
              </div>
            </footer>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
