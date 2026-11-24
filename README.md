# Korepetycje – wersja na telefon (PWA)

Aplikacja działa w przeglądarce telefonu i instaluje się na ekranie głównym jak zwykła aplikacja.
Dane są w tej samej bazie Supabase co program na komputerze – zmiany widać od razu w obu miejscach.

## Co jest w środku
Wszystkie pliki leżą w jednym folderze (tak samo jak w repozytorium na GitHub Pages):
- `index.html`, `app.css` – wygląd (motyw ciemny / jasny jak w telefonie),
- `app.js` – ekrany: Kalendarz, Uczniowie, Rozliczenia (rachunki, PDF), Wydatki z dojazdami, Limity, Podsumowanie, Ustawienia,
- `logika.js` – obliczenia (saldo, nadpłaty, limity, rachunek, dojazdy) – takie same jak na komputerze
  (sprawdza to `python -m unittest tests.test_zgodnosc` w folderze programu),
- `konfiguracja.js` – adres bazy i klucz publiczny Supabase,
- `supabase.js` – biblioteka Supabase (wersja 2, dołączona, bez pobierania z internetu),
- `manifest.webmanifest`, `sw.js`, `ikona-*.png` – to, co pozwala zainstalować stronę jako aplikację.

## Umieszczenie w internecie i aktualizacja (GitHub Pages)
Pierwsze wgranie i ustawienia Pages: [WDROZENIE.md](../WDROZENIE.md), punkt B.5.

Aktualizacja: w repozytorium **Add file → Upload files**, przeciągnij **wszystkie pliki** z tego folderu (nadpiszą
stare) → **Commit changes**. Przy każdej zmianie podnieś w `sw.js` numer w `const WERSJA = "korepetycje-v…"`,
żeby telefon na pewno pobrał nową wersję. Jeśli zmieniła się baza w chmurze, najpierw uruchom skrypt SQL
(WDROZENIE.md, punkt A).

Uwaga: repozytorium publiczne oznacza, że kod aplikacji jest widoczny. Dane nie – są w Supabase i chroni je
logowanie (klucz w `konfiguracja.js` jest publiczny z założenia).

## Instalacja na telefonie (Android, Chrome)
1. Otwórz adres aplikacji w Chrome.
2. Zaloguj się tym samym e-mailem i hasłem co w programie na komputerze.
3. Menu ⋮ → **Zainstaluj aplikację** (albo **Dodaj do ekranu głównego**).

## Test na komputerze
W folderze `apk_telefon`: `python -m http.server 8000`, potem w przeglądarce http://localhost:8000.
