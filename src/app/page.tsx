'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import ReviewsSection from "@/components/ReviewsSection";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 px-4 py-10 flex flex-col items-center justify-between">
      <div className="w-full flex flex-col items-center">
        {/* Główna sekcja powitalna */}
        <div className="max-w-3xl w-full text-center p-8 bg-white shadow-xl rounded-3xl mb-12">
          <h1 className="text-4xl font-extrabold text-gray-800 mb-4">
            Wiedza to Twój game changer🎓
          </h1>

          <p className="text-gray-600 text-lg mb-8">
            Zrób pierwszy krok w stronę lepszych wyników! Dołącz do naszej społeczności i zdobywaj wiedzę świadomie. Oferujemy wsparcie, rozwój i realne efekty.
          </p>

          <div className="flex justify-center gap-4">
            <Link href="/auth/login">
              <Button className="px-6 py-3 text-base">Zaloguj się</Button>
            </Link>

            <Link href="/auth/register">
              <Button variant="outline" className="px-6 py-3 text-base">Zarejestruj się</Button>
            </Link>
          </div>
        </div>

        {/* Sekcja z trzema kartami */}
        <section className="w-full max-w-5xl mb-12">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">📅 Zaplanuj zajęcia od września – miejsca już dostępne!</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <h3 className="text-xl font-semibold text-blue-700 mb-2">Zajęcia indywidualne</h3>
              <p className="text-gray-600">
                Oferujemy zajęcia stacjonarne oraz online. Program i tempo prowadzenia zajęć dostosowujemy indywidualnie do potrzeb każdego ucznia.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <h3 className="text-xl font-semibold text-purple-700 mb-2">Zajęcia grupowe</h3>
              <p className="text-gray-600">
                Wolisz uczyć się w grupie? W naszych kameralnych zespołach powtórzysz materiał, nadrobisz zaległości i poznasz nowych ludzi.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <h3 className="text-xl font-semibold text-pink-700 mb-2">Przygotowanie do egzaminu ósmoklasisty i matury</h3>
              <p className="text-gray-600">
                Egzaminy potrafią być stresujące, ale dzięki naszej pomocy nawet maturalne rozszerzenia nie sprawią Ci problemu.
              </p>
            </div>
          </div>
        </section>
        
        <ReviewsSection />
      </div>

      {/* Stopka z kontaktem i regulaminem */}
      <footer className="w-full max-w-5xl mt-16 py-6 border-t border-gray-300 text-center text-sm text-gray-600 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p>Skontaktuj się z nami!</p>
        <div className="flex items-center gap-50">
          <span>📞 Tel. 784 845 209</span>
          <Link href="/terms" className="px-6 py-3 text-base">
            Regulamin
          </Link>
        </div>
      </footer>
    </main>
  )
}