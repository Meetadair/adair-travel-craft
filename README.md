# Adair: Your Journey, Simplified

Zbuduj landing page / interaktywny koncept produktu "Adair Travel" — AI asystenta podróży, który w jednym oknie czatu składa całą podróż (lot + hotel + samochód) w jedną kartę do rezerwacji, zamiast żeby klient musiał używać 5 różnych appek (Skyscanner, Booking.com, wypożyczalnia, Uber, OpenTable).

STYL WIZUALNY — bardzo ważne, ma być MINIMALNY, nie kolorowy:
- Jeden akcent koloru: koralowy/terakota (#E8623F), używany rzadko, tylko na cenach i głównych akcjach
- Tło: ciepły kremowy/biały (#FBF8F2), bez gradientów
- Typografia: nagłówki "Bricolage Grotesque" (charakterny, nowoczesny grotesk), tekst "Plus Jakarta Sans"
- Dużo białej przestrzeni, cienkie linie/obramowania (nie ciężkie cienie), zaokrąglone rogi ~12px
- Nastrój: świeży, ciepły, ale spokojny i elegancki — NIE korporacyjny/poważny, ale też NIE krzykliwy/festiwalowy

STRUKTURA STRONY:
1. Hero: nagłówek "Jedna prośba. Cała podróż." + krótki opis
2. Sekcja porównania: "Bez Adaira" (lista rozproszonych appek) vs "Z Adairem" (jedno okno)
3. Demo rozmowy czatowej: użytkownik pisze "Muszę być w Mediolanie w czwartek rano, wracam w piątek wieczorem, coś blisko Duomo i auto na miejscu" → Adair odpowiada jedną kartą podróży z: lotem (LOT 391, oznaczony tagiem "Duffel · NDC"), hotelem (Park Hyatt Milano, oznaczony tagiem "Adair Direct" — bo to własna negocjowana stawka), samochodem (BMW serii 3, tag "Duffel") — łączna cena 1240€, przycisk "Zarezerwuj całość"
4. Sekcja "Moje podróże" — trzy karty: lot, hotel, samochód, każda z numerem rezerwacji/potwierdzeniem
5. Sekcja "Profil podróży" — pokazująca, że użytkownik ustawia raz precyzyjne preferencje (linie lotnicze, klasa, miejsce, sieci hotelowe, dieta, budżet) i każda kolejna podróż automatycznie je respektuje
6. Trzy zasady na dole: "Jedna podróż nie trzy rezerwacje", "Cena jakiej inni nie mają" (bo hotel po własnej negocjowanej stawce, nie z Booking.com), "Jedno miejsce po rezerwacji"

To jest koncept/prototyp wizualny do przeglądu przez założycieli, nie finalny produkt z realnym backendem — statyczne dane przykładowe są ok.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://adair-travel-craft.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/69640f0d-800f-4e09-bf6e-05a1a89dab74).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
