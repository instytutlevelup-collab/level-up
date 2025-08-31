import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function PrivacyPage() {
  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Polityka prywatności i RODO</CardTitle>
          <CardDescription>Informacje o przetwarzaniu danych osobowych w aplikacji</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <section>
            <h2 className="font-semibold text-lg">1. Administrator danych</h2>
            <p>
              Administratorem danych osobowych jest <strong>Wiktoria Pająk</strong>, ul. Pogoni Lwów 8, 32-040 Ochojno, e-mail: <a href="mailto:instytut.leveup@gmail.com">instytut.leveup@gmail.com</a>. Dane są przetwarzane w ramach działalności <strong>Instytut Wiedzy Level Up!</strong> (działalność nierejestrowana).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-lg">2. Jakie dane zbieramy</h2>
            <p>Zbieramy dane:</p>
            <ul className="list-disc ml-6">
              <li>dane rodzica (imię, nazwisko, adres e-mail)</li>
              <li>dane dziecka (imię, nazwisko, poziom edukacji)</li>
              <li>dane techniczne (adres IP, informacje o logowaniu)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-lg">3. Cel i podstawa prawna przetwarzania</h2>
            <p>Dane przetwarzamy w celu:</p>
            <ul className="list-disc ml-6">
              <li>założenia i obsługi konta ucznia w systemie</li>
              <li>umożliwienia rezerwacji i odwoływania zajęć</li>
              <li>kontaktowania się z użytkownikiem w sprawach związanych z usługą</li>
            </ul>
            <p>Podstawą prawną przetwarzania jest zgoda rodzica (art. 6 ust. 1 lit. a RODO) oraz konieczność realizacji usługi (art. 6 ust. 1 lit. b RODO).</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg">4. Odbiorcy danych</h2>
            <p>Dane mogą być przetwarzane przez dostawców usług IT, w tym <strong>Google (Firebase)</strong>, którzy działają na nasze zlecenie. Dane nie są przekazywane innym podmiotom bez zgody, chyba że wymaga tego prawo.</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg">5. Czas przechowywania</h2>
            <p>Dane przechowujemy tak długo, jak aktywne jest konto w systemie. Po usunięciu konta dane są kasowane, z wyjątkiem sytuacji wymaganych przepisami prawa.</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg">6. Prawa użytkownika</h2>
            <p>Każdy rodzic ma prawo do:</p>
            <ul className="list-disc ml-6">
              <li>dostępu do danych</li>
              <li>sprostowania danych</li>
              <li>usunięcia danych</li>
              <li>ograniczenia przetwarzania</li>
              <li>przeniesienia danych</li>
              <li>wycofania zgody w dowolnym momencie</li>
              <li>wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-lg">7. Dobrowolność podania danych</h2>
            <p>Podanie danych jest dobrowolne, ale niezbędne do korzystania z aplikacji.</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg">8. Kontakt</h2>
            <p>W sprawach dotyczących danych osobowych prosimy kontaktować się pod adresem: <a href="mailto:instytut.leveup@gmail.com">instytut.leveup@gmail.com</a>.</p>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}