#!/bin/bash
# Podwójne kliknięcie w Finderze uruchamia lokalny serwer Adaira i zostawia go
# działającego w tle — to okno można potem zamknąć, serwer dalej działa.
# Jeśli serwer już działał ze starym .env, ten skrypt go najpierw zatrzymuje,
# żeby na pewno wystartował z aktualnymi kluczami.
cd "$(dirname "$0")" || exit 1

echo "=================================================="
echo " Adair — uruchamianie serwera"
echo "=================================================="
echo

./scripts/dev-up.sh --restart
status=$?

if [ $status -eq 0 ]; then
  echo
  echo "Otwieram przeglądarkę…"
  open "http://localhost:8080/de/assistant"
  echo
  echo "Serwer działa. To okno możesz zamknąć — serwer zostanie uruchomiony."
else
  echo
  echo "Coś poszło nie tak — zobacz dev.log w tym folderze albo wyślij mi to,"
  echo "co widzisz powyżej."
fi

echo
read -r -p "Naciśnij Enter, aby zamknąć to okno… "
