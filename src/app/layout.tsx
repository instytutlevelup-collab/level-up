import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import UserNavLinks from '@/components/ui/UserNavLinks'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Instytut Wiedzy Level Up! - Twój upgrade do lepszych wyników',
  description:
    'Aplikacja do rezerwacji terminów korepetycji z możliwością powiązania kont ucznia i rodzica',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="google-site-verification" content="UH8aYObvEClynXamDs_ymWeIoAkrqIefLJ-g9_mS5f8" />
      </head>
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Instytut Wiedzy &quot;Level Up!&quot;</h1>
              </div>
              <div>
                <div className="ml-10 flex space-x-4 overflow-x-auto no-scrollbar">
                  <UserNavLinks />
                </div>
              </div>
            </div>
          </nav>
        </header>
        <main className="flex-1 w-full bg-gray-50 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</main>
        <footer className="bg-white border-t border-gray-200">
          <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <p className="text-center text-gray-500 text-sm">
              © 2025 Instytut Wiedzy &quot;Level Up!&quot;. E-dziennik dla szkoły korepetycji.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}