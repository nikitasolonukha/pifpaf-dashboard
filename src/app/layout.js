import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });

export const metadata = {
  title: 'PifPaf AI — Кабинет блогера',
  description: 'Аналитика Instagram Reels для блогеров PifPaf AI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
