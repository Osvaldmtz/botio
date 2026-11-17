import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

export default function EmailingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable}`}>{children}</div>
  );
}
