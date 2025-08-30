"use client"

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Regulamin</h1>
      
      <section>
        <h2 className="text-xl font-semibold mb-2">POSTANOWIENIA OGÓLNE</h2>
        <ol className="list-decimal list-inside space-y-1 text-gray-700">
          <li>Zapisu na korepetycje osób niepełnoletnich dokonuje Rodzic lub Opiekun prawny poprzez platformę Instytut Wiedzy Level Up!, kontakt telefoniczny lub za pośrednictwem platformy Messenger.</li>
          <li>Podjęcie współpracy jest równoznaczne z akceptacją niniejszego regulaminu przez wszystkie strony. Nieprzestrzeganie regulaminu może skutkować skreśleniem Ucznia z listy.</li>
          <li>W każdym semestrze obowiązuje nowa rezerwacja terminu.</li>
          <li>Zajęcia odbywają się w formie indywidualnej lub grupowej w formie stacjonarnej, zdalnej lub hybrydowej. Czas trwania lekcji wynosi: 60, 90 lub 120 minut, w zależności od wcześniejszego ustalenia.</li>
          <li>W razie przeziębienia dziecka konieczne jest powiadomienie korepetytora. Zajęcia odbywają się wówczas online.</li>
          <li>Korepetytor zastrzega sobie prawo do zmiany ustalonego na stałe terminu, jeżeli będzie on kolidował z wykładami Korepetytora.</li>
          <li>Rodzic lub Opiekun, zapisując dziecko na korepetycje zobowiązuje się dopilnować, aby uczęszczało ono na zajęcia w ustalonym wcześniej terminie przez obie strony (Korepetytora oraz Rodzica lub Opiekuna).</li>
          <li>Podczas zajęć Uczeń zobowiązany jest posiadać własne przybory.</li>
          <li>Uczeń i Korepetytor powinni punktualnie stawiać się na lekcje. W przypadku spóźnienia Ucznia, lekcja nie ulega przedłużeniu a opłata należna za lekcję nie ulega zmianie. W przypadku opóźnienia w rozpoczęciu zajęć z powodów leżących po stronie Korepetytora, zajęcia ulegają wydłużeniu o czas spóźnienia bądź ustala się inny termin, dogodny dla obu stron, kiedy spóźnienie można odrobić.</li>
          <li>Korepetytor nie odpowiada za Ucznia po zakończonej lekcji oraz przed jej rozpoczęciem.</li>
          <li>Rodzic lub Opiekun ma prawo do udzielenia pisemnej zgody na bezpośredni kontakt Ucznia z Korepetytorem w celu ustalenia, zmiany oraz odwołania terminów zajęć.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">ODWOŁANIE ZAJĘĆ</h2>
        <ol className="list-decimal list-inside space-y-1 text-gray-700">
          <li>Rodzic lub Opiekun jest zobowiązany powiadomić Korepetytora o nieobecności Ucznia co najmniej 24 godziny przed planowanymi zajęciami. Lekcje odwołuje się poprzez patformę Instytut Wiedzy Level Up!, kontakt telefoniczny lub za pośrednictwem platformy Messenger.</li>
          <li>Jeżeli Rodzic lub Opiekun nie powiadomi Korepetytora o nieobecności dziecka 24 godziny przed zajęciami, lekcję uważa się za zrealizowaną i pobierana jest za nią pełna opłata.</li>
          <li>Zajęcia odwołane z co najmniej 24 godzinnym wyprzedzeniem można odrobić w innym dogodnym terminie ustalonym przez obie strony. W przeciwnym razie Rodzic lub Opiekun zobowiązany jest do uiszczenia opłaty za kolejny miesiąc, pomniejszonej o ilość nieodrobionych lekcji.</li>
          <li>Korepetytor zobowiązuje się powiadomić Rodzica lub Opiekuna Ucznia o ewentualnych sytuacjach wyjątkowych, w których odbycie się zajęć jest niemożliwe oraz zaproponować termin zastępczy.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">PŁATNOŚĆ</h2>
        <ol className="list-decimal list-inside space-y-1 text-gray-700">
          <li>Obowiązuje regulowanie zobowiązań przedpłatą za zajęcia w całym miesiącu przed pierwszymi zajęciami każdego miesiąca.</li>
          <li>W przypadku nieuiszczenia opłaty Korepetytor ma prawo nie wpuścić Ucznia na zajęcia, na które został zapisany.</li>
          <li>Korepetytor zastrzega sobie prawo do zmian cennika w dowolnej chwili i o tym fakcie każdorazowo poinformuje Rodzica lub Opiekuna Ucznia.</li>
        </ol>
      </section>
    </div>
  )
}