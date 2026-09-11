# Adair for Business — oferta dla firm i zespołów

Nowa strona ofertowa dla firm z poglądowym pulpitem firmowym (dane przykładowe), utrzymana dokładnie w obecnym stylu: kremowe tło, jeden koralowy akcent, cienkie linie, zaokrąglenia ~12 px.

## Co powstanie

**Nowa strona `/business`** (oraz `/<język>/business` dla wszystkich 14 języków), z sekcjami:

1. **Hero** — „Cała podróż zespołu w jednym oknie." Krótki opis + przycisk „Porozmawiajmy o Twoim zespole" (formularz zapytania).
2. **Trzy role** — kto z tego korzysta i co dostaje:
   - Asystentka / office manager: rezerwuje dla innych, wspólna skrzynka podróży, jedna faktura VAT.
   - Manager / finanse: limity, akceptacje, wgląd w koszty.
   - Podróżny: własny profil preferencji, jedna karta podróży.
3. **Koszty i budżety** — limity na podróż / osobę / miesiąc, polityka podróżna, próg akceptacji managera. Pokazane jako karty z przykładowymi wartościami.
4. **Poglądowy pulpit firmowy** — jeden panel z danymi przykładowymi: wykorzystanie budżetu miesięcznego, lista ostatnich podróży zespołu ze statusem (opłacona / do akceptacji), wydatki po osobach i po kierunkach, oszczędność vs. stawki publiczne. Wyraźna adnotacja „Widok poglądowy — dane przykładowe".
5. **Analizy podróżne** — co firma dostaje w raporcie: koszt na osobę, najczęstsze trasy, średnia cena noclegu, zgodność z polityką, gotowe zestawienie do księgowości.
6. **Pakiety** — Starter / Teams / Enterprise, każdy z listą funkcji i przyciskiem „Wycena na zapytanie" (bez cen).
7. **Formularz zapytania** — e-mail firmowy, nazwa firmy, wielkość zespołu, opcjonalna wiadomość. Zapis do istniejącej listy zgłoszeń jako typ `business`.

**Nawigacja** — nowa pozycja „Dla firm" w górnym pasku, obok „Assistant".

**Strona główna** — istniejący blok „Adair for Teams" zyskuje link do nowej strony `/business` zamiast tylko formularza waitlisty; sam blok i jego wygląd pozostają.

## Czego nie robimy teraz

- Bez realnych kont firmowych, zaproszeń członków zespołu i prawdziwych budżetów w bazie — pulpit jest poglądowy.
- Bez płatności i rezerwacji (zgodnie z ustaleniem: dopiero po ~1000 aktywnych kont).
- Bez zmian w obecnym systemie wizualnym.

## Szczegóły techniczne

- Trasy: `src/routes/business.tsx` (EN, `/business`) + `src/routes/$lang.business.tsx`, obie renderujące wspólny `src/pages/business.tsx`. Własny `head()` z unikalnym title/description/OG przez `pageMeta`.
- `SitePath` w `src/lib/i18n/index.tsx` i lista `known` w przełączniku języka w `src/components/site-nav.tsx` rozszerzone o `/business`.
- Cała nowa treść dodana do `src/lib/i18n/locales/en.ts` w bloku `business`, następnie regeneracja 13 plików JSON przez `scripts/translate-i18n.ts`.
- Formularz: rozszerzenie `joinSchema` w `src/lib/waitlist.functions.ts` o typ `business` i opcjonalne pola `company` / `teamSize` (zapisywane w istniejącej kolumnie `sentence` jako jedna linia tekstu, bez migracji bazy).
- Dane pulpitu: stałe w `src/pages/business.tsx`, liczby jako proste paski i listy — bez biblioteki wykresów.
- Mobile first, sprawdzenie przy 390 px, respektowanie `prefers-reduced-motion`, typecheck. Bez publikacji.
