import { Inter, JetBrains_Mono } from 'next/font/google';

const kySans = Inter({
  subsets: ['latin'],
  variable: '--font-ky-sans',
  weight: ['400', '500', '600'],
  display: 'swap',
});

const kyMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-ky-mono',
  weight: ['400', '500'],
  display: 'swap',
});

export default function EmailingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${kySans.variable} ${kyMono.variable}`}>{children}</div>
  );
}
