// Service worker de la page « 💪 Séance » (étape 8.1 : séance utilisable sans réseau en salle).
// NE PAS ÉDITER webapp/seance-sw.js À LA MAIN : il est produit à partir de ce modèle par
// scripts/construire_page_seance.py, avec une VERSION tirée du contenu de la page (une nouvelle
// page = un nouveau cache, l'ancien est effacé).
//
// À mettre en ligne À CÔTÉ de la page, sous le nom seance-sw.js (même dossier, même origine, HTTPS).
// La page l'enregistre avec une portée limitée à SA propre adresse : il ne touche à rien d'autre
// sur le même site (ancienne Mini App, appli…). Sans ce fichier, la page marche comme avant.
//
// Ce qu'il garde :
// - la page elle-même : réseau d'abord (4 s au plus), sinon la copie gardée. La séance est dans le
//   fragment (#z=…), jamais envoyé au réseau : une seule copie sert pour toutes les séances,
//   et l'ancien ?z= est ignoré (ignoreSearch) ;
// - le script de Telegram (telegram-web-app.js) : la copie gardée d'abord, mise à jour en fond.
"use strict";
const VERSION = "seance-0468c56d9728";
const SDK = "https://telegram.org/js/telegram-web-app.js";
const PAGE = self.registration.scope;  // adresse de la page (portée = la page seule)
const DELAI_RESEAU_MS = 4000;

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(VERSION).then((cache) => Promise.all([
    cache.add(new Request(PAGE, { cache: "reload" })).catch(() => {}),
    cache.add(new Request(SDK, { mode: "no-cors" })).catch(() => {}),
  ])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys()
    .then((cles) => Promise.all(cles.filter((c) => c.startsWith("seance-") && c !== VERSION).map((c) => caches.delete(c))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin + url.pathname === PAGE) ev.respondWith(pageReseauDAbord(req));
  else if (req.url === SDK) ev.respondWith(sdkGardeDAbord(req));
  // tout le reste : le navigateur fait comme d'habitude
});

function avecDelai(promesse, ms) {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error("réseau trop lent")), ms);
    promesse.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); ko(e); });
  });
}

async function pageReseauDAbord(req) {
  const cache = await caches.open(VERSION);
  const reseau = fetch(req).then((rep) => {
    if (rep && rep.ok && rep.type === "basic") cache.put(PAGE, rep.clone()).catch(() => {});
    return rep;
  });
  try {
    return await avecDelai(reseau, DELAI_RESEAU_MS);
  } catch (e) {
    const garde = await cache.match(PAGE, { ignoreSearch: true });
    return garde || reseau;
  }
}

async function sdkGardeDAbord(req) {
  const cache = await caches.open(VERSION);
  const garde = await cache.match(SDK);
  const reseau = fetch(new Request(SDK, { mode: "no-cors" })).then((rep) => {
    if (rep && (rep.ok || rep.type === "opaque")) cache.put(SDK, rep.clone()).catch(() => {});
    return rep;
  });
  if (garde) { reseau.catch(() => {}); return garde; }
  return reseau;
}
