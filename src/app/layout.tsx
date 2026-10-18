import type { Metadata } from 'next';
import './globals.css';
import SandboxToolbar from '@/components/SandboxToolbar';

export const metadata: Metadata = {
  title: "College GameDay Pick'em",
  description: 'Weekly College Football Pick’em & Pixel Art Broadcast Booth',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090e17] text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
        {children}
        <SandboxToolbar />
      </body>
    </html>
  );
}
