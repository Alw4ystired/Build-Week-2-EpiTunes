// Importo da common.js solo quello che questo file usa davvero
import {
  INIT_PAGE,
  GET_FAVOURITES,
  TOGGLE_FAVOURITE,
  IS_FAVOURITE,
  GET_HISTORY,
  RENDER_SIDEBAR_FAVS,
  AGGIORNA_CARD_PLAY,

  creaElemento,
  FETCH_JSON,
  BIG_ART,
  FORMAT_TIME,
  Track,
} from "./common.js";

/* ============================================================
   home.js — costruzione della Home
   ============================================================

   COSA FA
   1) INIT_PAGE("home")  // monta sidebar + player
   2) Costruisce la .home in quest'ordine:
        - Benvenuto (data di oggi, titolo, sottotitolo)
        - "I tuoi preferiti" (da getFavourites()) -- solo se non vuota
        - "Riascolta"        (da getHistory())    -- solo se non vuota
        - Due pannelli affiancati:
            "In primo piano" -> il primo dei suggerimenti hits, con "Riproduci mix"
            "In riproduzione" -> la coda vera del player, si aggiorna a ogni cambio brano
        - "Suggerimenti pop" / "rock" / "hits" (fetch in PARALLELO con Promise.allSettled)
   3) Ogni card è una Track: cover, titolo, artista, bottone play, bottone cuore (favourite)
   4) Click card -> window.player.play(track, riga)
*/

const PLAYER = INIT_PAGE("home");

const HOME = document.querySelector(".home");
HOME.replaceChildren(); // tolgo il commento segnaposto dell'HTML

/* ============================ Contenitori ============================ */

// Tengo dei contenitori fissi cosi' le sezioni restano nell'ordine giusto
// anche se alcune arrivano dopo (i suggerimenti dipendono dalla rete).
const BENVENUTO = creaElemento("header", "mb-2", HOME);
const RIGHE_PERSONALI = creaElemento("div", undefined, HOME); // preferiti + riascolta
const PANNELLI = creaElemento("div", "row g-3 mt-4", HOME);   // primo piano + coda, affiancati da desktop
const RIGHE_SUGGERITE = creaElemento("div", undefined, HOME);

/* ============================ Benvenuto ============================ */

// toLocaleDateString con "it-IT" scrive la data in italiano: "mercoledì 26 novembre"
const OGGI = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
creaElemento("p", "eyebrow text-uppercase fw-semibold small mb-2", BENVENUTO, `La tua libreria · ${OGGI}`);
creaElemento("h1", "fw-bolder m-0", BENVENUTO, "La musica che ami.");
creaElemento("p", "text-body-secondary mt-2 mb-0", BENVENUTO, "Il tuo spazio, il tuo ritmo. Riparti da dove eri rimasto.");

/*
  TESTATA_SEZIONE(parent, titolo, nota)
  - Riga con il titolo a sinistra e una nota piccola a destra (facoltativa).
*/
const TESTATA_SEZIONE = (parent, titolo, nota) => {
  const HEAD = creaElemento("div", "d-flex align-items-baseline justify-content-between gap-3 mt-5 mb-3", parent);
  creaElemento("h2", "fs-5 fw-bold m-0", HEAD, titolo);
  if (nota) {
    creaElemento("span", "small text-body-secondary text-nowrap", HEAD, nota);
  }
  return HEAD;
};

/*
  renderRow(rowTitle, tracks, idSezione, parent, nota)
  - crea una <section> con testata e una griglia di card (.card-grid in app.css)
  - una card per ogni track: cover, titolo, artista, bottone play, bottone cuore
  - se l'array è vuoto non crea niente (nessuna sezione vuota con solo il titolo)
*/
const RENDER_ROW = (rowTitle, tracks, idSezione, parent = RIGHE_SUGGERITE, nota) => {
  if (!tracks || tracks.length === 0) return;

  const SECTION = creaElemento("section", undefined, parent);
  if (idSezione) {
    SECTION.id = idSezione;
  }
  TESTATA_SEZIONE(SECTION, rowTitle, nota);

  // Griglia Bootstrap: 2 card per riga su telefono, 3-4 su tablet, 5-6 su portatile, 8 su schermi grandi.
  // Le colonne calano ma la copertina resta quadrata (aspect-ratio in app.css).
  const GRID = creaElemento("div", "row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 row-cols-xl-6 row-cols-xxl-8 g-2 g-md-3", SECTION);

  tracks.forEach((track) => {
    const COLUMN = creaElemento("div", "col", GRID);
    const CARD = creaElemento("article", "card h-100 border-0 position-relative p-2", COLUMN);
    CARD.dataset.trackId = String(track.id);

    // Cover: dentro ci sono anche cuore e play, cosi' restano sempre sopra la copertina
    const IMAGE_WRAP = creaElemento("div", "card-image-wrap position-relative w-100 overflow-hidden", CARD);
    const IMAGE = creaElemento(
      "img",
      "w-100 h-100 object-fit-cover d-block",
      IMAGE_WRAP
    );

    IMAGE.src = BIG_ART(track.cover);
    IMAGE.alt = track.title ?? "";
    IMAGE.loading = "lazy";

    // Titolo e artista
    creaElemento("p", "card-title fw-bold text-truncate mt-0 mb-1 px-1", CARD, track.title);
    creaElemento("p", "card-sub text-body-secondary text-truncate small mb-1 px-1", CARD, track.artist);

    // Cuore
    const GIA_PREFERITO = IS_FAVOURITE(track.id);
    const FAV_BUTTON = creaElemento(
      "button",
      GIA_PREFERITO ? "card-fav position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center is-fav" : "card-fav position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center",
      IMAGE_WRAP,
      GIA_PREFERITO ? "♥" : "♡"
    );

    FAV_BUTTON.type = "button";
    FAV_BUTTON.setAttribute(
      "aria-label",
      `${GIA_PREFERITO ? "Rimuovi" : "Aggiungi"} ${track.title} ${GIA_PREFERITO ? "dai" : "ai"
      } preferiti`
    );
    //clicco dei favoriti
    FAV_BUTTON.addEventListener("click", (event) => {
      event.stopPropagation();

      // Aggiunge o rimuove il brano dai preferiti
      TOGGLE_FAVOURITE(track);
      const ORA = IS_FAVOURITE(track.id); // rileggo lo stato aggiornato
      FAV_BUTTON.classList.toggle("is-fav", ORA);
      FAV_BUTTON.textContent = ORA ? "♥" : "♡";
      RENDER_SIDEBAR_FAVS(); // aggiorno anche la lista nella sidebar
      AGGIORNA_CUORI(track);
      AGGIORNA_PREFERITI();
    });

    // Bottone play (compare al passaggio del mouse, vedi .card:hover in app.css)
    const PLAY_BUTTON = creaElemento("button", "card-play position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center", IMAGE_WRAP, "▶");
    PLAY_BUTTON.type = "button";
    PLAY_BUTTON.setAttribute(
      "aria-label",
      `Riproduci ${track.title} di ${track.artist}`
    );
    PLAY_BUTTON.disabled = !track.previewUrl;

    PLAY_BUTTON.addEventListener("click", (event) => {
      event.stopPropagation();

      if (track.previewUrl) {
        PLAYER.play(track, tracks); // la coda e' la riga da cui parto
      }
    });

    // Click sulla card per riprodurre
    CARD.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;

      if (track.previewUrl) {
        PLAYER.play(track, tracks); // la coda e' la riga da cui parto
      }
    });
  });

  AGGIORNA_CARD_PLAY(); // le card nuove partono con l'icona giusta (▶ o ⏸)
  return SECTION;
};

/*
  NOTA_PREFERITI(n)
  - "1 brano salvato" / "8 brani salvati"
*/
const NOTA_PREFERITI = (n) => (n === 1 ? "1 brano salvato" : `${n} brani salvati`);

const AGGIORNA_PREFERITI = () => {
  const VECCHIA = document.querySelector("#sezione-preferiti");
  if (VECCHIA) {
    VECCHIA.remove();
  }

  const PREFERITI = GET_FAVOURITES();
  RENDER_ROW("I tuoi preferiti", PREFERITI, "sezione-preferiti", RIGHE_PERSONALI, NOTA_PREFERITI(PREFERITI.length));

  // I preferiti stanno sempre in cima, prima di "Riascolta"
  const NUOVA = document.querySelector("#sezione-preferiti");
  if (NUOVA) {
    RIGHE_PERSONALI.prepend(NUOVA);
  }
};

const AGGIORNA_CUORI = (track) => {
  const ORA = IS_FAVOURITE(track.id);
  const CARTE = document.querySelectorAll(`.card[data-track-id="${track.id}"]`);

  CARTE.forEach((carta) => {
    const CUORE = carta.querySelector(".card-fav");

    CUORE.classList.toggle("is-fav", ORA);
    if (ORA) {
      CUORE.textContent = "♥";
    } else {
      CUORE.textContent = "♡";
    }
  });
};

/* ---------- I tuoi preferiti ---------- */

AGGIORNA_PREFERITI(); // se è vuoto, renderRow non mostra niente

/* ---------- Riascolta (riprodotti di recente) ---------- */

RENDER_ROW("Riascolta", GET_HISTORY(), "sezione-recenti", RIGHE_PERSONALI, "La tua rotazione recente");

/* ============================ Pannelli ============================ */

/* ---------- In primo piano ---------- */

// Colonne Bootstrap: uno sotto l'altro fino a 992px, poi affiancati (7 + 5 dodicesimi)
const PRIMO_PIANO_COL = creaElemento("div", "col-12 col-lg-7", PANNELLI);
const PRIMO_PIANO = creaElemento("section", "h-100 bg-body-tertiary border rounded-4 p-4", PRIMO_PIANO_COL);
TESTATA_SEZIONE(PRIMO_PIANO, "In primo piano", "SCELTA PER TE").classList.replace("mt-5", "mt-0");
const PRIMO_PIANO_CORPO = creaElemento("div", "d-flex align-items-center gap-3", PRIMO_PIANO);
creaElemento("p", "text-body-secondary m-0", PRIMO_PIANO_CORPO, "Caricamento...");

/*
  RENDER_PRIMO_PIANO(brani)
  - Mette in evidenza il primo brano della lista con copertina, titolo,
    artista e un bottone che fa partire tutta la lista come coda ("mix").
  - Se la lista e' vuota usa preferiti o cronologia; se non c'e' niente, nasconde il pannello.
*/
const RENDER_PRIMO_PIANO = (brani) => {
  let lista = brani.filter((t) => t.previewUrl);
  if (lista.length === 0) lista = GET_FAVOURITES();
  if (lista.length === 0) lista = GET_HISTORY();

  PRIMO_PIANO_CORPO.replaceChildren();
  if (lista.length === 0) {
    PRIMO_PIANO_COL.remove();
    CODA_COL.classList.remove("col-lg-5"); // resta solo la coda: occupa tutta la riga
    return;
  }

  const BRANO = lista[0];

  const ARTE = creaElemento("div", "feature-art rounded-3 overflow-hidden flex-shrink-0 bg-body-secondary", PRIMO_PIANO_CORPO);
  const IMG = creaElemento("img", "w-100 h-100 object-fit-cover d-block", ARTE);
  IMG.src = BIG_ART(BRANO.cover);
  IMG.alt = "";
  // alcune copertine vecchie di iTunes non esistono piu': resta il riquadro scuro
  IMG.addEventListener("error", () => IMG.remove());

  const META = creaElemento("div", "overflow-hidden", PRIMO_PIANO_CORPO);
  const TITOLO = creaElemento("h3", "fs-5 fw-bold text-truncate mb-1", META);
  const LINK = creaElemento("a", undefined, TITOLO, BRANO.title);
  LINK.href = `track.html?id=${BRANO.id}`; // il titolo porta alla pagina del brano

  let info = BRANO.artist;
  if (lista.length > 1) {
    info = `${BRANO.artist} · ${lista.length} brani nel mix`;
  }
  creaElemento("p", "small text-body-secondary text-truncate m-0", META, info);

  const BOTTONE = creaElemento("button", "btn btn-accent btn-sm rounded-pill fw-bold px-3 mt-3", META, "▶ Riproduci mix");
  BOTTONE.type = "button";
  BOTTONE.disabled = !BRANO.previewUrl;
  BOTTONE.addEventListener("click", () => PLAYER.play(BRANO, lista));
};

/* ---------- In riproduzione (la coda del player) ---------- */

const CODA_COL = creaElemento("div", "col-12 col-lg-5", PANNELLI);
const CODA_PANNELLO = creaElemento("section", "h-100 bg-body-tertiary border rounded-4 p-4", CODA_COL);
TESTATA_SEZIONE(CODA_PANNELLO, "In riproduzione").classList.replace("mt-5", "mt-0");
const CODA_LISTA = creaElemento("ul", "list-unstyled m-0", CODA_PANNELLO);

/*
  RENDER_CODA()
  - Mostra fino a 5 brani della coda del player, partendo da quello in ascolto.
  - Ogni riga e' un <button>: click (o Invio da tastiera) = suona quel brano restando nella stessa coda.
  - Viene richiamata a ogni "cambio-brano" (evento lanciato da Player.play in common.js).
*/
const MAX_CODA = 5;

const RENDER_CODA = () => {
  CODA_LISTA.replaceChildren();

  const CODA = PLAYER.coda;
  if (CODA.length === 0) {
    creaElemento("li", "small text-body-secondary border-top pt-3", CODA_LISTA, "Nessun brano in coda: scegline uno dalle card.");
    return;
  }

  // Parto dal brano corrente (se c'e') cosi' vedo "questo + i prossimi"
  const INIZIO = Math.max(0, PLAYER.indiceInCoda());
  const QUANTI = Math.min(MAX_CODA, CODA.length);

  for (let i = 0; i < QUANTI; i++) {
    const BRANO = CODA[(INIZIO + i) % CODA.length]; // % = arrivato in fondo riparto dall'inizio

    const RIGA = creaElemento("li", "border-top", CODA_LISTA);
    const BOTTONE = creaElemento("button", "queue-btn w-100 d-flex justify-content-between gap-3 bg-transparent border-0 text-start small py-2 px-1", RIGA);
    BOTTONE.type = "button";
    BOTTONE.setAttribute("aria-label", `Riproduci ${BRANO.title} di ${BRANO.artist}`);

    // Il brano in ascolto e' acceso (lime e grassetto)
    if (PLAYER.currentTrack && PLAYER.currentTrack.id === BRANO.id) {
      BOTTONE.classList.add("is-current", "fw-bold");
    }

    const TITOLO = creaElemento("span", "text-truncate", BOTTONE);
    creaElemento("span", "text-body-secondary fw-normal me-2", TITOLO, `0${i + 1}`);
    creaElemento("span", "queue-title", TITOLO, BRANO.title);
    creaElemento("span", "text-body-secondary fw-normal flex-shrink-0", BOTTONE, `${BRANO.artist} · ${FORMAT_TIME(BRANO.durationMs)}`);

    // play() sul brano gia' in ascolto fa play/pausa: va bene anche qui
    BOTTONE.addEventListener("click", () => PLAYER.play(BRANO, CODA));
  }
};

RENDER_CODA();
window.addEventListener("cambio-brano", RENDER_CODA);

/* ============================ Suggerimenti ============================ */

const CARICA_SUGGERIMENTI = async (termine) => {
  try {
    const URL = `https://itunes.apple.com/search?term=${encodeURIComponent(termine)}&entity=song&limit=12`;
    const DATI = await FETCH_JSON(URL);// fa la richiesta e trasforma la risposta in un oggetto JS
    const BRANI = DATI.results.map((raw) => new Track(raw));// da ogni risultato "grezzo" dell'API crea un oggetto Track, in un nuovo array

    BRANI.sort(() => Math.random() - 0.5);//album radom
    return BRANI.slice(0, 6); // 6 = una riga piena della griglia su desktop

  } catch (err) {
    console.error(err);
    return []; // renderRow con array vuoto non crea niente
  }
};

/*
  loadHome()
  - lancia in parallelo le 3 ricerche dei suggerimenti
  - costruisce le righe nell'ordine: pop, rock, hits
  - il primo brano degli hits va "In primo piano"
*/
const LOAD_HOME = async () => {
  // Le tre ricerche partono insieme
  const RISULTATI = await Promise.allSettled([
    CARICA_SUGGERIMENTI("pop"),
    CARICA_SUGGERIMENTI("rock"),
    CARICA_SUGGERIMENTI("hits"),
  ]);
  const [POP, ROCK, HITS] = RISULTATI;

  RENDER_PRIMO_PIANO(HITS.status === "fulfilled" ? HITS.value : []);

  if (POP.status === "fulfilled") {
    RENDER_ROW("Suggerimenti pop", POP.value);
  }

  if (ROCK.status === "fulfilled") {
    RENDER_ROW("Suggerimenti rock", ROCK.value);
  }

  if (HITS.status === "fulfilled") {
    RENDER_ROW("Suggerimenti hits", HITS.value);
  }
};

LOAD_HOME();
