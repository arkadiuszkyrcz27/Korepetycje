// Korepetycje – wersja na telefon (PWA). Dane w Supabase, wspólne z wersją na komputer.
import * as L from "./logika.js";

const { esc, zl } = L;
const sb = window.supabase.createClient(window.KONFIGURACJA.url, window.KONFIGURACJA.klucz,
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: "korepetycje-sesja" } });

const TABELE = ["uczniowie", "lekcje", "wplaty", "wplaty_lekcje", "wydatki", "przychody_inne", "place_minimalne",
  "numeracja", "slowniki", "ustawienia", "rozliczenia_dojazdow"];
const D = Object.fromEntries(TABELE.map(t => [t, []]));
D.ustawienia = {};
const dzis0 = new Date();
const stan = { karta: "kalendarz", tryb: "tydzien", ref: L.dzis(), r: dzis0.getFullYear(), m: dzis0.getMonth() + 1,
  rokLimity: dzis0.getFullYear(), szukaj: "", filtr: "aktywni", kat: "" };
const $ = s => document.querySelector(s);

// ================================================================ ikony
const IK = {
  kalendarz: '<path d="M4 6.5h16v13H4z"/><path d="M4 10.5h16M8.5 4v4M15.5 4v4"/>',
  uczniowie: '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.6v4.2c0 1.5 2.5 3.2 5.5 3.2s5.5-1.7 5.5-3.2v-4.2"/>',
  rozliczenia: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10h17M7 14.5h4"/>',
  wydatki: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 11.5h6"/>',
  wiecej: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  dom: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><circle cx="10" cy="13.2" r="1.6"/><circle cx="14.6" cy="14" r="1.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', lewo: '<path d="m14.5 6-6 6 6 6"/>', prawo: '<path d="m9.5 6 6 6-6 6"/>',
  dodajLekcje: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
};
const ikona = (n, cls = "") => `<svg class="ik ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IK[n]}</svg>`;
const KOLORY = ["#4F8EF7", "#3BB273", "#E08A3C", "#B66BD8", "#E05A7A", "#2BB3B1", "#C9A227"];
const kolorUcznia = u => { let h = 0; for (const c of u.id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return u.aktywny ? KOLORY[h % KOLORY.length] : "#888"; };
const ikonaUcznia = (u, r = 36) => `<span class="ik-ucz" style="--k:${kolorUcznia(u)};width:${r}px;height:${r}px">${ikona("uczniowie")}</span>`;

// ================================================================ dane
// Wersja bazy w chmurze (tabela wersja_schematu, skrypty w folderze „supabase”) wymagana przez tę wersję aplikacji.
// Po dodaniu skryptu 08, 09… podnieś ją razem z WYMAGANA_WERSJA_CHMURY w korepetycje/chmura.py (zobacz WDROZENIE.md).
const WYMAGANA_WERSJA_BAZY = 7;
async function bladWersjiBazy() {
  const { data, error } = await sb.from("wersja_schematu").select("wersja").eq("id", 1).maybeSingle();
  if (error && !/does not exist|schema cache|wersja_schematu/i.test(error.message || "")) throw error;   // np. brak internetu
  const w = error ? 0 : (data?.wersja || 0);
  if (w >= WYMAGANA_WERSJA_BAZY) return null;
  return w === 0
    ? "Baza w chmurze nie ma numeru wersji. Na komputerze uruchom w Supabase skrypt 07_wersja_schematu.sql z folderu „supabase” (zobacz WDROZENIE.md)."
    : `Baza w chmurze ma wersję ${w}, a aplikacja wymaga ${WYMAGANA_WERSJA_BAZY}. Uruchom w Supabase brakujące skrypty z folderu „supabase” (zobacz WDROZENIE.md).`;
}
async function zaladuj() {
  const wyn = await Promise.all(TABELE.map(t => sb.from(t).select("*").range(0, 9999)));
  wyn.forEach((w, i) => {
    if (w.error) throw w.error;
    const t = TABELE[i];
    if (t === "ustawienia") D.ustawienia = Object.fromEntries(w.data.map(x => [x.klucz, x.wartosc]));
    else D[t] = w.data;
  });
  D.uczniowie.sort((a, b) => L.nazwaUcznia(a).localeCompare(L.nazwaUcznia(b), "pl"));
}
async function wykonaj(fn, komunikat) {
  pokazLadowanie(true);
  try {
    await fn();
    await zaladuj();
    rysuj();
    if (komunikat) toast(komunikat);
    return true;
  } catch (e) {
    console.error(e);
    alert("Nie udało się zapisać: " + (e.message || e) + (navigator.onLine ? "" : "\nBrak internetu."));
    return false;
  } finally { pokazLadowanie(false); }
}
const sprawdz = ({ error, data }) => { if (error) throw error; return data; };
const upsert = async (t, w, onConflict) => sprawdz(await sb.from(t).upsert(w, { onConflict }));
const ustaw = (klucz, wartosc) => upsert("ustawienia", { klucz, wartosc }, "user_id,klucz");
const ust = (k, d = "") => D.ustawienia[k] ?? d;
let odswiezCzas = null;
function odswiezPozniej() {
  clearTimeout(odswiezCzas);
  odswiezCzas = setTimeout(async () => { if (document.querySelector(".arkusz.otwarty")) return odswiezPozniej(); try { await zaladuj(); rysuj(); } catch (e) { console.warn(e); } }, 700);
}

// ================================================================ drobne elementy UI
function toast(t) {
  const el = $("#toast"); el.textContent = t; el.classList.add("widoczny");
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("widoczny"), 2600);
}
function pokazLadowanie(on) { $("#ladowanie").classList.toggle("widoczny", on); }
function potwierdz(tekst, tak = "Tak", nie = "Anuluj", groznie = false) {
  return new Promise(ok => {
    const d = $("#dialog");
    d.innerHTML = `<div class="dialog-okno"><p>${esc(tekst).replace(/\n/g, "<br>")}</p><div class="rzad koniec">
      <button class="btn" data-w="0">${esc(nie)}</button><button class="btn ${groznie ? "niebezp" : "glowny"}" data-w="1">${esc(tak)}</button></div></div>`;
    d.classList.add("otwarty");
    d.onclick = e => { const b = e.target.closest("[data-w]"); if (!b) return; d.classList.remove("otwarty"); ok(b.dataset.w === "1"); };
  });
}
function otworzArkusz(tytul, html, przyMontazu, pelny = false) {
  const a = $("#arkusz");
  a.innerHTML = `<div class="arkusz-okno ${pelny ? "pelny" : ""}"><div class="arkusz-gora"><button class="btn-ik" data-zamknij>${ikona("lewo")}</button>
    <h2>${esc(tytul)}</h2></div><div class="arkusz-tresc">${html}</div></div>`;
  a.classList.add("otwarty");
  document.body.classList.add("bez-przewijania");
  a.querySelector("[data-zamknij]").onclick = zamknijArkusz;
  a.onclick = e => { if (e.target === a) zamknijArkusz(); };
  history.pushState({ arkusz: 1 }, "");
  przyMontazu && przyMontazu(a.querySelector(".arkusz-tresc"));
}
function zamknijArkusz(zHistorii = false) {
  const a = $("#arkusz");
  if (!a.classList.contains("otwarty")) return;
  a.classList.remove("otwarty"); a.innerHTML = "";
  document.body.classList.remove("bez-przewijania");
  if (!zHistorii && history.state && history.state.arkusz) history.back();
}
window.addEventListener("popstate", () => zamknijArkusz(true));
const pole = (etykieta, wnetrze, cls = "") => `<label class="pole ${cls}"><span>${esc(etykieta)}</span>${wnetrze}</label>`;
const opcje = (lista, wybrana) => lista.map(([v, n]) => `<option value="${esc(v)}" ${v === wybrana ? "selected" : ""}>${esc(n)}</option>`).join("");
const pigulkaSalda = s => s < 0 ? `<span class="pig zla">do zapłaty ${zl(-s)}</span>` : s > 0 ? `<span class="pig dobra">nadpłata ${zl(s)}</span>` : `<span class="pig">rozliczone</span>`;
const kafel = (tytul, wartosc, opis, cls = "") => `<div class="kafel"><div class="k-t">${esc(tytul)}</div><div class="k-w ${cls}">${wartosc}</div><div class="k-o">${esc(opis)}</div></div>`;
const naglowekMiesiaca = () => `<div class="nawigacja"><button class="btn-ik" data-akcja="mies" data-k="-1">${ikona("lewo")}</button>
  <b>${L.MIESIACE[stan.m - 1]} ${stan.r}</b><button class="btn-ik" data-akcja="mies" data-k="1">${ikona("prawo")}</button></div>`;
const wartosc = (el, s) => el.querySelector(s).value;

// ================================================================ nawigacja i szkielet
const KARTY = { kalendarz: "Kalendarz", uczniowie: "Uczniowie", rozliczenia: "Rozliczenia", wydatki: "Wydatki", wiecej: "Więcej" };
function rysujMenu() {
  $("#menu").innerHTML = Object.entries(KARTY).map(([k, n]) =>
    `<button data-karta="${k}" class="${stan.karta === k || (k === "wiecej" && ["limity", "podsumowanie", "ustawienia", "wiecej"].includes(stan.karta)) ? "aktywna" : ""}">${ikona(k)}<span>${n}</span></button>`).join("");
}
function rysuj() {
  rysujMenu();
  const widoki = { kalendarz: wKalendarz, uczniowie: wUczniowie, rozliczenia: wRozliczenia, wydatki: wWydatki, wiecej: wWiecej,
    limity: wLimity, podsumowanie: wPodsumowanie, ustawienia: wUstawienia };
  const [tytul, przycisk, tresc] = widoki[stan.karta]();
  $("#tytul").textContent = tytul;
  $("#akcja-gora").innerHTML = przycisk || "";
  $("#tresc").innerHTML = tresc;
}
document.addEventListener("click", e => {
  const k = e.target.closest("[data-karta]");
  if (k) { stan.karta = k.dataset.karta; rysuj(); window.scrollTo(0, 0); return; }
  const a = e.target.closest("[data-akcja]");
  if (a && AKCJE[a.dataset.akcja]) { e.preventDefault(); AKCJE[a.dataset.akcja](a.dataset, a); }
});
document.addEventListener("input", e => {
  if (e.target.id === "szukaj") { stan.szukaj = e.target.value; const p = e.target.selectionStart; rysuj(); const s = $("#szukaj"); s.focus(); s.setSelectionRange(p, p); }
});
document.addEventListener("change", e => {
  if (e.target.id === "filtr") { stan.filtr = e.target.value; rysuj(); }
  if (e.target.id === "kat") { stan.kat = e.target.value; rysuj(); }
});
const AKCJE = {
  mies: ({ k }) => { stan.m += Number(k); if (stan.m < 1) { stan.m = 12; stan.r--; } if (stan.m > 12) { stan.m = 1; stan.r++; } rysuj(); },
  tryb: ({ t }) => { stan.tryb = t; rysuj(); },
  przesun: ({ k }) => {
    if (stan.tryb === "tydzien") stan.ref = L.dodajDni(stan.ref, 7 * Number(k));
    else { const d = L.zIso(stan.ref); d.setDate(1); d.setMonth(d.getMonth() + Number(k)); stan.ref = L.iso(d); }
    rysuj();
  },
  dzis: () => { stan.ref = L.dzis(); rysuj(); },
  dzien: ({ d }) => { stan.tryb = "tydzien"; stan.ref = d; rysuj(); },
  nowaLekcja: ({ d }) => arkuszLekcji(null, d || stan.ref),
  lekcja: ({ id }) => arkuszLekcji(id),
  nowyUczen: () => arkuszUcznia(null),
  uczen: ({ id }) => arkuszUcznia(id),
  wplata: ({ p, l }) => arkuszWplaty(null, p, l ? l.split(",") : []),
  rachunek: ({ id }) => arkuszRachunku(id),
  wydatek: ({ id }) => { const r = D.rozliczenia_dojazdow.find(x => x.id_wydatku === id); r ? arkuszDojazdow(r.miesiac) : arkuszWydatku(id); },
  nowyWydatek: () => arkuszWydatku(null),
  dojazdy: () => arkuszDojazdow(`${stan.r}-${String(stan.m).padStart(2, "0")}`),
  rok: ({ k }) => { stan.rokLimity += Number(k); rysuj(); },
  inne: ({ kw }) => arkuszInnych(kw),
  wyloguj: async () => { if (await potwierdz("Wylogować z aplikacji?", "Wyloguj")) { await sb.auth.signOut({ scope: "local" }); location.reload(); } },
  sekcja: ({ s }) => arkuszUstawien(s),
  odswiez: async () => { pokazLadowanie(true); try { await zaladuj(); rysuj(); toast("Odświeżono"); } finally { pokazLadowanie(false); } },
};

// ================================================================ KALENDARZ
function chipLekcji(l, krotki = false) {
  const u = D.uczniowie.find(x => x.id === l.id_ucznia);
  return `<button class="chip st-${l.status}" data-akcja="lekcja" data-id="${l.id}">${krotki ? `${l.od} ${esc(u ? u.imie : "?")}` :
    `<b>${l.od}–${l.do}</b> ${esc(L.nazwaUcznia(u))}`}</button>`;
}
function wKalendarz() {
  const przyciski = `<div class="seg"><button class="${stan.tryb === "tydzien" ? "on" : ""}" data-akcja="tryb" data-t="tydzien">Tydzień</button>
    <button class="${stan.tryb === "miesiac" ? "on" : ""}" data-akcja="tryb" data-t="miesiac">Miesiąc</button></div>`;
  let h = "";
  if (stan.tryb === "tydzien") {
    const pocz = L.poczatekTygodnia(stan.ref), kon = L.dodajDni(pocz, 6);
    const ls = D.lekcje.filter(l => l.data >= pocz && l.data <= kon).sort((a, b) => (a.data + a.od).localeCompare(b.data + b.od));
    h += `<div class="nawigacja"><button class="btn-ik" data-akcja="przesun" data-k="-1">${ikona("lewo")}</button>
      <button class="btn maly" data-akcja="dzis">Dziś</button><b>${L.dzienMies(pocz)} – ${L.formatData(kon)}</b>
      <button class="btn-ik" data-akcja="przesun" data-k="1">${ikona("prawo")}</button></div>`;
    for (let i = 0; i < 7; i++) {
      const d = L.dodajDni(pocz, i), dzien = ls.filter(l => l.data === d);
      h += `<div class="dzien ${d === L.dzis() ? "dzis" : ""}"><div class="dzien-g"><b>${L.DNI[i]} ${L.dzienMies(d)}</b>
        <button class="btn-ik maly akcent" data-akcja="nowaLekcja" data-d="${d}" aria-label="Dodaj lekcję">${ikona("dodajLekcje")}</button></div>
        ${dzien.length ? dzien.map(l => chipLekcji(l)).join("") : '<div class="cicho">—</div>'}</div>`;
    }
    h += podsumowanieTygodnia(pocz, kon, ls);
  } else {
    const d0 = L.zIso(stan.ref), r = d0.getFullYear(), m = d0.getMonth() + 1, [od, doo] = L.zakresMiesiaca(r, m);
    const pocz = L.poczatekTygodnia(od), kon = L.dodajDni(L.poczatekTygodnia(doo), 6);
    const ls = D.lekcje.filter(l => l.data >= pocz && l.data <= kon);
    const wm = ls.filter(l => l.status !== "odwolana" && l.data >= od && l.data <= doo);
    h += `<div class="nawigacja"><button class="btn-ik" data-akcja="przesun" data-k="-1">${ikona("lewo")}</button>
      <button class="btn maly" data-akcja="dzis">Dziś</button><b>${L.MIESIACE[m - 1]} ${r}</b>
      <button class="btn-ik" data-akcja="przesun" data-k="1">${ikona("prawo")}</button></div>
      <p class="cicho">W miesiącu: ${wm.length} ${L.odmiana(wm.length, "lekcja", "lekcje", "lekcji")} · ${zl(wm.reduce((s, l) => s + l.cena, 0))}</p>
      <div class="miesiac">${L.DNI.map(n => `<div class="m-n">${n}</div>`).join("")}`;
    for (let d = pocz; d <= kon; d = L.dodajDni(d, 1)) {
      const dz = ls.filter(l => l.data === d).sort((a, b) => a.od.localeCompare(b.od));
      h += `<button class="m-d ${d.slice(5, 7) !== String(m).padStart(2, "0") ? "poza" : ""} ${d === L.dzis() ? "dzis" : ""}" data-akcja="dzien" data-d="${d}">
        <span>${Number(d.slice(8))}</span>${dz.slice(0, 3).map(l => `<i class="kropka st-${l.status}"></i>`).join("")}${dz.length > 3 ? "<small>+</small>" : ""}</button>`;
    }
    h += "</div><p class='cicho'>Dotknij dnia, aby zobaczyć jego lekcje.</p>";
  }
  return ["Kalendarz", przyciski, h + `<button class="fab" data-akcja="nowaLekcja">${ikona("plus")}</button>`];
}
function podsumowanieTygodnia(pocz, kon, ls) {
  const przych = ls.filter(l => L.ROZLICZALNE.includes(l.status)), doR = ls.filter(l => l.status === "zrealizowana"),
    zapl = ls.filter(l => l.status === "zaplanowana"), wpl = D.wplaty.filter(w => w.data >= pocz && w.data <= kon);
  return `<h3>Podsumowanie tygodnia</h3><div class="kafle">
    ${kafel("Przychód", zl(przych.reduce((s, l) => s + l.cena, 0)), `${przych.length} ${L.odmiana(przych.length, "lekcja", "lekcje", "lekcji")} odbytych`)}
    ${kafel("Do rozliczenia", zl(doR.reduce((s, l) => s + l.cena, 0)), `${doR.length} czeka na wpłatę`, doR.length ? "ostrz" : "")}
    ${kafel("Wpłaty", zl(wpl.reduce((s, w) => s + w.kwota, 0)), `${wpl.length} ${L.odmiana(wpl.length, "wpłata", "wpłaty", "wpłat")}`)}
    ${kafel("Czas pracy", L.formatGodz(L.godziny(przych)), zapl.length ? `zaplanowane: ${L.formatGodz(L.godziny(zapl))}` : "brak zaplanowanych")}</div>`;
}

function arkuszLekcji(id, data) {
  const stara = id ? D.lekcje.find(l => l.id === id) : null;
  const uczniowie = D.uczniowie.filter(u => u.aktywny || (stara && u.id === stara.id_ucznia));
  if (!uczniowie.length) { alert("Najpierw dodaj ucznia."); return; }
  const l = stara || { id: "", id_ucznia: uczniowie[0].id, data, od: "16:00", do: "17:00", cena: uczniowie[0].stawka, status: "zaplanowana", notatka: "", dojazd: null };
  const statusy = Object.entries(L.STATUSY).filter(([k]) => k !== "rozliczona" || l.status === "rozliczona");
  const uObj = () => D.uczniowie.find(u => u.id === $("#f-uczen").value);
  otworzArkusz(stara ? "Edytuj lekcję" : "Nowa lekcja", `
    ${pole("Uczeń", `<select id="f-uczen">${opcje(uczniowie.map(u => [u.id, L.nazwaUcznia(u)]), l.id_ucznia)}</select>`)}
    ${pole("Data", `<input type="date" id="f-data" value="${l.data}">`)}
    <div class="rzad">${pole("Od", `<input type="time" id="f-od" value="${l.od}">`)}${pole("Do", `<input type="time" id="f-do" value="${l.do}">`)}</div>
    <div class="rzad">${pole("Cena (zł)", `<input inputmode="decimal" id="f-cena" value="${L.doEdycji(l.cena)}">`)}
    ${pole("Status", `<select id="f-status">${opcje(statusy, l.status)}</select>`)}</div>
    ${pole("Notatka", `<input id="f-notatka" value="${esc(l.notatka)}">`)}
    <label class="przelacznik"><input type="checkbox" id="f-dojazd" ${L.zDojazdem(l, D.uczniowie.find(u => u.id === l.id_ucznia)) ? "checked" : ""}> Dojazd do ucznia</label>
    <p class="blad" id="f-blad"></p>
    <div class="rzad koniec">${stara ? `<button class="btn niebezp" id="f-usun">Usuń</button><button class="btn" id="f-kopiuj">Kopiuj +7 dni</button>` : ""}
      ${stara && stara.status === "zrealizowana" ? `<button class="btn" id="f-rozlicz">Rozlicz</button>` : ""}<button class="btn glowny" id="f-zapisz">Zapisz</button></div>`,
  el => {
    let cenaReczna = !!stara, dojazdReczny = stara && stara.dojazd !== null && stara.dojazd !== undefined;
    el.querySelector("#f-cena").oninput = () => cenaReczna = true;
    el.querySelector("#f-dojazd").onchange = () => dojazdReczny = true;
    el.querySelector("#f-uczen").onchange = () => {
      const u = uObj(); if (!u) return;
      if (!cenaReczna) el.querySelector("#f-cena").value = L.doEdycji(u.stawka);
      if (!dojazdReczny) el.querySelector("#f-dojazd").checked = !!u.dojazd;
    };
    if (stara) {
      el.querySelector("#f-usun").onclick = async () => {
        if (await potwierdz("Usunąć tę lekcję?", "Usuń", "Anuluj", true))
          await wykonaj(async () => sprawdz(await sb.from("lekcje").delete().eq("id", stara.id)), "Usunięto lekcję") && zamknijArkusz();
      };
      el.querySelector("#f-kopiuj").onclick = async () => {
        const nowa = { ...stara, id: L.noweId(), data: L.dodajDni(stara.data, 7), status: "zaplanowana" };
        delete nowa.user_id; delete nowa.created_at; delete nowa.updated_at;
        await wykonaj(() => upsert("lekcje", nowa, "id"), `Skopiowano na ${L.formatData(nowa.data)}`) && zamknijArkusz();
      };
      const r = el.querySelector("#f-rozlicz");
      if (r) r.onclick = () => { zamknijArkusz(); const u = D.uczniowie.find(x => x.id === stara.id_ucznia); setTimeout(() => arkuszWplaty(null, u.platnik, [stara.id]), 50); };
    }
    el.querySelector("#f-zapisz").onclick = async () => {
      const blad = el.querySelector("#f-blad"); blad.textContent = "";
      let cena;
      try { cena = L.parsujKwote(wartosc(el, "#f-cena")); } catch { blad.textContent = "Podaj poprawną cenę."; return; }
      const u = uObj(), dojazd = el.querySelector("#f-dojazd").checked;
      const w = { id: stara ? stara.id : L.noweId(), id_ucznia: u.id, data: wartosc(el, "#f-data"), od: wartosc(el, "#f-od"), do: wartosc(el, "#f-do"),
        cena, status: wartosc(el, "#f-status"), notatka: wartosc(el, "#f-notatka").trim(), dojazd: dojazd === !!u.dojazd ? null : dojazd };
      if (!w.data) { blad.textContent = "Podaj datę."; return; }
      if (w.do <= w.od) { blad.textContent = "Koniec lekcji musi być po jej początku."; return; }
      const ostrz = [];
      const kol = D.lekcje.find(x => x.data === w.data && x.id !== w.id && x.status !== "odwolana" && w.status !== "odwolana" && x.od < w.do && w.od < x.do);
      if (kol) ostrz.push(`Ta lekcja nakłada się na inną (${kol.od}–${kol.do}, ${L.nazwaUcznia(D.uczniowie.find(x => x.id === kol.id_ucznia))}).`);
      const kw = L.kwartalZDaty(w.data), przed = L.statKwartalu(D, kw);
      const po = L.statKwartalu({ ...D, lekcje: [...D.lekcje.filter(x => x.id !== w.id), w] }, kw);
      if (po.limit && po.prognoza > po.limit && po.prognoza > przed.prognoza)
        ostrz.push(`Ta lekcja przekroczy prognozowany limit przychodów za ${L.nazwaKwartalu(kw)} (${zl(po.prognoza)} z ${zl(po.limit)}).`);
      if (ostrz.length && !(await potwierdz(ostrz.join("\n\n"), "Zapisz mimo to", "Wróć"))) return;
      const ok = await wykonaj(async () => {
        if (stara && stara.status === "rozliczona" && w.status !== "rozliczona")
          sprawdz(await sb.from("wplaty_lekcje").delete().eq("id_lekcji", w.id));
        await upsert("lekcje", w, "id");
      }, "Zapisano lekcję");
      if (!ok) return;
      zamknijArkusz();
      if (w.status === "zrealizowana" && (!stara || stara.status !== "zrealizowana") &&
          await potwierdz("Lekcja zrealizowana. Rozliczyć ją teraz (wpłata)?", "Rozlicz", "Później"))
        setTimeout(() => arkuszWplaty(null, u.platnik, [w.id]), 50);
    };
  });
}

// ================================================================ UCZNIOWIE
function rodziny(lista) {
  const m = new Map();
  for (const u of lista) { const k = L.klucz(u.platnik); if (!m.has(k)) m.set(k, []); m.get(k).push(u); }
  return [...m.values()].sort((a, b) => a[0].platnik.localeCompare(b[0].platnik, "pl"));
}
function wUczniowie() {
  const q = stan.szukaj.trim().toLocaleLowerCase("pl");
  const lista = D.uczniowie.filter(u => (stan.filtr === "wszyscy" || (stan.filtr === "aktywni") === !!u.aktywny)
    && `${u.imie} ${u.nazwisko} ${u.platnik}`.toLocaleLowerCase("pl").includes(q));
  const [od, doo] = L.zakresMiesiaca(dzis0.getFullYear(), dzis0.getMonth() + 1);
  const mies = {}, nast = {};
  for (const l of D.lekcje) {
    if (l.status !== "odwolana" && l.data >= od && l.data <= doo) mies[l.id_ucznia] = (mies[l.id_ucznia] || 0) + 1;
    if (l.status === "zaplanowana" && l.data >= L.dzis() && (!nast[l.id_ucznia] || (l.data + l.od) < (nast[l.id_ucznia].data + nast[l.id_ucznia].od))) nast[l.id_ucznia] = l;
  }
  const akt = D.uczniowie.filter(u => u.aktywny);
  let h = `<div class="rzad"><input id="szukaj" type="search" placeholder="Szukaj ucznia lub rodzica…" value="${esc(stan.szukaj)}">
    <select id="filtr">${opcje([["aktywni", "Aktywni"], ["nieaktywni", "Nieaktywni"], ["wszyscy", "Wszyscy"]], stan.filtr)}</select></div>
    <p class="cicho">${akt.length} ${L.odmiana(akt.length, "aktywny uczeń", "aktywnych uczniów", "aktywnych uczniów")} · ${rodziny(akt).length} ${L.odmiana(rodziny(akt).length, "rodzina", "rodziny", "rodzin")}</p>`;
  for (const dzieci of rodziny(lista)) {
    const p = dzieci[0];
    const tel = [...new Set(dzieci.map(u => u.kontakt).filter(Boolean))].join(", ");
    h += `<div class="karta"><div class="rodzina-g"><span class="ik-dom">${ikona("dom")}</span><div class="rosnie">
      <b class="duzy">${esc(p.platnik)}</b>${p.adres_platnika ? `<div class="cicho">${esc(L.adresJednaLinia(p.adres_platnika))}</div>` : ""}
      ${tel ? `<div class="cicho"><a href="tel:${esc(tel.split(",")[0].replace(/\s/g, ""))}">Tel. ${esc(tel)}</a></div>` : ""}</div>${pigulkaSalda(L.saldoPlatnika(D, p.platnik).saldo)}</div>`;
    for (const u of dzieci) {
      const n = nast[u.id];
      h += `<button class="dziecko" data-akcja="uczen" data-id="${u.id}">${ikonaUcznia(u)}<div class="rosnie">
        <b>${esc(L.nazwaUcznia(u))}</b>${u.aktywny ? "" : ' <span class="pig">nieaktywny</span>'}
        <div class="liczby"><span><small>Stawka</small>${zl(u.stawka)}</span><span><small>Lekcje (${L.MIESIACE[dzis0.getMonth()].slice(0, 3).toLowerCase()}.)</small>${mies[u.id] || 0}</span>
        <span><small>Następna</small>${n ? `<em>${L.dzienKrotko(n.data)}, ${n.od}</em>` : "brak"}</span>
        ${u.dojazd ? `<span><small>Dojazd</small>${u.km ? L.km(u.km) + " km" : '<em class="ostrz">uzupełnij</em>'}</span>` : ""}</div></div></button>`;
    }
    h += "</div>";
  }
  if (!lista.length) h += `<p class="pusto">${D.uczniowie.length ? "Brak uczniów spełniających warunki." : "Nie ma jeszcze uczniów."}</p>`;
  return ["Uczniowie", "", h + `<button class="fab" data-akcja="nowyUczen">${ikona("plus")}</button>`];
}

function arkuszUcznia(id) {
  const stary = id ? D.uczniowie.find(u => u.id === id) : null;
  const u = stary || { imie: "", nazwisko: "", platnik: "", adres_platnika: "", kontakt: "", stawka: parseInt(ust("stawka", "8000")) || 8000,
    aktywny: true, notatki: "", dojazd: true, km: 0 };
  const [ul, kod] = L.rozdzielAdres(u.adres_platnika);
  otworzArkusz(stary ? "Edytuj ucznia" : "Nowy uczeń", `
    <div class="rzad">${pole("Imię", `<input id="f-imie" value="${esc(u.imie)}">`)}${pole("Nazwisko", `<input id="f-nazwisko" value="${esc(u.nazwisko)}">`)}</div>
    ${pole("Rodzic płacący", `<input id="f-platnik" list="l-platnicy" value="${esc(u.platnik)}"><datalist id="l-platnicy">${L.platnicy(D).map(p => `<option value="${esc(p)}">`).join("")}</datalist>`)}
    <p class="cicho">Rodzeństwo: wpisz tego samego płatnika – wpłaty i saldo rozliczają się wspólnie.</p>
    ${pole("Adres płatnika (ulica, numer)", `<input id="f-ulica" value="${esc(ul)}">`)}
    ${pole("Kod i miasto", `<input id="f-kod" placeholder="np. 44-300 Wodzisław Śląski" value="${esc(kod)}">`)}
    ${pole("Kontakt do rodzica", `<input id="f-kontakt" type="tel" value="${esc(u.kontakt)}">`)}
    ${pole("Stawka za lekcję (zł)", `<input id="f-stawka" inputmode="decimal" value="${L.doEdycji(u.stawka)}">`)}
    <label class="przelacznik"><input type="checkbox" id="f-dojazd" ${u.dojazd ? "checked" : ""}> Dojeżdżam do ucznia</label>
    <div class="rzad dol">${pole("Odległość w jedną stronę (km)", `<input id="f-km" inputmode="decimal" value="${L.km(u.km || 0)}">`)}
      <button class="btn" id="f-mapa">Sugeruj z mapy</button></div><p class="cicho" id="f-mapa-info"></p>
    ${pole("Notatki", `<textarea id="f-notatki" rows="2">${esc(u.notatki)}</textarea>`)}
    <label class="przelacznik"><input type="checkbox" id="f-aktywny" ${u.aktywny ? "checked" : ""}> Uczeń aktywny</label>
    <p class="blad" id="f-blad"></p>
    <div class="rzad koniec">${stary ? `<button class="btn niebezp" id="f-usun">Usuń</button>` : ""}<button class="btn glowny" id="f-zapisz">Zapisz</button></div>`,
  el => {
    el.querySelector("#f-platnik").onchange = () => {
      if (!wartosc(el, "#f-ulica").trim() && !wartosc(el, "#f-kod").trim()) {
        const [a, k] = L.rozdzielAdres(L.adresPlatnika(D, wartosc(el, "#f-platnik"))); el.querySelector("#f-ulica").value = a; el.querySelector("#f-kod").value = k;
      }
    };
    el.querySelector("#f-mapa").onclick = async () => {
      const info = el.querySelector("#f-mapa-info"), start = L.ustawieniaDojazdow(D).adres;
      const cel = [wartosc(el, "#f-ulica"), wartosc(el, "#f-kod")].map(x => x.trim()).filter(Boolean).join(", ");
      if (!start) { info.textContent = "Najpierw wpisz adres startowy w Ustawieniach › Dojazdy."; return; }
      if (!cel) { info.textContent = "Wpisz adres płatnika (ucznia)."; return; }
      info.textContent = "Szukam trasy…";
      try {
        const [k, dokl] = await odlegloscZMapy(start, cel);
        el.querySelector("#f-km").value = L.km(k);
        info.textContent = `Według mapy (OpenStreetMap): ${L.km(k)} km samochodem w jedną stronę. ` +
          (dokl ? "Możesz poprawić wartość." : "Uwaga: nie znaleziono dokładnego adresu – liczono do środka miejscowości.");
      } catch (e) { info.textContent = e.message; }
    };
    if (stary) el.querySelector("#f-usun").onclick = async () => {
      const n = D.lekcje.filter(l => l.id_ucznia === stary.id).length;
      if (await potwierdz(`Usunąć ucznia „${L.nazwaUcznia(stary)}”?` + (n ? `\nRazem z nim zostanie usuniętych ${n} lekcji (lepiej oznaczyć ucznia jako nieaktywnego). Wpłaty zostają.` : ""), "Usuń", "Anuluj", true))
        await wykonaj(async () => sprawdz(await sb.from("uczniowie").delete().eq("id", stary.id)), "Usunięto ucznia") && zamknijArkusz();
    };
    el.querySelector("#f-zapisz").onclick = async () => {
      const blad = el.querySelector("#f-blad");
      let stawka;
      try { stawka = L.parsujKwote(wartosc(el, "#f-stawka") || "0"); } catch { blad.textContent = "Podaj poprawną stawkę."; return; }
      const w = { id: stary ? stary.id : L.noweId(), imie: wartosc(el, "#f-imie").trim(), nazwisko: wartosc(el, "#f-nazwisko").trim(),
        platnik: wartosc(el, "#f-platnik").trim(), adres_platnika: L.zlozAdres(wartosc(el, "#f-ulica"), wartosc(el, "#f-kod")),
        kontakt: wartosc(el, "#f-kontakt").trim(), stawka, aktywny: el.querySelector("#f-aktywny").checked, notatki: wartosc(el, "#f-notatki"),
        dojazd: el.querySelector("#f-dojazd").checked, km: L.zaokr(L.liczba(wartosc(el, "#f-km")), 1) };
      if (!w.imie || !w.platnik) { blad.textContent = "Podaj imię ucznia i rodzica płacącego."; return; }
      await wykonaj(async () => {
        await upsert("uczniowie", w, "id");
        if (stary && L.klucz(stary.platnik) !== L.klucz(w.platnik) &&
            !D.uczniowie.some(x => x.id !== w.id && L.klucz(x.platnik) === L.klucz(stary.platnik))) {
          const ids = D.wplaty.filter(x => L.klucz(x.platnik) === L.klucz(stary.platnik)).map(x => x.id);
          if (ids.length) sprawdz(await sb.from("wplaty").update({ platnik: w.platnik }).in("id", ids));
        }
        if (!stary || w.adres_platnika !== stary.adres_platnika) {
          const ids = D.uczniowie.filter(x => x.id !== w.id && L.klucz(x.platnik) === L.klucz(w.platnik)).map(x => x.id);
          if (ids.length && w.adres_platnika) sprawdz(await sb.from("uczniowie").update({ adres_platnika: w.adres_platnika }).in("id", ids));
        }
      }, "Zapisano ucznia") && zamknijArkusz();
    };
  });
}

// ---------------------------------------------------------------- mapa (OpenStreetMap)
async function pobierzJson(url) {
  let r;
  try { r = await fetch(url, { headers: { "Accept-Language": "pl" } }); } catch { throw new Error("Nie udało się połączyć z mapą (sprawdź internet)."); }
  if (r.status === 429) throw new Error("Serwer mapy jest chwilowo przeciążony – spróbuj za minutę.");
  if (!r.ok) throw new Error(`Serwer mapy zwrócił błąd ${r.status}.`);
  return r.json();
}
function rozbierzAdres(a) {
  a = (a || "").replace(/\n/g, ", ").replace(/\s+/g, " ").trim();
  const m = a.match(/(\d{2}-\d{3})\s*([^,]*)/);
  let kod = m ? m[1] : "", miasto = m ? m[2].trim() : "", reszta = (m ? a.slice(0, m.index) : a).replace(/^[\s,]+|[\s,]+$/g, "");
  if (!miasto && reszta.includes(",")) { const i = reszta.lastIndexOf(","); miasto = reszta.slice(i + 1).trim(); reszta = reszta.slice(0, i).trim(); }
  reszta = reszta.replace(/^(ul\.|ulica|al\.|aleja|pl\.|plac)\s*/i, "").replace(/^os\.\s*/i, "osiedle ");
  const m2 = reszta.match(/^(.*?)\s+(\d+[a-zA-Z]?)(?:\/\S+)?$/);
  let ulica = m2 ? m2[1] : reszta, numer = m2 ? m2[2] : "";
  if (!miasto) { miasto = reszta || a; ulica = ""; numer = ""; }
  return { ulica, numer, kod, miasto };
}
let ostatnieZapytanie = 0;
async function szukaj(p) {
  const czekaj = 1100 - (Date.now() - ostatnieZapytanie); if (czekaj > 0) await new Promise(r => setTimeout(r, czekaj));
  ostatnieZapytanie = Date.now();
  const w = await pobierzJson("https://nominatim.openstreetmap.org/search?" + new URLSearchParams({ ...p, format: "json", limit: 1, countrycodes: "pl" }));
  return w.length ? [Number(w[0].lat), Number(w[0].lon)] : null;
}
async function wspolrzedne(adres) {
  const { ulica, numer, kod, miasto } = rozbierzAdres(adres);
  if (ulica) for (const p of [{ street: `${numer} ${ulica}`.trim(), city: miasto, ...(kod ? { postalcode: kod } : {}) }, { q: `${ulica} ${numer}, ${miasto}` }, { street: ulica, city: miasto }]) {
    const w = await szukaj(p); if (w) return [...w, true];
  }
  const w = await szukaj({ city: miasto }) || await szukaj({ q: `${kod} ${miasto}`.trim() });
  if (w) return [...w, !ulica];
  throw new Error(`Nie znaleziono na mapie adresu: ${adres}`);
}
async function odlegloscZMapy(skad, dokad) {
  const [a1, o1, d1] = await wspolrzedne(skad), [a2, o2, d2] = await wspolrzedne(dokad);
  const w = await pobierzJson(`https://router.project-osrm.org/route/v1/driving/${o1},${a1};${o2},${a2}?overview=false`);
  if (!w.routes || !w.routes.length) throw new Error("Nie udało się wyznaczyć trasy.");
  return [Math.round(w.routes[0].distance / 100) / 10, d1 && d2];
}

// ================================================================ ROZLICZENIA
function wierszWplaty(w, zPlatnikiem = false) {
  const nr = L.kwotaRachunku(D, w), opis = [w.numer, w.forma];
  if (w.rodzaj === "przedplata") opis.push("przedpłata");
  if (nr !== w.kwota) opis.push(`rachunek ${zl(nr)}`);
  if (zPlatnikiem) opis.unshift(w.platnik);
  return `<button class="wpl" data-akcja="rachunek" data-id="${w.id}"><span class="cicho">${L.formatData(w.data)}</span><b>${zl(w.kwota)}</b>
    <span class="cicho rosnie obetnij">${esc(opis.join(" · "))}</span></button>`;
}
function listaWplat(ws) {
  if (!ws.length) return `<div class="cicho wcieta">Brak wpłat.</div>`;
  const pierwsze = ws.slice(0, 3).map(w => wierszWplaty(w)).join(""), reszta = ws.slice(3);
  return pierwsze + (reszta.length ? `<details><summary>Pokaż starsze wpłaty (${reszta.length})</summary>${reszta.map(w => wierszWplaty(w)).join("")}</details>` : "");
}
function wRozliczenia() {
  const [od, doo] = L.zakresMiesiaca(stan.r, stan.m);
  const doR = D.lekcje.filter(l => l.status === "zrealizowana"), wMies = D.lekcje.filter(l => l.data >= od && l.data <= doo && L.ROZLICZALNE.includes(l.status));
  const wpl = D.wplaty.filter(w => w.data >= od && w.data <= doo).sort((a, b) => (b.data + b.numer).localeCompare(a.data + a.numer));
  const rodz = [];
  let nadpl = 0;
  for (const p of L.platnicy(D)) {
    const uczn = L.uczniowiePlatnika(D, p), ids = new Set(uczn.map(u => u.id)), saldo = L.saldoPlatnika(D, p).saldo;
    nadpl += Math.max(0, saldo);
    const jegoDo = doR.filter(l => ids.has(l.id_ucznia)), jegoMies = wMies.filter(l => ids.has(l.id_ucznia));
    const jegoWpl = wpl.filter(w => L.klucz(w.platnik) === L.klucz(p)).reduce((s, w) => s + w.kwota, 0);
    if (!uczn.some(u => u.aktywny) && !jegoMies.length && !jegoWpl && saldo === 0) continue;
    rodz.push({ p, uczn, saldo, jegoDo, jegoMies, jegoWpl });
  }
  rodz.sort((a, b) => (a.saldo >= 0) - (b.saldo >= 0) || a.p.localeCompare(b.p, "pl"));
  let h = naglowekMiesiaca() + `<div class="kafle">
    ${kafel("Do rozliczenia", zl(doR.reduce((s, l) => s + l.cena, 0)), `${doR.length} ${L.odmiana(doR.length, "lekcja zrealizowana", "lekcje zrealizowane", "lekcji zrealizowanych")}`, doR.length ? "zle" : "")}
    ${kafel("Wpłaty w miesiącu", zl(wpl.reduce((s, w) => s + w.kwota, 0)), `${wpl.length} ${L.odmiana(wpl.length, "wpłata", "wpłaty", "wpłat")}`)}
    ${kafel("Nadpłaty", zl(nadpl), "na kolejne lekcje", nadpl ? "dobre" : "")}
    ${kafel("Lekcje w miesiącu", zl(wMies.reduce((s, l) => s + l.cena, 0)), `${wMies.length} odbytych`)}</div>`;
  for (const r of rodz) {
    const { wg, wspolne } = L.wplatyWgUczniow(D, r.p);
    h += `<div class="karta ${r.saldo < 0 ? "obramowanie-zle" : ""}"><div class="rodzina-g"><span class="ik-dom">${ikona("dom")}</span><div class="rosnie">
      <b class="duzy">${esc(r.p)}</b><div class="cicho">W miesiącu: ${r.jegoMies.length} ${L.odmiana(r.jegoMies.length, "lekcja", "lekcje", "lekcji")} (${zl(r.jegoMies.reduce((s, l) => s + l.cena, 0))}) · wpłaty ${zl(r.jegoWpl)}</div></div>${pigulkaSalda(r.saldo)}</div>
      <div class="rzad">${r.jegoDo.length ? `<button class="btn glowny" data-akcja="wplata" data-p="${esc(r.p)}" data-l="${r.jegoDo.map(l => l.id).join(",")}">Rozlicz ${r.jegoDo.length} ${L.odmiana(r.jegoDo.length, "lekcję", "lekcje", "lekcji")} (${zl(r.jegoDo.reduce((s, l) => s + l.cena, 0))})</button>` : ""}
      <button class="btn ${r.jegoDo.length ? "" : "glowny"}" data-akcja="wplata" data-p="${esc(r.p)}">+ Wpłata</button></div>`;
    for (const u of r.uczn) {
      const ps = wg[u.id] || [], jd = r.jegoDo.filter(l => l.id_ucznia === u.id);
      if (!(u.aktywny || ps.length || jd.length)) continue;
      h += `<div class="sekcja"><div class="rzad srodek">${ikonaUcznia(u, 28)}<b class="rosnie">${esc(L.nazwaUcznia(u))}</b>
        ${jd.length ? `<span class="zle maly">do rozliczenia: ${jd.slice(0, 3).map(l => `${L.dzienKrotko(l.data)} (${zl(l.cena)})`).join(", ")}${jd.length > 3 ? ` +${jd.length - 3}` : ""}</span>` : ""}</div>${listaWplat(ps)}</div>`;
    }
    if (wspolne.length) h += `<div class="sekcja"><b>Wpłaty wspólne</b>${listaWplat(wspolne)}</div>`;
    h += "</div>";
  }
  h += `<h3>Wpłaty w miesiącu · ${zl(wpl.reduce((s, w) => s + w.kwota, 0))}</h3><div class="karta">${wpl.length ? wpl.map(w => wierszWplaty(w, true)).join("") : '<div class="cicho">Brak wpłat w tym miesiącu.</div>'}</div>`;
  return ["Rozliczenia", "", h + `<button class="fab" data-akcja="wplata">${ikona("plus")}</button>`];
}

function arkuszWplaty(id, platnik, lekcjeStart = []) {
  const stara = id ? D.wplaty.find(w => w.id === id) : null;
  const lista = L.platnicy(D);
  if (!stara && !lista.length) { alert("Najpierw dodaj ucznia z rodzicem płacącym."); return; }
  const pn = stara ? stara.platnik : (platnik || lista[0]);
  if (!lista.some(x => L.klucz(x) === L.klucz(pn))) lista.unshift(pn);
  const adres0 = stara && stara.adres !== null ? stara.adres : L.adresPlatnika(D, pn);
  const [ul, kod] = L.rozdzielAdres(adres0);
  const zazn0 = stara ? L.lekcjeWplaty(D, stara.id) : lekcjeStart;
  otworzArkusz(stara ? "Edytuj wpłatę" : "Nowa wpłata", `
    ${pole("Płatnik (rodzic)", `<select id="f-platnik">${opcje(lista.map(x => [x, x]), lista.find(x => L.klucz(x) === L.klucz(pn)))}</select>`)}
    ${pole("Adres płatnika (ulica, numer)", `<input id="f-ulica" value="${esc(ul)}">`)}
    ${pole("Kod i miasto", `<input id="f-kod" value="${esc(kod)}">`)}
    <div class="rzad">${pole("Data", `<input type="date" id="f-data" value="${stara ? stara.data : L.dzis()}">`)}
      ${pole("Kwota wpłaty (zł)", `<input id="f-kwota" inputmode="decimal" value="${stara ? L.doEdycji(stara.kwota) : ""}">`)}</div>
    <p class="cicho" id="f-info"></p>
    <div class="rzad">${pole("Forma", `<select id="f-forma">${opcje(L.FORMY.map(x => [x, x]), stara ? stara.forma : "gotówka")}</select>`)}
      ${pole("Rodzaj", `<select id="f-rodzaj">${opcje(Object.entries(L.RODZAJE), stara ? stara.rodzaj : "lekcje")}</select>`)}</div>
    <div id="f-lekcje-blok"><span class="etyk">Lekcje do rozliczenia (po zapisie: „Rozliczona”)</span><div id="f-lekcje" class="lista-wyboru"></div></div>
    ${pole("Tytuł (na rachunku)", `<input id="f-tytul" value="${esc(stara ? stara.tytul : "")}">`)}
    <p class="cicho">${stara ? "Numer: " + esc(stara.numer) : "Numer rachunku nada baza przy zapisie (według szablonu z Ustawień)."}</p>
    <p class="blad" id="f-blad"></p>
    <div class="rzad koniec">${stara ? `<button class="btn niebezp" id="f-usun">Usuń</button>` : ""}<button class="btn glowny" id="f-zapisz">Zapisz</button></div>`,
  el => {
    let autoKwota = !stara, autoTytul = !stara;
    const nowa = !stara;
    el.querySelector("#f-kwota").oninput = () => autoKwota = false;
    el.querySelector("#f-tytul").oninput = () => autoTytul = false;
    const zaznaczone = () => [...el.querySelectorAll("#f-lekcje input:checked")].map(x => x.value);
    const wczytajLekcje = (p, zazn) => {
      const ls = L.lekcjeDoRozliczenia(D, p, zazn);
      el.querySelector("#f-lekcje").innerHTML = ls.length ? ls.map(l => `<label class="przelacznik"><input type="checkbox" value="${l.id}" ${zazn.includes(l.id) ? "checked" : ""}>
        ${L.formatData(l.data)} ${l.od} · ${esc(L.nazwaUcznia(D.uczniowie.find(u => u.id === l.id_ucznia)))} · ${zl(l.cena)}</label>`).join("")
        : '<div class="cicho">Brak zrealizowanych, nierozliczonych lekcji tego płatnika.</div>';
    };
    const przelicz = () => {
      const p = wartosc(el, "#f-platnik"), przedpl = wartosc(el, "#f-rodzaj") === "przedplata";
      el.querySelector("#f-lekcje-blok").style.display = przedpl ? "none" : "";
      const ls = przedpl ? [] : zaznaczone().map(i => D.lekcje.find(l => l.id === i)).filter(Boolean);
      const wart = ls.reduce((s, l) => s + l.cena, 0), nad = nowa ? L.nadplata(D, p) : 0;
      el.querySelector("#f-info").textContent = ls.length ? `Na rachunku: ${zl(wart)} (wartość zaznaczonych lekcji).` +
        (nad ? ` Nadpłata do wykorzystania: ${zl(nad)} – do zapłaty ${zl(wart - Math.min(nad, wart))}.` : "") : (nad ? `Płatnik ma nadpłatę: ${zl(nad)}.` : "");
      if (autoKwota) el.querySelector("#f-kwota").value = L.doEdycji(ls.length ? Math.max(0, wart - nad) : Math.max(0, -L.saldoPlatnika(D, p).saldo));
      if (autoTytul) {
        const nazwy = ls.length ? ls.map(l => L.nazwaUcznia(D.uczniowie.find(u => u.id === l.id_ucznia)))
          : L.uczniowiePlatnika(D, p).filter(u => u.aktywny).map(L.nazwaUcznia);
        el.querySelector("#f-tytul").value = "Korepetycje – " + ([...new Set(nazwy)].join(", ") || "—");
      }
    };
    wczytajLekcje(pn, zazn0); przelicz();
    el.querySelector("#f-lekcje").onchange = przelicz;
    el.querySelector("#f-rodzaj").onchange = przelicz;
    el.querySelector("#f-platnik").onchange = () => {
      const p = wartosc(el, "#f-platnik"), [a, k] = L.rozdzielAdres(L.adresPlatnika(D, p));
      el.querySelector("#f-ulica").value = a; el.querySelector("#f-kod").value = k;
      wczytajLekcje(p, []); przelicz();
    };
    if (stara) el.querySelector("#f-usun").onclick = async () => {
      if (await potwierdz(`Usunąć wpłatę ${stara.numer}?\n${L.lekcjeWplaty(D, stara.id).length ? "Powiązane lekcje wrócą do statusu Zrealizowana. " : ""}Numer nie zostanie użyty ponownie.`, "Usuń", "Anuluj", true))
        await wykonaj(async () => sprawdz(await sb.rpc("usun_wplate", { p_id: stara.id })), "Usunięto wpłatę") && zamknijArkusz();
    };
    el.querySelector("#f-zapisz").onclick = async () => {
      const blad = el.querySelector("#f-blad"), przedpl = wartosc(el, "#f-rodzaj") === "przedplata", lek = przedpl ? [] : zaznaczone();
      let kwota;
      try { kwota = L.parsujKwote(wartosc(el, "#f-kwota")); } catch { blad.textContent = "Podaj poprawną kwotę."; return; }
      if (kwota < 0 || (kwota === 0 && !lek.length)) { blad.textContent = "Podaj kwotę wpłaty (0 zł tylko przy lekcjach rozliczanych z nadpłaty)."; return; }
      let wynik;
      const ok = await wykonaj(async () => {
        wynik = sprawdz(await sb.rpc("zapisz_wplate", { p_id: stara ? stara.id : L.noweId(), p_platnik: wartosc(el, "#f-platnik"), p_data: wartosc(el, "#f-data"),
          p_kwota: kwota, p_forma: wartosc(el, "#f-forma"), p_rodzaj: wartosc(el, "#f-rodzaj"), p_tytul: wartosc(el, "#f-tytul").trim(),
          p_adres: L.zlozAdres(wartosc(el, "#f-ulica"), wartosc(el, "#f-kod")), p_lekcje: lek }));
      }, stara ? "Zapisano wpłatę" : "Wpłata zapisana");
      if (!ok) return;
      zamknijArkusz();
      const w = Array.isArray(wynik) ? wynik[0] : wynik;
      if (!stara && w && await potwierdz(`Wpłata zapisana (${w.numer}).\nPokazać rachunek?`, "Pokaż rachunek", "Nie teraz"))
        setTimeout(() => arkuszRachunku(w.id), 50);
    };
  });
}

function arkuszRachunku(id) {
  const w = D.wplaty.find(x => x.id === id);
  if (!w) return;
  const wy = L.wystawca(D);
  otworzArkusz(`Rachunek ${w.numer}`, `${!wy.nazwa ? '<p class="ostrz-blok">Uzupełnij dane wystawcy w Ustawieniach – pojawią się na rachunku.</p>' : ""}
    <div class="kartka" id="do-druku">${L.htmlRachunku(D, w)}</div>
    <div class="rzad koniec"><button class="btn" id="f-edytuj">Edytuj</button><button class="btn glowny" id="f-druk">Drukuj / PDF</button></div>
    <p class="cicho">„Drukuj / PDF” otwiera drukowanie telefonu – wybierz „Zapisz jako PDF”, aby zapisać lub wysłać rachunek.</p>`,
  el => {
    el.querySelector("#f-druk").onclick = () => drukuj(L.htmlRachunku(D, w), `rachunek ${w.numer}`);
    el.querySelector("#f-edytuj").onclick = () => { zamknijArkusz(); setTimeout(() => arkuszWplaty(w.id), 50); };
  }, true);
}
function drukuj(html, tytul) {
  const p = $("#druk");
  p.innerHTML = html;
  const stary = document.title; document.title = tytul.replace(/[\\/]/g, "-");
  document.body.classList.add("drukowanie");
  setTimeout(() => { window.print(); document.body.classList.remove("drukowanie"); document.title = stary; }, 50);
}

// ================================================================ WYDATKI i DOJAZDY
function wWydatki() {
  const [od, doo] = L.zakresMiesiaca(stan.r, stan.m);
  const kategorie = D.slowniki.filter(s => s.rodzaj === "kategoria_wydatku").sort((a, b) => a.kolejnosc - b.kolejnosc || a.id - b.id).map(s => s.nazwa);
  const lista = D.wydatki.filter(e => e.data >= od && e.data <= doo && (!stan.kat || e.kategoria === stan.kat)).sort((a, b) => b.data.localeCompare(a.data));
  const rozl = D.rozliczenia_dojazdow.find(r => r.miesiac === od.slice(0, 7));
  let h = naglowekMiesiaca() + `<div class="rzad"><select id="kat">${opcje([["", "Wszystkie kategorie"], ...kategorie.map(k => [k, k])], stan.kat)}</select>
    <button class="btn" data-akcja="dojazdy">${rozl ? "Dojazdy: " + zl(rozl.kwota) : "Rozlicz dojazdy"}</button></div>
    <p class="suma">Suma: <b>${zl(lista.reduce((s, e) => s + e.kwota, 0))}</b> · ${lista.length} ${L.odmiana(lista.length, "pozycja", "pozycje", "pozycji")}</p><div class="karta">`;
  h += lista.length ? lista.map(e => `<button class="wpl" data-akcja="wydatek" data-id="${e.id}"><span class="cicho">${L.formatData(e.data)}</span>
    <span class="rosnie obetnij">${esc(e.opis || e.kategoria || "—")}<br><small class="cicho">${esc(e.kategoria)}${e.dokument ? " · " + esc(e.dokument) : ""}</small></span><b>${zl(e.kwota)}</b></button>`).join("")
    : '<div class="cicho">Brak wydatków w tym miesiącu.</div>';
  return ["Wydatki", "", h + `</div><button class="fab" data-akcja="nowyWydatek">${ikona("plus")}</button>`];
}
function arkuszWydatku(id) {
  const st = id ? D.wydatki.find(e => e.id === id) : null;
  const kategorie = D.slowniki.filter(s => s.rodzaj === "kategoria_wydatku").sort((a, b) => a.kolejnosc - b.kolejnosc).map(s => s.nazwa);
  const e = st || { data: L.dzis(), kwota: 0, kategoria: kategorie[0] || "Inne", opis: "", dokument: "" };
  otworzArkusz(st ? "Edytuj wydatek" : "Nowy wydatek", `
    <div class="rzad">${pole("Data", `<input type="date" id="f-data" value="${e.data}">`)}${pole("Kwota (zł)", `<input id="f-kwota" inputmode="decimal" value="${st ? L.doEdycji(e.kwota) : ""}">`)}</div>
    ${pole("Kategoria", `<select id="f-kat">${opcje([...new Set([...kategorie, e.kategoria].filter(Boolean))].map(k => [k, k]), e.kategoria)}</select>`)}
    ${pole("Opis", `<input id="f-opis" value="${esc(e.opis)}">`)}${pole("Numer dokumentu (opcjonalnie)", `<input id="f-dok" value="${esc(e.dokument)}">`)}
    <p class="blad" id="f-blad"></p>
    <div class="rzad koniec">${st ? `<button class="btn niebezp" id="f-usun">Usuń</button>` : ""}<button class="btn glowny" id="f-zapisz">Zapisz</button></div>`,
  el => {
    if (st) el.querySelector("#f-usun").onclick = async () => {
      if (await potwierdz("Usunąć ten wydatek?", "Usuń", "Anuluj", true))
        await wykonaj(async () => sprawdz(await sb.from("wydatki").delete().eq("id", st.id)), "Usunięto wydatek") && zamknijArkusz();
    };
    el.querySelector("#f-zapisz").onclick = async () => {
      let kwota;
      try { kwota = L.parsujKwote(wartosc(el, "#f-kwota")); } catch { el.querySelector("#f-blad").textContent = "Podaj poprawną kwotę."; return; }
      if (kwota <= 0) { el.querySelector("#f-blad").textContent = "Podaj kwotę wydatku."; return; }
      await wykonaj(() => upsert("wydatki", { id: st ? st.id : L.noweId(), data: wartosc(el, "#f-data"), kwota, kategoria: wartosc(el, "#f-kat"),
        opis: wartosc(el, "#f-opis").trim(), dokument: wartosc(el, "#f-dok").trim() }, "id"), "Zapisano wydatek") && zamknijArkusz();
    };
  });
}

function arkuszDojazdow(miesiac) {
  const r0 = D.rozliczenia_dojazdow.find(r => r.miesiac === miesiac), u = L.ustawieniaDojazdow(D);
  const rok = Number(miesiac.slice(0, 4)), mies = Number(miesiac.slice(5, 7));
  let pozycje = r0 ? JSON.parse(r0.pozycje || "[]") : L.kursyMiesiaca(D, rok, mies);
  const v = (k, d) => r0 && r0[k] !== undefined && r0[k] !== null && (r0[k] !== 0 || k === "przebieg") ? r0[k] : d;
  const paliwo = r0 ? (r0.paliwo || "benzyna") : u.paliwo;
  otworzArkusz(`Dojazdy – ${L.MIESIACE[mies - 1].toLowerCase()} ${rok}`, `
    <p class="cicho">Adres startowy: ${esc(u.adres || "— (Ustawienia › Dojazdy)")}. Każda lekcja z dojazdem to kurs tam i z powrotem; km możesz poprawić.</p>
    <div class="karta" id="f-kursy"></div>
    <div class="rzad"><button class="btn" id="f-kal">Wczytaj ponownie z kalendarza</button><b class="rosnie prawo" id="f-razem"></b></div>
    <div class="rzad">${pole("Paliwo", `<select id="f-paliwo">${opcje(Object.entries(L.PALIWA), paliwo)}</select>`)}
      ${pole("Sposób liczenia", `<select id="f-metoda">${opcje(Object.entries(L.METODY), r0 ? r0.metoda : u.metoda)}</select>`)}</div>
    <div class="rzad tw">${pole("Spalanie (l/100 km)", `<input id="f-spal" inputmode="decimal" value="${L.km(v("spalanie", u.spalanie)).replace(",", ",")}">`, "p-wyl")}
      ${pole("Cena litra (zł)", `<input id="f-cena" inputmode="decimal" value="${r0 && r0.cena_litra ? L.doEdycji(r0.cena_litra) : ""}">`, "p-wyl")}
      ${pole("Benzyna przy LPG (l/100 km)", `<input id="f-bj" inputmode="decimal" value="${String(v("benzyna_na_lpg", u.benzyna_na_lpg)).replace(".", ",")}">`, "p-wyl p-lpg")}
      ${pole("Benzyna na rozruch (l)", `<input id="f-roz" inputmode="decimal" value="${String(v("rozruch", u.rozruch)).replace(".", ",")}">`, "p-wyl p-lpg")}
      ${pole("Cena benzyny (zł)", `<input id="f-cb" inputmode="decimal" value="${r0 && r0.cena_benzyny ? L.doEdycji(r0.cena_benzyny) : ""}">`, "p-wyl p-lpg")}
      ${pole("Paragony za paliwo (zł)", `<input id="f-par" inputmode="decimal" value="${r0 && r0.suma_paragonow ? L.doEdycji(r0.suma_paragonow) : ""}">`, "p-par")}
      ${pole("Paragony za benzynę (zł)", `<input id="f-parb" inputmode="decimal" value="${r0 && r0.paragony_benzyna ? L.doEdycji(r0.paragony_benzyna) : ""}">`, "p-par p-lpg")}
      ${pole("Przebieg w miesiącu (km)", `<input id="f-przeb" inputmode="decimal" value="${r0 && r0.przebieg ? L.km(r0.przebieg) : ""}">`, "p-par")}
      ${pole("Wliczane do kosztów (%)", `<input id="f-proc" inputmode="numeric" value="${r0 ? r0.procent : u.procent}">`)}</div>
    <p class="wynik" id="f-wynik"></p><p class="blad" id="f-blad"></p>
    <div class="rzad koniec">${r0 ? `<button class="btn niebezp" id="f-usun">Usuń</button>` : ""}<button class="btn" id="f-ew">Ewidencja</button>
      <button class="btn glowny" id="f-zapisz">${r0 ? "Zaktualizuj wydatek" : "Zapisz jako wydatek"}</button></div>`,
  el => {
    const kw = s => { const t = wartosc(el, s).trim(); return t ? L.parsujKwote(t) : 0; };
    const rysujKursy = () => {
      el.querySelector("#f-kursy").innerHTML = pozycje.length ? pozycje.map((p, i) => `<div class="kurs"><span class="rosnie">${L.dzienKrotko(p.data)} · ${esc(p.uczen)}<br><small class="cicho">${esc(p.adres || "—")}</small></span>
        <input data-i="${i}" inputmode="decimal" value="${L.km(p.km)}"><small>km</small></div>`).join("") : '<div class="cicho">Brak lekcji z dojazdem w tym miesiącu.</div>';
    };
    const odczytaj = () => {
      el.querySelectorAll("#f-kursy input").forEach(x => pozycje[Number(x.dataset.i)].km = L.zaokr(L.liczba(x.value), 1));
      const r = { miesiac, metoda: wartosc(el, "#f-metoda"), paliwo: wartosc(el, "#f-paliwo"), km: L.zaokr(pozycje.reduce((s, p) => s + p.km, 0), 1),
        spalanie: L.liczba(wartosc(el, "#f-spal")), cena_litra: kw("#f-cena"), suma_paragonow: kw("#f-par"), przebieg: L.liczba(wartosc(el, "#f-przeb")),
        procent: Math.min(100, Math.max(1, parseInt(wartosc(el, "#f-proc")) || 100)), benzyna_na_lpg: 0, rozruch: 0, cena_benzyny: 0, paragony_benzyna: 0,
        uruchomienia: L.URUCHOMIENIA_NA_KURS * pozycje.length, pozycje: JSON.stringify(pozycje) };
      if (r.paliwo === "lpg") Object.assign(r, { benzyna_na_lpg: L.liczba(wartosc(el, "#f-bj")), rozruch: L.liczba(wartosc(el, "#f-roz")), cena_benzyny: kw("#f-cb"), paragony_benzyna: kw("#f-parb") });
      [r.kwota] = L.obliczDojazdy(r);
      return r;
    };
    const przelicz = () => {
      const wyl = wartosc(el, "#f-metoda") !== "paragony", lpg = wartosc(el, "#f-paliwo") === "lpg";
      el.querySelectorAll(".p-wyl").forEach(x => x.style.display = wyl && (lpg || !x.classList.contains("p-lpg")) ? "" : "none");
      el.querySelectorAll(".p-par").forEach(x => x.style.display = !wyl && (lpg || !x.classList.contains("p-lpg")) ? "" : "none");
      el.querySelectorAll(".pole span").forEach(s => {
        if (s.textContent.startsWith("Spalanie")) s.textContent = lpg ? "Spalanie LPG (l/100 km)" : "Spalanie (l/100 km)";
        if (s.textContent.startsWith("Cena litra") || s.textContent.startsWith("Cena LPG")) s.textContent = lpg ? "Cena LPG (zł/l)" : "Cena litra (zł)";
        if (s.textContent.startsWith("Paragony za paliwo") || s.textContent.startsWith("Paragony za LPG")) s.textContent = lpg ? "Paragony za LPG (zł)" : "Paragony za paliwo (zł)";
      });
      try {
        const r = odczytaj(), [kwota, opis] = L.obliczDojazdy(r);
        el.querySelector("#f-razem").textContent = `${pozycje.length} ${L.odmiana(pozycje.length, "kurs", "kursy", "kursów")} · ${L.km(r.km)} km`;
        el.querySelector("#f-wynik").textContent = `${opis} = ${zl(kwota)}`;
      } catch (e) { el.querySelector("#f-wynik").textContent = e.message; }
    };
    rysujKursy(); przelicz();
    el.addEventListener("input", przelicz); el.addEventListener("change", przelicz);
    el.querySelector("#f-kal").onclick = () => { pozycje = L.kursyMiesiaca(D, rok, mies); rysujKursy(); przelicz(); };
    el.querySelector("#f-ew").onclick = () => {
      let r; try { r = odczytaj(); } catch (e) { el.querySelector("#f-blad").textContent = e.message; return; }
      const [, opis] = L.obliczDojazdy(r);
      drukuj(`<div class="rachunek"><h2>Ewidencja dojazdów do uczniów – ${L.MIESIACE[mies - 1].toLowerCase()} ${rok}</h2>
        <p>${esc(L.wystawca(D).nazwa)}<br>Samochód: ${esc(u.samochod || "—")} (${esc(L.PALIWA[r.paliwo])})<br>Adres startowy: ${esc(u.adres || "—")}</p>
        <table class="r-tab"><tr><th>Lp.</th><th>Data</th><th>Uczeń</th><th>Trasa</th><th class="r-k">km</th></tr>
        ${pozycje.map((p, i) => `<tr><td>${i + 1}</td><td>${L.formatData(p.data)}</td><td>${esc(p.uczen)}</td><td>${esc(u.adres)} → ${esc(p.adres || "—")} → ${esc(u.adres)}</td><td class="r-k">${L.km(p.km)}</td></tr>`).join("")}
        <tr><td colspan="4" class="r-k"><b>Razem</b></td><td class="r-k"><b>${L.km(r.km)}</b></td></tr></table>
        <p>Koszt paliwa: ${esc(opis)} = <b>${zl(r.kwota)}</b></p></div>`, `ewidencja-dojazdow ${miesiac}`);
    };
    if (r0) el.querySelector("#f-usun").onclick = async () => {
      if (await potwierdz(`Usunąć rozliczenie dojazdów za ${miesiac} razem z wydatkiem (${zl(r0.kwota)})?`, "Usuń", "Anuluj", true))
        await wykonaj(async () => {
          if (r0.id_wydatku) sprawdz(await sb.from("wydatki").delete().eq("id", r0.id_wydatku));
          sprawdz(await sb.from("rozliczenia_dojazdow").delete().eq("miesiac", miesiac));
        }, "Usunięto rozliczenie") && zamknijArkusz();
    };
    el.querySelector("#f-zapisz").onclick = async () => {
      let r; try { r = odczytaj(); } catch (e) { el.querySelector("#f-blad").textContent = e.message; return; }
      if (r.kwota <= 0) { el.querySelector("#f-blad").textContent = "Kwota rozliczenia wynosi 0 zł – uzupełnij km, spalanie, ceny lub paragony."; return; }
      const [od, doo] = L.zakresMiesiaca(rok, mies), d = L.dzis();
      const dzien = d < od ? od : d > doo ? doo : d;
      const stary = r0 && r0.id_wydatku ? D.wydatki.find(e => e.id === r0.id_wydatku) : null;
      const wyd = { id: stary ? stary.id : L.noweId(), data: stary ? stary.data : dzien, kwota: r.kwota, kategoria: "Dojazdy",
        opis: L.opisWydatkuDojazdow(r), dokument: stary?.dokument || `ewidencja dojazdów ${miesiac}` };
      await wykonaj(async () => {
        await upsert("wydatki", wyd, "id");
        await upsert("rozliczenia_dojazdow", { ...r, id_wydatku: wyd.id }, "user_id,miesiac");
      }, "Zapisano rozliczenie dojazdów") && zamknijArkusz();
    };
  });
}

// ================================================================ WIĘCEJ: limity, podsumowanie, ustawienia
function wWiecej() {
  return ["Więcej", "", `<div class="karta menu-lista">
    <button data-karta="limity">Limity przychodu<small>kwartalne limity działalności nierejestrowanej</small></button>
    <button data-karta="podsumowanie">Podsumowanie<small>przychody, wydatki i bilans miesiąca</small></button>
    <button data-karta="ustawienia">Ustawienia<small>wystawca, rachunki, limity, kategorie, dojazdy, wygląd</small></button>
    <button data-akcja="odswiez">Odśwież dane<small>pobierz najnowsze dane z chmury</small></button>
    <button data-akcja="wyloguj">Wyloguj<small>${esc(sesjaEmail)}</small></button></div>`];
}
function wLimity() {
  const p1 = parseInt(ust("prog1", "75")), p2 = parseInt(ust("prog2", "90")), akt = L.kwartalZDaty(L.dzis());
  let h = `<div class="nawigacja"><button class="btn-ik" data-akcja="rok" data-k="-1">${ikona("lewo")}</button><b>${stan.rokLimity}</b>
    <button class="btn-ik" data-akcja="rok" data-k="1">${ikona("prawo")}</button></div>`;
  if (ust("bez_dzialalnosci_60", "1") !== "1") h += `<p class="zle-blok">W Ustawieniach zaznaczono działalność gospodarczą w ostatnich 60 miesiącach – działalność nierejestrowana wtedy nie przysługuje.</p>`;
  h += '<div class="kwartaly">';
  for (let i = 1; i <= 4; i++) {
    const kw = `${stan.rokLimity}-Q${i}`, st = L.statKwartalu(D, kw);
    h += `<div class="karta ${kw === akt ? "aktualny" : ""}"><b>${L.nazwaKwartalu(kw)}</b>`;
    if (!st.limit) { h += `<p class="cicho">Brak płacy minimalnej na ${stan.rokLimity} r. – uzupełnij w Ustawieniach.</p></div>`; continue; }
    const kolor = st.procent >= p2 ? "zle" : st.procent >= p1 ? "ostrz" : "dobre";
    h += `<div class="pasek"><i class="${kolor}" style="width:${Math.min(100, st.procent)}%"></i><i class="prognoza" style="width:${Math.min(100, st.procentPrognozy)}%"></i>
      <b style="left:${p1}%"></b><b style="left:${p2}%"></b></div>
      <div class="rzad miedzy"><span>${zl(st.biezacy)}</span><span class="cicho">${st.procent.toFixed(0)}%</span></div>
      <div class="cicho">Limit ${zl(st.limit)} · pozostało ${zl(Math.max(0, st.limit - st.biezacy))}</div>
      <div class="cicho">Prognoza z zaplanowanymi: ${zl(st.prognoza)} (${st.procentPrognozy.toFixed(0)}%)</div>
      ${st.procent >= p1 ? `<p class="ostrz-blok">Wykorzystano ponad ${st.procent >= p2 ? p2 : p1}% limitu.</p>` : ""}
      ${st.prognoza > st.limit ? `<p class="zle-blok">Prognoza z zaplanowanymi lekcjami przekracza limit.</p>` : ""}
      <button class="btn maly" data-akcja="inne" data-kw="${kw}">Inne przychody: ${zl(st.inne)}</button></div>`;
  }
  h += `</div><p class="cicho">Limit kwartalny to 225% płacy minimalnej. Narzędzie pomocnicze – nie jest poradą prawną ani podatkową.</p>`;
  return ["Limity", `<button class="btn-ik" data-karta="wiecej">${ikona("lewo")}</button>`, h];
}
function arkuszInnych(kw) {
  const t = D.przychody_inne.find(x => x.kwartal === kw);
  otworzArkusz(`Inne przychody – ${L.nazwaKwartalu(kw)}`, `<p class="cicho">Przychody z działalności nierejestrowanej spoza lekcji, liczone do limitu kwartału.</p>
    ${pole("Kwota (zł)", `<input id="f-kwota" inputmode="decimal" value="${t ? L.doEdycji(t.kwota) : ""}">`)}<p class="blad" id="f-blad"></p>
    <div class="rzad koniec"><button class="btn glowny" id="f-zapisz">Zapisz</button></div>`, el => {
    el.querySelector("#f-zapisz").onclick = async () => {
      let g; try { g = L.parsujKwote(wartosc(el, "#f-kwota") || "0"); } catch { el.querySelector("#f-blad").textContent = "Podaj poprawną kwotę."; return; }
      await wykonaj(async () => g > 0 ? upsert("przychody_inne", { kwartal: kw, kwota: g }, "user_id,kwartal")
        : sprawdz(await sb.from("przychody_inne").delete().eq("kwartal", kw)), "Zapisano") && zamknijArkusz();
    };
  });
}
function wPodsumowanie() {
  const [od, doo] = L.zakresMiesiaca(stan.r, stan.m);
  const ls = D.lekcje.filter(l => l.data >= od && l.data <= doo && L.ROZLICZALNE.includes(l.status));
  const przych = ls.reduce((s, l) => s + l.cena, 0), wyd = D.wydatki.filter(e => e.data >= od && e.data <= doo);
  const sWyd = wyd.reduce((s, e) => s + e.kwota, 0), wpl = D.wplaty.filter(w => w.data >= od && w.data <= doo).reduce((s, w) => s + w.kwota, 0);
  const bil = przych - sWyd, kat = {}, ucz = {};
  wyd.forEach(e => kat[e.kategoria || "Inne"] = (kat[e.kategoria || "Inne"] || 0) + e.kwota);
  ls.forEach(l => { const k = l.id_ucznia; ucz[k] = ucz[k] || [0, 0]; ucz[k][0]++; ucz[k][1] += l.cena; });
  const tabela = (wiersze) => wiersze.length ? `<table class="tab">${wiersze.map(w => `<tr>${w.map((c, i) => `<td class="${i ? "prawo" : ""}">${c}</td>`).join("")}</tr>`).join("")}</table>` : '<div class="cicho">Brak danych.</div>';
  const h = naglowekMiesiaca() + `<div class="kafle">${kafel("Przychód", zl(przych), "lekcje odbyte")}${kafel("Wydatki", zl(sWyd), `${wyd.length} pozycji`)}
    ${kafel("Bilans", zl(bil), "przychód − wydatki", bil >= 0 ? "dobre" : "zle")}${kafel("Wpłaty", zl(wpl), "otrzymane w miesiącu")}</div>
    <p class="cicho">Zrealizowane, jeszcze nierozliczone (na koniec miesiąca): ${zl(L.oczekujace(D, doo))}</p>
    <h3>Przychód wg uczniów</h3><div class="karta">${tabela(Object.entries(ucz).sort((a, b) => b[1][1] - a[1][1]).map(([id, [n, s]]) => [esc(L.nazwaUcznia(D.uczniowie.find(u => u.id === id))), n, zl(s)]))}</div>
    <h3>Wydatki wg kategorii</h3><div class="karta">${tabela(Object.entries(kat).sort((a, b) => b[1] - a[1]).map(([k, s]) => [esc(k), zl(s)]))}</div>`;
  return ["Podsumowanie", `<button class="btn-ik" data-karta="wiecej">${ikona("lewo")}</button>`, h];
}

const SEKCJE = { wystawca: "Wystawca", rachunki: "Rachunki i numeracja", limity: "Limity", kategorie: "Kategorie wydatków", dojazdy: "Dojazdy", wyglad: "Wygląd" };
function wUstawienia() {
  return ["Ustawienia", `<button class="btn-ik" data-karta="wiecej">${ikona("lewo")}</button>`, `<div class="karta menu-lista">
    ${Object.entries(SEKCJE).map(([k, n]) => `<button data-akcja="sekcja" data-s="${k}">${n}</button>`).join("")}</div>
    <p class="cicho">Ustawienia są wspólne z wersją na komputer (oprócz wyglądu).</p>`];
}
function arkuszUstawien(s) {
  const zapisz = (fn) => async el => { el.querySelector("#f-zapisz").onclick = async () => {
    try { await wykonaj(() => fn(el), "Zapisano ustawienia") && zamknijArkusz(); } catch (e) { el.querySelector("#f-blad").textContent = e.message; } }; };
  const stopka = '<p class="blad" id="f-blad"></p><div class="rzad koniec"><button class="btn glowny" id="f-zapisz">Zapisz</button></div>';
  if (s === "wystawca") {
    const w = L.wystawca(D), pola = [["nazwa", "Imię i nazwisko / nazwa"], ["adres", "Adres"], ["miejscowosc", "Kod i miejscowość"], ["nip", "NIP / PESEL (opcjonalnie)"],
      ["telefon", "Telefon"], ["email", "E-mail"], ["konto", "Numer konta"]];
    otworzArkusz(SEKCJE[s], pola.map(([k, n]) => pole(n, `<input id="w-${k}" value="${esc(w[k])}">`)).join("") + stopka,
      zapisz(async el => { for (const [k] of pola) await ustaw("wystawca." + k, wartosc(el, "#w-" + k).trim()); }));
  } else if (s === "rachunki") {
    const od = ust("numeracja_od", "month"), kn = L.kluczNumeracji(L.dzis(), od);
    const ostatni = D.numeracja.find(x => x.klucz === kn)?.ostatni || 0;
    otworzArkusz(SEKCJE[s], `${pole("Domyślna stawka za lekcję (zł)", `<input id="r-stawka" inputmode="decimal" value="${L.doEdycji(parseInt(ust("stawka", "8000")))}">`)}
      ${pole("Tytuł dokumentu", `<input id="r-tytul" value="${esc(ust("tytul_dokumentu", "POTWIERDZENIE WPŁATY"))}">`)}
      ${pole("Szablon numeru", `<input id="r-szablon" value="${esc(ust("szablon_numeru", "R/{nr}/{mm}/{rrrr}"))}">`)}
      <p class="cicho">{nr} numer, {mm} miesiąc 01–12, {m} miesiąc bez zera, {rrrr} rok, {rr} rok dwucyfrowy</p>
      <div class="rzad">${pole("Numeracja od nowa", `<select id="r-od">${opcje([["month", "co miesiąc"], ["year", "co rok"]], od)}</select>`)}
      ${pole("Min. cyfr", `<input id="r-cyfry" inputmode="numeric" value="${esc(ust("cyfry_numeru", "1"))}">`)}</div>
      ${pole("Ostatni numer w bieżącym okresie", `<input id="r-ost" inputmode="numeric" value="${ostatni}">`)}<p class="cicho" id="r-podglad"></p>${stopka}`,
    el => {
      const podglad = () => el.querySelector("#r-podglad").textContent = "Następny numer: " +
        L.formatujNumer(wartosc(el, "#r-szablon"), (parseInt(wartosc(el, "#r-ost")) || 0) + 1, L.dzis(), parseInt(wartosc(el, "#r-cyfry")) || 1);
      el.addEventListener("input", podglad); podglad();
      zapisz(async el => {
        await ustaw("stawka", String(L.parsujKwote(wartosc(el, "#r-stawka"))));
        await ustaw("tytul_dokumentu", wartosc(el, "#r-tytul").trim()); await ustaw("szablon_numeru", wartosc(el, "#r-szablon").trim());
        await ustaw("numeracja_od", wartosc(el, "#r-od")); await ustaw("cyfry_numeru", String(Math.max(1, parseInt(wartosc(el, "#r-cyfry")) || 1)));
        await upsert("numeracja", { klucz: L.kluczNumeracji(L.dzis(), wartosc(el, "#r-od")), ostatni: Math.max(0, parseInt(wartosc(el, "#r-ost")) || 0) }, "user_id,klucz");
      })(el);
    });
  } else if (s === "limity") {
    const place = D.place_minimalne.sort((a, b) => a.rok - b.rok).map(p => `${p.rok} = ${L.doEdycji(p.kwota)}`).join("\n");
    otworzArkusz(SEKCJE[s], `${pole("Płaca minimalna (rok = kwota brutto zł)", `<textarea id="l-place" rows="4">${esc(place)}</textarea>`)}
      <p class="cicho">Jedna linia na rok, np. „2026 = 4806,00”. Limit kwartalny to 225% płacy minimalnej.</p>
      <div class="rzad">${pole("Pierwszy próg (%)", `<input id="l-p1" inputmode="numeric" value="${esc(ust("prog1", "75"))}">`)}${pole("Drugi próg (%)", `<input id="l-p2" inputmode="numeric" value="${esc(ust("prog2", "90"))}">`)}</div>
      <label class="przelacznik"><input type="checkbox" id="l-bez" ${ust("bez_dzialalnosci_60", "1") === "1" ? "checked" : ""}> W ostatnich 60 miesiącach nie prowadziłem(-am) działalności gospodarczej</label>${stopka}`,
    zapisz(async el => {
      const wiersze = [];
      for (const linia of wartosc(el, "#l-place").split("\n").map(x => x.trim()).filter(Boolean)) {
        const m = linia.match(/^(\d{4})\s*[=:]\s*(.+)$/); if (!m) throw new Error(`Niepoprawna linia: ${linia}`);
        wiersze.push({ rok: Number(m[1]), kwota: L.parsujKwote(m[2]) });
      }
      sprawdz(await sb.from("place_minimalne").delete().gte("rok", 0));
      if (wiersze.length) sprawdz(await sb.from("place_minimalne").insert(wiersze));
      await ustaw("prog1", String(parseInt(wartosc(el, "#l-p1")) || 75)); await ustaw("prog2", String(parseInt(wartosc(el, "#l-p2")) || 90));
      await ustaw("bez_dzialalnosci_60", el.querySelector("#l-bez").checked ? "1" : "0");
    }));
  } else if (s === "kategorie") {
    const k = D.slowniki.filter(x => x.rodzaj === "kategoria_wydatku").sort((a, b) => a.kolejnosc - b.kolejnosc).map(x => x.nazwa).join("\n");
    otworzArkusz(SEKCJE[s], pole("Kategorie – jedna w linii", `<textarea id="k-t" rows="8">${esc(k)}</textarea>`) + stopka, zapisz(async el => {
      const nazwy = [...new Set(wartosc(el, "#k-t").split("\n").map(x => x.trim()).filter(Boolean))];
      const lista = nazwy.length ? nazwy : ["Inne"];
      sprawdz(await sb.from("slowniki").delete().eq("rodzaj", "kategoria_wydatku"));
      sprawdz(await sb.from("slowniki").insert(lista.map((n, i) => ({ rodzaj: "kategoria_wydatku", nazwa: n, kolejnosc: i }))));
    }));
  } else if (s === "dojazdy") {
    const u = L.ustawieniaDojazdow(D);
    otworzArkusz(SEKCJE[s], `${pole("Adres startowy", `<input id="d-adres" placeholder="${esc(u.adres)}" value="${esc(ust("dojazdy.adres_startowy"))}">`)}
      <p class="cicho">Skąd wyjeżdżasz do uczniów. Puste = adres wystawcy.</p>
      ${pole("Samochód", `<input id="d-auto" value="${esc(u.samochod)}" placeholder="np. Skoda Fabia, SWD 12345">`)}
      <div class="rzad">${pole("Paliwo", `<select id="d-paliwo">${opcje(Object.entries(L.PALIWA), u.paliwo)}</select>`)}${pole("Spalanie (l/100 km)", `<input id="d-spal" inputmode="decimal" value="${String(u.spalanie).replace(".", ",")}">`)}</div>
      <div class="rzad" id="d-lpg">${pole("Benzyna przy LPG (l/100 km)", `<input id="d-bj" inputmode="decimal" value="${String(u.benzyna_na_lpg).replace(".", ",")}">`)}
      ${pole("Benzyna na rozruch (l)", `<input id="d-roz" inputmode="decimal" value="${String(u.rozruch).replace(".", ",")}">`)}</div>
      <div class="rzad">${pole("Domyślny sposób liczenia", `<select id="d-metoda">${opcje(Object.entries(L.METODY), u.metoda)}</select>`)}${pole("Do kosztów (%)", `<input id="d-proc" inputmode="numeric" value="${u.procent}">`)}</div>
      <p class="cicho">Zasady zaliczania kosztów prywatnego samochodu potwierdź w urzędzie skarbowym lub u księgowej.</p>${stopka}`,
    el => {
      const w = () => el.querySelector("#d-lpg").style.display = wartosc(el, "#d-paliwo") === "lpg" ? "" : "none";
      el.querySelector("#d-paliwo").onchange = w; w();
      zapisz(async el => {
        const proc = parseInt(wartosc(el, "#d-proc")) || 100;
        if (proc < 1 || proc > 100) throw new Error("Procent musi być od 1 do 100.");
        for (const [k, v] of [["adres_startowy", wartosc(el, "#d-adres").trim()], ["samochod", wartosc(el, "#d-auto").trim()], ["paliwo", wartosc(el, "#d-paliwo")],
          ["spalanie", String(L.liczba(wartosc(el, "#d-spal"), 6.5))], ["benzyna_na_lpg", String(L.liczba(wartosc(el, "#d-bj"), 0.7))],
          ["rozruch", String(L.liczba(wartosc(el, "#d-roz"), 0.05))], ["metoda", wartosc(el, "#d-metoda")], ["procent", String(proc)]]) await ustaw("dojazdy." + k, v);
      })(el);
    });
  } else if (s === "wyglad") {
    otworzArkusz(SEKCJE[s], `${pole("Motyw (tylko ten telefon)", `<select id="m-m">${opcje([["systemowy", "Jak w telefonie"], ["ciemny", "Ciemny"], ["jasny", "Jasny"]], localStorage.getItem("motyw") || "systemowy")}</select>`)}
      <div class="rzad koniec"><button class="btn glowny" id="f-zapisz">Zastosuj</button></div>`, el => {
      el.querySelector("#f-zapisz").onclick = () => { localStorage.setItem("motyw", wartosc(el, "#m-m")); ustawMotyw(); zamknijArkusz(); };
    });
  }
}

// ================================================================ start, logowanie
let sesjaEmail = "";
function ustawMotyw() {
  const m = localStorage.getItem("motyw") || "systemowy";
  const ciemny = m === "ciemny" || (m === "systemowy" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.motyw = ciemny ? "ciemny" : "jasny";
  document.querySelector('meta[name="theme-color"]').content = ciemny ? "#111317" : "#f3f4f6";
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ustawMotyw);
function ekranLogowania(blad = "") {
  $("#aplikacja").hidden = true;
  const e = $("#logowanie"); e.hidden = false;
  e.innerHTML = `<div class="logo-duze">${ikona("uczniowie")}</div><h1>Korepetycje</h1>
    <p class="cicho">Zaloguj się kontem z Supabase – tym samym co w programie na komputerze.</p>
    <form id="f-log">${pole("E-mail", `<input id="l-email" type="email" autocomplete="username" required>`)}
    ${pole("Hasło", `<input id="l-haslo" type="password" autocomplete="current-password" required>`)}
    <p class="blad">${esc(blad)}</p><button class="btn glowny szeroki" type="submit">Zaloguj</button></form>`;
  $("#f-log").onsubmit = async ev => {
    ev.preventDefault();
    pokazLadowanie(true);
    const { error } = await sb.auth.signInWithPassword({ email: $("#l-email").value.trim(), password: $("#l-haslo").value });
    pokazLadowanie(false);
    if (error) ekranLogowania(/invalid/i.test(error.message) ? "Nieprawidłowy e-mail lub hasło." : error.message);
    else start();
  };
}
async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return ekranLogowania();
  sesjaEmail = session.user?.email || "";
  $("#logowanie").hidden = true; $("#aplikacja").hidden = false;
  pokazLadowanie(true);
  try {
    const bladWersji = await bladWersjiBazy();
    if (bladWersji) {                    // za stara baza: nie pokazujemy ani nie zapisujemy danych, które mogłyby się nie zgadzać
      pokazLadowanie(false);
      $("#tresc").innerHTML = `<p class="zle-blok">${esc(bladWersji)}<br>Dane są bezpieczne – aplikacja poczeka na aktualizację bazy.</p>`
        + `<button class="btn" onclick="location.reload()">Sprawdź ponownie</button>`;
      return;
    }
    await zaladuj();
  }
  catch (e) {
    pokazLadowanie(false);
    if (/JWT|token|401/i.test(e.message || "")) { await sb.auth.signOut(); return ekranLogowania("Sesja wygasła – zaloguj się ponownie."); }
    $("#tresc").innerHTML = `<p class="zle-blok">Nie udało się pobrać danych: ${esc(e.message)}<br>${navigator.onLine ? "" : "Brak internetu."}</p><button class="btn" data-akcja="odswiez">Spróbuj ponownie</button>`;
    return;
  }
  pokazLadowanie(false);
  rysuj();
  sb.channel("zmiany").on("postgres_changes", { event: "*", schema: "public" }, odswiezPozniej).subscribe();
  sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") ekranLogowania("Sesja wygasła – zaloguj się ponownie."); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) odswiezPozniej(); });
}
ustawMotyw();
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
start();
