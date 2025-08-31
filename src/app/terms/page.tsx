"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <Card className="max-w-3xl mx-auto p-6 text-gray-800">
      <CardContent>
        <h1 className="text-2xl font-bold mb-6 text-center">
          Regulamin zajęć dydaktycznych
        </h1>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">§1. Postanowienia ogólne</h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Zapisu na zajęcia osób niepełnoletnich dokonuje Rodzic/Opiekun prawny poprzez
              platformę <strong>Instytut Wiedzy Level Up!</strong>, kontakt telefoniczny lub komunikator Messenger.
            </li>
            <li>Podjęcie współpracy jest równoznaczne z akceptacją niniejszego Regulaminu.</li>
            <li>Rażące naruszenie postanowień Regulaminu może skutkować zakończeniem współpracy.</li>
            <li>
              Terminy zajęć należy rezerwować w trzech okresach: wrzesień, od października do ferii zimowych oraz
              od ferii zimowych do końca roku szkolnego.
            </li>
            <li>
              Zajęcia mogą odbywać się:
              <ul className="list-disc list-inside ml-6">
                <li>indywidualnie lub grupowo,</li>
                <li>stacjonarnie, online lub w formie hybrydowej.</li>
              </ul>
            </li>
            <li>Czas trwania lekcji ustalany jest indywidualnie i wynosi 60, 90 lub 120 minut.</li>
          </ol>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">§2. Organizacja zajęć</h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              W przypadku choroby Ucznia Rodzic/Opiekun zobowiązany jest poinformować Korepetytora.
              Wówczas zajęcia odbywają się w formie online.
            </li>
            <li>
              Korepetytor zastrzega sobie prawo do zmiany stałego terminu zajęć, jeśli będzie on
              kolidował z jego obowiązkami dydaktycznymi.
            </li>
            <li>
              Rodzic/Opiekun, zapisując dziecko na zajęcia, zobowiązuje się dopilnować obecności
              Ucznia w ustalonym terminie.
            </li>
            <li>
              Uczeń powinien posiadać własne przybory (m.in. zeszyt, długopis, kalkulator — jeśli wymagany).
            </li>
            <li>
              Uczeń i Korepetytor zobowiązani są do punktualności:
              <ul className="list-disc list-inside ml-6">
                <li>Spóźnienie Ucznia nie powoduje wydłużenia zajęć ani zmniejszenia opłaty.</li>
                <li>W przypadku spóźnienia Korepetytora lekcja zostaje odpowiednio wydłużona lub odrobiona w innym terminie.</li>
              </ul>
            </li>
            <li>Odpowiedzialność Korepetytora ogranicza się wyłącznie do czasu trwania zajęć.</li>
            <li>
              Rodzic/Opiekun może wyrazić zgodę na bezpośredni kontakt Ucznia z Korepetytorem
              w sprawach ustaleń terminów. Zgoda ta może być udzielona w formie pisemnej
              albo poprzez samodzielne nadanie Uczniowi odpowiednich uprawnień na platformie
              <strong> Instytut Wiedzy Level Up!</strong>.
            </li>
          </ol>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">§3. Odwołanie zajęć</h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Rodzic/Opiekun zobowiązany jest powiadomić Korepetytora o nieobecności Ucznia co najmniej 24 godziny przed zajęciami.
            </li>
            <li>
              Odwołania można dokonać poprzez platformę <strong>Instytut Wiedzy Level Up!</strong>, telefonicznie lub za pośrednictwem Messengera.
            </li>
            <li>
              Zajęcia odwołane z zachowaniem 24-godzinnego terminu mogą zostać odrobione w innym, wspólnie ustalonym czasie.
            </li>
            <li>
              W przypadku braku powiadomienia w wymaganym terminie zajęcia uznaje się za zrealizowane,
              a opłata za nie nie podlega zwrotowi.
            </li>
            <li>
              Korepetytor zobowiązuje się poinformować Rodzica/Opiekuna o sytuacjach wyjątkowych
              uniemożliwiających przeprowadzenie zajęć i zaproponować termin zastępczy.
            </li>
          </ol>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">§4. Płatności</h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Opłata za zajęcia dokonywana jest w formie przedpłaty za cały miesiąc,
              najpóźniej przed pierwszymi zajęciami danego miesiąca.
            </li>
            <li>
              Zajęcia pozaprogramowe, tj. realizowane poza ustalonym harmonogramem,
              podlegają rozliczeniu w dniu ich przeprowadzenia.
            </li>
            <li>
              W przypadku braku wpłaty Korepetytor jest uprawniony do wstrzymania realizacji zajęć.
            </li>
            <li>
              Korepetytor zastrzega sobie prawo do zmiany cennika z co najmniej dwutygodniowym wyprzedzeniem.
            </li>
          </ol>
        </section>
      </CardContent>
    </Card>
  );
}