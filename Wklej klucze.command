#!/bin/bash
# Podwójne kliknięcie w Finderze otwiera to okno i pyta o klucze po kolei.
# Klucz nie pojawia się na ekranie i nie trafia do historii poleceń — wpisuje
# się prosto do pliku .env, który leży obok tego skryptu i nigdy nie idzie na
# GitHuba. Pole można zostawić puste: wtedy ta pozycja zostaje bez zmian.
cd "$(dirname "$0")" || exit 1
ENV=".env"
[ -f "$ENV" ] || { echo "Nie znalazłem pliku .env obok tego skryptu."; read -r; exit 1; }

set_key() {
  local name="$1" label="$2" value
  printf "\n%s\n" "$label"
  printf "Wklej i naciśnij Enter (Enter bez wklejania = pomiń): "
  read -rs value
  printf "\n"
  [ -z "$value" ] && { echo "  pominięte"; return; }
  # Usuwa spacje i cudzysłowy, które łatwo skopiować razem z kluczem.
  value="$(printf '%s' "$value" | tr -d '"'"'"' \t\r\n')"
  if grep -q "^${name}=" "$ENV"; then
    /usr/bin/sed -i '' "s|^${name}=.*|${name}=${value}|" "$ENV"
  else
    printf '\n%s=%s\n' "$name" "$value" >> "$ENV"
  fi
  echo "  zapisane (${#value} znaków, zaczyna się od ${value:0:5}…)"
}

echo "=================================================="
echo " Adair — zapisywanie kluczy"
echo "=================================================="
set_key "LITEAPI_KEY"        "1/2  Klucz liteAPI  (dashboard.liteapi.travel/developer — wersja sandbox, zaczyna się od sand_)"
set_key "DUFFEL_TEST_API_KEY" "2/2  Klucz testowy Duffela  (app.duffel.com → Test mode → More → Developers → Access tokens, zaczyna się od duffel_test_)"

echo
echo "Gotowe. Stan pliku:"
for k in LITEAPI_KEY DUFFEL_TEST_API_KEY DUFFEL_API_KEY; do
  v="$(grep -m1 "^${k}=" "$ENV" | cut -d= -f2- | tr -d '"')"
  if [ -n "$v" ]; then echo "  $k — ustawiony (${v:0:5}…)"; else echo "  $k — PUSTY"; fi
done
echo
echo "Możesz zamknąć to okno. Napisz Claude'owi \"gotowe\"."
read -r
