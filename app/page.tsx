import { Logo } from '@/components/logo';

export default function HomePage() {
  return (
    <main className="bg-gradient-glow flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo className="text-accent h-20 w-20" />
      <h1 className="bg-gradient-brand bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
        Botio
      </h1>
      <p className="text-fg-muted max-w-md text-lg">WhatsApp AI for your business.</p>
    </main>
  );
}
