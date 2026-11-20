// Logika aplikacji (bez widoków): formatowanie, daty, numeracja, salda, limity, rachunek, dojazdy.
// Odpowiednik modułów formatowanie.py, obliczenia.py, rachunek.py i dojazdy.py z wersji na komputer.

export const MIESIACE = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień",
  "Październik", "Listopad", "Grudzień"];
export const DNI = ["pon", "wt", "śr", "czw", "pt", "sob", "nd"];
export const STATUSY = { zaplanowana: "Zaplanowana", zrealizowana: "Zrealizowana", rozliczona: "Rozliczona",
  nieobecnosc: "Nieobecność (płatna)", odwolana: "Odwołana" };
export const ROZLICZALNE = ["zrealizowana", "rozliczona", "nieobecnosc"];
export const FORMY = ["gotówka", "przelew", "BLIK", "inna"];
export const RODZAJE = { lekcje: "Za lekcje", przedplata: "Przedpłata" };
const NBSP = " ";

// ---------------------------------------------------------------- kwoty
export function zl(gr, waluta = true) {
  const g = Math.abs(Math.round(gr || 0));
  const s = Math.floor(g / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) + "," + String(g % 100).padStart(2, "0");
  return (gr < 0 ? "−" : "") + s + (waluta ? NBSP + "zł" : "");
}
export function doEdycji(gr) { return zl(gr, false).replace(/ /g, ""); }
export function parsujKwote(t) {
  let s = String(t ?? "").trim().toLowerCase().replace(/zł|pln/g, "").replace(/[\s  ]/g, "").replace("−", "-");
  if (!s) throw new Error("Brak kwoty");
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else s = s.replace(",", ".");
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Niepoprawna kwota: ${t}`);
  return Math.round(parseFloat(s) * 100);
}
export function liczba(t, dom = 0) { const x = parseFloat(String(t ?? "").replace(",", ".")); return isNaN(x) ? dom : x; }
export const km = x => (Math.round(x * 10) / 10).toString().replace(".", ",");
export function odmiana(n, jeden, kilka, wiele) {
  if (n === 1) return jeden;
  if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) return kilka;
  return wiele;
}

// ---------------------------------------------------------------- słownie
const J = ["", "jeden", "dwa", "trzy", "cztery", "pięć", "sześć", "siedem", "osiem", "dziewięć", "dziesięć", "jedenaście",
  "dwanaście", "trzynaście", "czternaście", "piętnaście", "szesnaście", "siedemnaście", "osiemnaście", "dziewiętnaście"];
const DZ = ["", "", "dwadzieścia", "trzydzieści", "czterdzieści", "pięćdziesiąt", "sześćdziesiąt", "siedemdziesiąt",
  "osiemdziesiąt", "dziewięćdziesiąt"];
const S = ["", "sto", "dwieście", "trzysta", "czterysta", "pięćset", "sześćset", "siedemset", "osiemset", "dziewięćset"];
function setki(n) {
  const m = n % 100, cz = [S[Math.floor(n / 100)]];
  if (m < 20) cz.push(J[m]); else cz.push(DZ[Math.floor(m / 10)], J[m % 10]);
  return cz.filter(Boolean).join(" ");
}
export function slownie(n) {
  if (n === 0) return "zero";
  const cz = [];
  for (const [dz, f1, f2, f5] of [[1e6, "milion", "miliony", "milionów"], [1e3, "tysiąc", "tysiące", "tysięcy"]]) {
    const k = Math.floor(n / dz); n %= dz;
    if (k === 1) cz.push(dz === 1e3 ? f1 : "jeden " + f1);
    else if (k) cz.push(setki(k) + " " + odmiana(k, f5, f2, f5));
  }
  if (n) cz.push(setki(n));
  return cz.join(" ");
}
export const kwotaSlownie = gr => `${slownie(Math.floor(Math.abs(gr) / 100))} zł ${String(Math.abs(gr) % 100).padStart(2, "0")}/100`;

// ---------------------------------------------------------------- daty
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const zIso = s => { const [r, m, d] = s.split("-").map(Number); return new Date(r, m - 1, d); };
export const dzis = () => iso(new Date());
export const dodajDni = (s, n) => { const d = zIso(s); d.setDate(d.getDate() + n); return iso(d); };
export const dzienTyg = s => (zIso(s).getDay() + 6) % 7;
export const poczatekTygodnia = s => dodajDni(s, -dzienTyg(s));
export const formatData = s => s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : "";
export const dzienMies = s => `${Number(s.slice(8, 10))}.${s.slice(5, 7)}`;
export const dzienKrotko = s => `${DNI[dzienTyg(s)]} ${dzienMies(s)}`;
export function zakresMiesiaca(r, m) {
  const ost = new Date(r, m, 0).getDate();
  return [`${r}-${String(m).padStart(2, "0")}-01`, `${r}-${String(m).padStart(2, "0")}-${ost}`];
}
export const kwartalZDaty = s => `${s.slice(0, 4)}-Q${Math.floor((Number(s.slice(5, 7)) - 1) / 3) + 1}`;
export function zakresKwartalu(kw) {
  const r = Number(kw.slice(0, 4)), m = (Number(kw.slice(-1)) - 1) * 3 + 1;
  return [zakresMiesiaca(r, m)[0], zakresMiesiaca(r, m + 2)[1]];
}
export const nazwaKwartalu = kw => `${["I", "II", "III", "IV"][Number(kw.slice(-1)) - 1]} kw. ${kw.slice(0, 4)}`;
export const minuty = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const godziny = ls => ls.reduce((s, l) => s + (minuty(l.do) - minuty(l.od)) / 60, 0);
export const formatGodz = h => (Math.round(h * 10) / 10).toString().replace(".", ",") + " h";

// ---------------------------------------------------------------- nazwy, adresy
export const klucz = s => (s || "").trim().toLocaleLowerCase("pl");
export const nazwaUcznia = u => u ? (`${u.imie} ${u.nazwisko || ""}`).trim() || "—" : "—";
export function rozdzielAdres(t) {
  const l = (t || "").split("\n").map(x => x.trim()).filter(Boolean);
  return [l[0] || "", l.slice(1).join(" ")];
}
export const zlozAdres = (ul, kod) => [ul, kod].map(x => (x || "").trim()).filter(Boolean).join("\n");
export function linieAdresu(t) {
  const w = [];
  for (const raw of (t || "").split("\n")) {
    const l = raw.trim(); if (!l) continue;
    const m = l.match(/^(.*?\S)[,\s]+(\d{2}-\d{3}\s+\S.*)$/);
    if (m) w.push(m[1].replace(/,$/, ""), m[2]); else w.push(l);
  }
  return w;
}
export const adresJednaLinia = t => linieAdresu(t).join(", ");

// ---------------------------------------------------------------- numeracja
export function formatujNumer(szablon, n, d, cyfry = 1) {
  let s = String(szablon || "R/{nr}/{mm}/{rrrr}");
  if (!s.toLowerCase().includes("{nr}")) s += "/{nr}";
  const z = { "{nr}": String(n).padStart(Math.max(1, cyfry || 1), "0"), "{mm}": d.slice(5, 7), "{m}": String(Number(d.slice(5, 7))),
    "{rrrr}": d.slice(0, 4), "{rr}": d.slice(2, 4) };
  return s.replace(/\{(nr|mm|m|rrrr|rr)\}/gi, x => z[x.toLowerCase()]);
}
export const kluczNumeracji = (d, od) => od === "year" ? d.slice(0, 4) : d.slice(0, 7);

// ---------------------------------------------------------------- obliczenia na danych (D = magazyn danych)
export const uczniowiePlatnika = (D, p) => D.uczniowie.filter(u => klucz(u.platnik) === klucz(p));
export function platnicy(D) {
  const w = new Map();
  for (const n of [...D.uczniowie.map(u => u.platnik), ...D.wplaty.map(w => w.platnik)]) {
    const t = (n || "").trim(); if (t && !w.has(klucz(t))) w.set(klucz(t), t);
  }
  return [...w.values()].sort((a, b) => a.localeCompare(b, "pl"));
}
export function adresPlatnika(D, p) { const u = uczniowiePlatnika(D, p).find(u => u.adres_platnika); return u ? u.adres_platnika : ""; }
export const lekcjeWplaty = (D, id) => D.wplaty_lekcje.filter(x => x.id_wplaty === id).map(x => x.id_lekcji);

export function saldoPlatnika(D, p, doDnia = null) {
  const ids = new Set(uczniowiePlatnika(D, p).map(u => u.id));
  const nalezne = D.lekcje.filter(l => ids.has(l.id_ucznia) && ROZLICZALNE.includes(l.status) && (!doDnia || l.data <= doDnia))
    .reduce((s, l) => s + l.cena, 0);
  const wplacone = D.wplaty.filter(w => klucz(w.platnik) === klucz(p) && (!doDnia || w.data <= doDnia)).reduce((s, w) => s + w.kwota, 0);
  return { nalezne, wplacone, saldo: wplacone - nalezne };
}
export function nadplata(D, p) {
  const ids = new Set(uczniowiePlatnika(D, p).map(u => u.id));
  const zreal = D.lekcje.filter(l => ids.has(l.id_ucznia) && l.status === "zrealizowana").reduce((s, l) => s + l.cena, 0);
  return Math.max(0, saldoPlatnika(D, p).saldo + zreal);
}
export const oczekujace = (D, doDnia = null) => platnicy(D).reduce((s, p) => s + Math.max(0, -saldoPlatnika(D, p, doDnia).saldo), 0);

export function lekcjeDoRozliczenia(D, p, uwzglednij = []) {
  const ids = new Set(uczniowiePlatnika(D, p).map(u => u.id));
  return D.lekcje.filter(l => ids.has(l.id_ucznia) && (l.status === "zrealizowana" || uwzglednij.includes(l.id)))
    .sort((a, b) => (a.data + a.od).localeCompare(b.data + b.od));
}
export function kwotaRachunku(D, w) {
  const ls = lekcjeWplaty(D, w.id);
  if (w.rodzaj === "przedplata" || !ls.length) return w.kwota;
  return ls.reduce((s, id) => s + (D.lekcje.find(l => l.id === id)?.cena || 0), 0);
}
export function wplatyWgUczniow(D, p) {
  const uczn = uczniowiePlatnika(D, p), wg = Object.fromEntries(uczn.map(u => [u.id, []])), wspolne = [];
  const wl = Object.fromEntries(D.lekcje.map(l => [l.id, l.id_ucznia]));
  const wpl = D.wplaty.filter(w => klucz(w.platnik) === klucz(p)).sort((a, b) => (b.data + b.numer).localeCompare(a.data + a.numer));
  for (const w of wpl) {
    const ids = [...new Set(lekcjeWplaty(D, w.id).map(id => wl[id]).filter(id => id in wg))];
    if (ids.length) ids.forEach(i => wg[i].push(w));
    else if (uczn.length === 1) wg[uczn[0].id].push(w);
    else wspolne.push(w);
  }
  return { uczniowie: uczn, wg, wspolne };
}

export const limitKwartalny = placa => Math.floor((placa * 9 + 2) / 4);
export function statKwartalu(D, kw) {
  const [od, doo] = zakresKwartalu(kw);
  const ls = D.lekcje.filter(l => l.data >= od && l.data <= doo);
  const zreal = ls.filter(l => ROZLICZALNE.includes(l.status)).reduce((s, l) => s + l.cena, 0);
  const zapl = ls.filter(l => l.status === "zaplanowana").reduce((s, l) => s + l.cena, 0);
  const inne = D.przychody_inne.find(x => x.kwartal === kw)?.kwota || 0;
  const placa = D.place_minimalne.find(x => x.rok === Number(kw.slice(0, 4)))?.kwota;
  const limit = placa ? limitKwartalny(placa) : null;
  const biezacy = zreal + inne, prognoza = biezacy + zapl;
  return { kw, od, do: doo, zreal, zapl, inne, limit, biezacy, prognoza,
    procent: limit ? biezacy / limit * 100 : 0, procentPrognozy: limit ? prognoza / limit * 100 : 0 };
}

// ---------------------------------------------------------------- rachunek
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function tytulNaRachunku(t) {
  let s = (t || "").replace(/\s+\d{1,2}\.\d{1,2}(?:\.\d{2,4})?(?=\s*(?:,|$))/g, "").replace(/\s+[–-]\s+[a-ząćęłńóśźż]+\s+\d{4}$/, "").trim();
  if (s.includes(" – ")) {
    const [g, ...r] = s.split(" – ");
    s = g + " – " + [...new Set(r.join(" – ").split(",").map(x => x.trim()).filter(Boolean))].join(", ");
  }
  return s;
}
export function wystawca(D) {
  const g = k => D.ustawienia["wystawca." + k] || "";
  return { nazwa: g("nazwa"), adres: g("adres"), nip: g("nip"), miejscowosc: g("miejscowosc"), telefon: g("telefon"), email: g("email"), konto: g("konto") };
}
export function htmlRachunku(D, w) {
  const wy = wystawca(D);
  const tytul = D.ustawienia.tytul_dokumentu || "POTWIERDZENIE WPŁATY";
  const adres = w.adres !== null && w.adres !== undefined ? w.adres : adresPlatnika(D, w.platnik);
  const lekcje = lekcjeWplaty(D, w.id).map(id => D.lekcje.find(l => l.id === id)).filter(Boolean).sort((a, b) => (a.data + a.od).localeCompare(b.data + b.od));
  const wl = [esc(wy.nazwa || "—"), ...linieAdresu(wy.adres).map(esc)];
  if (wy.miejscowosc && !(wy.adres || "").includes(wy.miejscowosc.trim())) wl.push(esc(wy.miejscowosc.trim()));
  if (wy.nip) wl.push("NIP/PESEL: " + esc(wy.nip));
  if (wy.telefon) wl.push("tel. " + esc(wy.telefon));
  if (wy.email) wl.push(esc(wy.email));
  const pl = [esc(w.platnik), ...linieAdresu(adres).map(esc)];
  const miasto = (wy.miejscowosc || "").replace(/^\s*\d{2}-\d{3}\s*/, "").trim();
  const kwota = kwotaRachunku(D, w);
  const dotyczy = lekcje.length ? `<p class="r-maly">Dotyczy lekcji: ${lekcje.map(l => `${formatData(l.data)} (${esc(nazwaUcznia(D.uczniowie.find(u => u.id === l.id_ucznia)))})`).join(", ")}</p>` : "";
  return `<div class="rachunek">
<h1>${esc(tytul)}</h1><p class="r-nr">Nr ${esc(w.numer)}</p>
<p class="r-miejsce">${miasto ? esc(miasto) + ", " : ""}${formatData(w.data)}</p>
<div class="r-strony"><div><b>Wystawca</b><br>${wl.join("<br>")}</div><div class="r-prawa"><b>Płatnik</b><br>${pl.join("<br>")}</div></div>
<table class="r-tab"><tr><th>Tytuł</th><th>Forma płatności</th><th class="r-k">Kwota</th></tr>
<tr><td>${esc(tytulNaRachunku(w.tytul))}${w.rodzaj === "przedplata" ? " (przedpłata)" : ""}</td><td>${esc(w.forma)}</td><td class="r-k">${zl(kwota)}</td></tr></table>
${dotyczy}<p>Słownie: <b>${esc(kwotaSlownie(kwota))}</b></p>${wy.konto ? `<p class="r-maly">Nr konta: ${esc(wy.konto)}</p>` : ""}
<p class="r-podpis">……………………………………………<br><span class="r-maly">podpis wystawcy</span></p></div>`;
}

// ---------------------------------------------------------------- dojazdy
export const METODY = { wyliczenie: "Wyliczenie: km × spalanie × cena", paragony: "Paragony: część paragonów wg km" };
export const PALIWA = { benzyna: "Benzyna", lpg: "LPG + benzyna" };
export const URUCHOMIENIA_NA_KURS = 2;
export function ustawieniaDojazdow(D) {
  const g = (k, d = "") => D.ustawienia["dojazdy." + k] || d;
  let adres = g("adres_startowy");
  if (!adres) { const w = wystawca(D); adres = [w.adres, w.miejscowosc].filter(Boolean).join(", "); }
  return { adres, samochod: g("samochod"), spalanie: liczba(g("spalanie", "6.5"), 6.5), metoda: g("metoda", "wyliczenie"),
    procent: parseInt(g("procent", "100")) || 100, paliwo: g("paliwo", "benzyna"),
    benzyna_na_lpg: liczba(g("benzyna_na_lpg", "0.7"), 0.7), rozruch: liczba(g("rozruch", "0.05"), 0.05) };
}
export const zDojazdem = (l, u) => l.dojazd !== null && l.dojazd !== undefined ? !!l.dojazd : !!(u && u.dojazd);
export function kursyMiesiaca(D, r, m) {
  const [od, doo] = zakresMiesiaca(r, m);
  return D.lekcje.filter(l => l.data >= od && l.data <= doo).sort((a, b) => (a.data + a.od).localeCompare(b.data + b.od))
    .filter(l => l.status !== "odwolana" && zDojazdem(l, D.uczniowie.find(u => u.id === l.id_ucznia)))
    .map(l => { const u = D.uczniowie.find(x => x.id === l.id_ucznia);
      return { id_lekcji: l.id, data: l.data, uczen: nazwaUcznia(u), adres: u ? adresJednaLinia(u.adres_platnika) : "", km: Math.round(2 * (u?.km || 0) * 10) / 10 }; });
}
const r2 = x => Math.round(x * 100) / 100;
export function obliczDojazdy(r) {
  const k = Math.round(r.km * 10) / 10, proc = r.procent / 100, lpg = r.paliwo === "lpg";
  let kwota, opis;
  const l = x => r2(x).toString().replace(".", ",");
  const c = g => (g / 100).toFixed(2).replace(".", ",");
  if (r.metoda === "paragony") {
    if (r.przebieg <= 0) return [0, "Podaj przebieg samochodu w miesiącu."];
    const udz = Math.min(1, k / r.przebieg), suma = r.suma_paragonow + (lpg ? r.paragony_benzyna : 0);
    kwota = Math.round(suma * udz * proc);
    opis = `${km(k)} km z ${km(r.przebieg)} km = ${(udz * 100).toFixed(1).replace(".", ",")}% × paragony ${c(suma)} zł`
      + (lpg ? ` (LPG ${c(r.suma_paragonow)} + benzyna ${c(r.paragony_benzyna)})` : "");
  } else if (lpg) {
    const lLpg = k * r.spalanie / 100, lJ = k * r.benzyna_na_lpg / 100, lR = r.uruchomienia * r.rozruch, lB = lJ + lR;
    kwota = Math.round((lLpg * r.cena_litra + lB * r.cena_benzyny) * proc);
    opis = `LPG: ${km(k)} km × ${l(r.spalanie)} l/100 km = ${l(lLpg)} l × ${c(r.cena_litra)} zł; benzyna: ${l(lJ)} l w jeździe + `
      + `${r.uruchomienia} uruchomień × ${l(r.rozruch)} l = ${l(lB)} l × ${c(r.cena_benzyny)} zł`;
  } else {
    const lit = k * r.spalanie / 100;
    kwota = Math.round(lit * r.cena_litra * proc);
    opis = `${km(k)} km × ${l(r.spalanie)} l/100 km = ${l(lit)} l × ${c(r.cena_litra)} zł/l`;
  }
  if (r.procent !== 100) opis += ` × ${r.procent}%`;
  return [kwota, opis];
}
export const opisWydatkuDojazdow = r => `Paliwo – dojazdy do uczniów, ${MIESIACE[Number(r.miesiac.slice(5, 7)) - 1].toLowerCase()} ${r.miesiac.slice(0, 4)}, ${km(r.km)} km`;

export const noweId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()) + Date.now()).replace(/[^0-9a-f]/g, "").slice(0, 12);
export { esc };
