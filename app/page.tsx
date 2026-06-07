import { Logo } from '@/components/logo';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <Logo className="h-16 w-16 text-accent" />
      <h1 className="text-4xl font-semibold tracking-tight text-fg sm:text-5xl">Botio</h1>
      <p className="max-w-md text-base text-fg-muted">WhatsApp AI for your business.</p>
    </main>
  );
}
