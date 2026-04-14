import { Logo } from '@/components/logo';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-glow px-6 text-center">
      <Logo className="h-20 w-20 text-accent" />
      <h1 className="bg-gradient-brand bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
        Botio
      </h1>
      <p className="max-w-md text-lg text-fg-muted">WhatsApp AI for your business.</p>
    </main>
  );
}
