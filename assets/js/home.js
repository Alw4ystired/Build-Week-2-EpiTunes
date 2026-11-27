// Importo da common.js solo quello che questo file usa davvero
import {
  INIT_PAGE,
  GET_FAVOURITES,
  TOGGLE_FAVOURITE,
  IS_FAVOURITE,
  GET_HISTORY,
  RENDER_SIDEBAR_FAVS,
  AGGIORNA_CARD_PLAY,
  GET_FAV_ALBUMS,     // ⭐ NUOVO — filtro "Album" dei preferiti
  IS_FAV_ALBUM,       // ⭐ NUOVO — cuore sulle card album
  TOGGLE_FAV_ALBUM,   // ⭐ NUOVO
  GET_FAV_ARTISTS,    // ⭐ NUOVO — filtro "Artisti" dei preferiti
  IS_FAV_ARTIST,      // ⭐ NUOVO — cuore sulle card artista
  TOGGLE_FAV_ARTIST,  // ⭐ NUOVO
  CERCA_INFO_ARTISTA, // ⭐ NUOVO — foto degli artisti (come nella ricerca)

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
        - "I tuoi preferiti" con i filtri Tracce / Album / Artisti -- solo se c'e' almeno un preferito
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

// Griglia Bootstrap: 2 card per riga su telefono, 3-4 su tablet, 5-6 su portatile, 8 su schermi grandi.
// Le colonne calano ma la copertina resta quadrata (aspect-ratio in app.css).
// ⭐ MODIFICA — salvata in una costante: ora la usano anche le griglie di album e artisti preferiti
const CLASSI_GRIGLIA = "row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 row-cols-xl-6 row-cols-xxl-8 g-2 g-md-3";

/*
  CREA_GRIGLIA_TRACCE(parent, tracks)
  ⭐ MODIFICA — e' la parte "griglia + card + event delegation" che prima stava
  dentro renderRow, IDENTICA, spostata in una funzione sua: cosi' la usano sia
  renderRow sia la sezione preferiti (filtro "Tracce").
  - una card per ogni track: cover, titolo, artista, bottone play, bottone cuore
*/
const CREA_GRIGLIA_TRACCE = (parent, tracks) => {
  const GRID = creaElemento("div", CLASSI_GRIGLIA, parent);

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
    // Bottone play (compare al passaggio del mouse, vedi .card:hover in app.css)
    const PLAY_BUTTON = creaElemento("button", "card-play position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center", IMAGE_WRAP, "▶");
    PLAY_BUTTON.type = "button";
    PLAY_BUTTON.setAttribute(
      "aria-label",
      `Riproduci ${track.title} di ${track.artist}`
    );
    PLAY_BUTTON.disabled = !track.previewUrl;
  });

  /*
    Event delegation.
    Invece di tre ascoltatori su ogni card (cuore, play, card intera), ne
    mettiamo UNO solo sulla griglia. Il click "sale" dal bottone alla card
    alla griglia: closest() dice da dove e' partito, e il data-track-id
    della card dice quale brano e'.
  */
  const PER_ID = new Map(tracks.map((brano) => [String(brano.id), brano]));

  GRID.addEventListener("click", (event) => {
    const CARD = event.target.closest(".card");
    if (!CARD) return; // click nel vuoto fra una card e l'altra

    const TRACK = PER_ID.get(CARD.dataset.trackId);
    if (!TRACK) return;

    // Cuore
    if (event.target.closest(".card-fav")) {
      TOGGLE_FAVOURITE(TRACK);
      RENDER_SIDEBAR_FAVS(); // la lista nella sidebar
      AGGIORNA_CUORI(TRACK); // tutti i cuori di questo brano, anche nelle altre righe
      AGGIORNA_PREFERITI(); // la sezione "I tuoi preferiti"
      return;
    }

    // Un altro bottone che qualcuno aggiungesse in futuro non fa partire la musica
    const BOTTONE = event.target.closest("button");
    if (BOTTONE && !BOTTONE.classList.contains("card-play")) return;

    // Bottone play, oppure un punto qualsiasi della card
    if (TRACK.previewUrl) PLAYER.play(TRACK, tracks); // la coda e' la riga da cui parto
  });

  AGGIORNA_CARD_PLAY(); // le card nuove partono con l'icona giusta (▶ o ⏸)
  return GRID;
};

/*
  renderRow(rowTitle, tracks, idSezione, parent, nota)
  - crea una <section> con testata e una griglia di card
  - se l'array è vuoto non crea niente (nessuna sezione vuota con solo il titolo)
  ⭐ MODIFICA — la griglia ora la crea CREA_GRIGLIA_TRACCE (stesso risultato di prima)
*/
const RENDER_ROW = (rowTitle, tracks, idSezione, parent = RIGHE_SUGGERITE, nota) => {
  if (!tracks || tracks.length === 0) return;

  const SECTION = creaElemento("section", undefined, parent);
  if (idSezione) {
    SECTION.id = idSezione;
  }
  TESTATA_SEZIONE(SECTION, rowTitle, nota);
  CREA_GRIGLIA_TRACCE(SECTION, tracks);

  return SECTION;
};

/* ============================ Card di album e artisti ============================ */

// ⭐ NUOVO
/*
  RENDI_CARD_LINK(card, indirizzo, etichetta)
  - Fa comportare una card <article> come un link (stessa funzione di search.js):
    click -> apre "indirizzo", tranne quando il click arriva dal cuore.
  - role="link" + tabIndex = 0: si raggiunge col Tab e si apre con Invio.
*/
const RENDI_CARD_LINK = (card, indirizzo, etichetta) => {
  card.setAttribute("role", "link");
  card.tabIndex = 0;
  card.setAttribute("aria-label", etichetta);

  const VAI = () => {
    window.location.href = indirizzo;
  };

  card.addEventListener("click", (event) => {
    if (event.target.closest("button")) return; // click sul cuore: non navigo
    VAI();
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target === card) VAI();
  });
};

// ⭐ NUOVO
/*
  CREA_CUORE_CARD(genitore, nome, eGiaPreferito, alClick)
  - Cuore per le card di album e artisti (stesse classi del cuore delle tracce).
  - Dopo il click ridisegno sidebar E sezione preferiti: se tolgo un album
    stando nel filtro "Album", la sua card sparisce subito.
*/
const CREA_CUORE_CARD = (genitore, nome, eGiaPreferito, alClick) => {
  const BOTTONE = creaElemento(
    "button",
    "card-fav position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center",
    genitore
  );
  BOTTONE.type = "button";

  const AGGIORNA = () => {
    const PREFERITO = eGiaPreferito();
    BOTTONE.classList.toggle("is-fav", PREFERITO);
    BOTTONE.textContent = PREFERITO ? "♥" : "♡";
    BOTTONE.setAttribute("aria-pressed", String(PREFERITO));
    BOTTONE.setAttribute("aria-label", `${PREFERITO ? "Rimuovi" : "Aggiungi"} ${nome} ${PREFERITO ? "dai" : "ai"} preferiti`);
  };
  AGGIORNA();

  BOTTONE.addEventListener("click", (event) => {
    event.stopPropagation(); // non deve aprire la pagina della card
    alClick();
    AGGIORNA();
    RENDER_SIDEBAR_FAVS();
    AGGIORNA_PREFERITI();
  });
};

// ⭐ NUOVO
/*
  CARICA_FOTO_ARTISTA(imageWrap, nome)
  - Come in search.js: chiede la foto a TheAudioDB e, quando e' caricata del
    tutto, la mette nel cerchio al posto del 🎤. Prima /medium, poi l'originale.
*/
const CARICA_FOTO_ARTISTA = async (imageWrap, nome) => {
  const INFO = await CERCA_INFO_ARTISTA(nome);
  const FOTO = INFO?.foto;
  if (!FOTO) return; // niente foto: resta il 🎤

  const IMAGE = creaElemento("img", "w-100 h-100 object-fit-cover d-block");
  IMAGE.alt = nome;
  IMAGE.addEventListener("load", () => imageWrap.replaceChildren(IMAGE), { once: true });
  IMAGE.addEventListener("error", () => (IMAGE.src = FOTO), { once: true });
  IMAGE.src = `${FOTO}/medium`;
};

// ⭐ NUOVO
/*
  CREA_CARD_ALBUM(album, grid)
  - Card di un album, con lo stile delle card della home (cuore dentro la copertina).
  - Click sulla card -> pagina dell'album.
*/
const CREA_CARD_ALBUM = (album, grid) => {
  const COLUMN = creaElemento("div", "col", grid);
  const CARD = creaElemento("article", "card h-100 border-0 position-relative p-2", COLUMN);
  RENDI_CARD_LINK(CARD, `album.html?id=${album.id}`, `Apri l'album ${album.title}`);

  const IMAGE_WRAP = creaElemento("div", "card-image-wrap position-relative w-100 overflow-hidden", CARD);
  const IMAGE = creaElemento("img", "w-100 h-100 object-fit-cover d-block", IMAGE_WRAP);
  IMAGE.src = BIG_ART(album.cover);
  IMAGE.alt = album.title ?? "";
  IMAGE.loading = "lazy";

  creaElemento("p", "card-title fw-bold text-truncate mt-0 mb-1 px-1", CARD, album.title);
  creaElemento("p", "card-sub text-body-secondary text-truncate small mb-1 px-1", CARD, album.artist);

  CREA_CUORE_CARD(IMAGE_WRAP, album.title, () => IS_FAV_ALBUM(album.id), () => TOGGLE_FAV_ALBUM(album));
};

// ⭐ NUOVO
/*
  CREA_CARD_ARTISTA(artist, grid)
  - Card di un artista: cerchio con 🎤 (poi la foto di TheAudioDB), nome, genere.
  - Il cuore sta sulla CARD e non nel cerchio: quando arriva la foto,
    CARICA_FOTO_ARTISTA sostituisce tutto il contenuto del cerchio.
*/
const CREA_CARD_ARTISTA = (artist, grid) => {
  const COLUMN = creaElemento("div", "col", grid);
  const CARD = creaElemento("article", "card h-100 border-0 position-relative p-2", COLUMN);
  RENDI_CARD_LINK(CARD, `artist.html?id=${artist.id}`, `Apri l'artista ${artist.name}`);

  const IMAGE_WRAP = creaElemento("div", "card-image-wrap position-relative w-100 overflow-hidden round", CARD);
  creaElemento("div", "w-100 h-100 d-flex align-items-center justify-content-center fs-1", IMAGE_WRAP, "🎤");

  creaElemento("p", "card-title fw-bold text-truncate mt-0 mb-1 px-1", CARD, artist.name);
  creaElemento("p", "card-sub text-body-secondary text-truncate small mb-1 px-1", CARD, artist.genre || "Artista");

  CREA_CUORE_CARD(CARD, artist.name, () => IS_FAV_ARTIST(artist.id), () => TOGGLE_FAV_ARTIST(artist));
  CARICA_FOTO_ARTISTA(IMAGE_WRAP, artist.name);
};

/* ============================ I tuoi preferiti (con filtri) ============================ */

// ⭐ NUOVO — quale filtro e' attivo. let perche' cambia ai click. Si parte da "tracce".
let filtroPreferiti = "tracce";

// ⭐ NUOVO — i tre bottoni filtro: chiave, testo del bottone, messaggio se vuoto,
// nota a destra del titolo (prima c'era solo "n brani salvati")
const FILTRI_PREFERITI = [
  { chiave: "tracce", etichetta: "Tracce", vuoto: "Nessun brano tra i preferiti", nota: (n) => (n === 1 ? "1 brano salvato" : `${n} brani salvati`) },
  { chiave: "album", etichetta: "Album", vuoto: "Nessun album tra i preferiti", nota: (n) => (n === 1 ? "1 album salvato" : `${n} album salvati`) },
  { chiave: "artisti", etichetta: "Artisti", vuoto: "Nessun artista tra i preferiti", nota: (n) => (n === 1 ? "1 artista seguito" : `${n} artisti seguiti`) },
];

/*
  AGGIORNA_PREFERITI()
  ⭐ MODIFICA — stesso nome di prima (la chiamano gia' i cuori), ma ora disegna
  la sezione con i tre filtri:
      [I tuoi preferiti] [Tracce] [Album] [Artisti]            n brani salvati
      griglia del filtro attivo
  - La sezione compare se c'e' ALMENO un preferito di qualsiasi tipo, cosi' i
    bottoni restano raggiungibili anche se la categoria scelta e' vuota.
  - Sta sempre in cima, prima di "Riascolta" (prepend), come prima.
*/
const AGGIORNA_PREFERITI = () => {
  document.querySelector("#sezione-preferiti")?.remove(); // tolgo la versione vecchia

  // Le chiavi sono le stesse di FILTRI_PREFERITI: ELENCHI[filtroPreferiti] = lista giusta
  const ELENCHI = {
    tracce: GET_FAVOURITES(),
    album: GET_FAV_ALBUMS(),
    artisti: GET_FAV_ARTISTS(),
  };
  const TOTALE = ELENCHI.tracce.length + ELENCHI.album.length + ELENCHI.artisti.length;
  if (TOTALE === 0) return; // nessun preferito: niente sezione

  const FILTRO = FILTRI_PREFERITI.find((filtro) => filtro.chiave === filtroPreferiti);
  const ELENCO = ELENCHI[filtroPreferiti];

  const SECTION = creaElemento("section", undefined, undefined, undefined, "sezione-preferiti");
  RIGHE_PERSONALI.prepend(SECTION);

  /* ---------- Testata: titolo + filtri a sinistra, nota a destra ---------- */
  const HEAD = TESTATA_SEZIONE(SECTION, "I tuoi preferiti", FILTRO.nota(ELENCO.length));
  HEAD.classList.replace("align-items-baseline", "align-items-center"); // bottoni e titolo centrati in verticale

  // Sposto il titolo in un contenitore insieme ai bottoni (appendChild SPOSTA un elemento gia' esistente)
  const SINISTRA = creaElemento("div", "d-flex flex-wrap align-items-center gap-3");
  HEAD.prepend(SINISTRA);
  SINISTRA.appendChild(HEAD.querySelector("h2"));

  const GRUPPO = creaElemento("div", "d-flex gap-2", SINISTRA);
  GRUPPO.setAttribute("role", "group");
  GRUPPO.setAttribute("aria-label", "Filtra i preferiti");

  FILTRI_PREFERITI.forEach(({ chiave, etichetta }) => {
    const ATTIVO = chiave === filtroPreferiti;
    // btn-accent (lime, definito in app.css) = attivo; btn-outline-secondary = spento
    const BOTTONE = creaElemento(
      "button",
      `btn btn-sm rounded-pill fw-semibold px-3 ${ATTIVO ? "btn-accent" : "btn-outline-secondary"}`,
      GRUPPO,
      etichetta
    );
    BOTTONE.type = "button";
    BOTTONE.setAttribute("aria-pressed", String(ATTIVO));

    BOTTONE.addEventListener("click", () => {
      if (chiave === filtroPreferiti) return; // gia' attivo
      filtroPreferiti = chiave;
      AGGIORNA_PREFERITI(); // ridisegno la sezione con il nuovo filtro
    });
  });

  /* ---------- Contenuto del filtro attivo ---------- */
  if (ELENCO.length === 0) {
    creaElemento("p", "small text-body-secondary m-0", SECTION, FILTRO.vuoto);
    return;
  }

  if (filtroPreferiti === "tracce") {
    CREA_GRIGLIA_TRACCE(SECTION, ELENCO); // stesse card di prima, con play e cuore
    return;
  }

  const GRID = creaElemento("div", CLASSI_GRIGLIA, SECTION);
  if (filtroPreferiti === "album") {
    ELENCO.forEach((album) => CREA_CARD_ALBUM(album, GRID));
  } else {
    ELENCO.forEach((artista) => CREA_CARD_ARTISTA(artista, GRID));
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

    // Anche l'etichetta per gli screen reader: senza questa resta quella di
    // quando la card e' nata, e direbbe "Aggiungi" su un cuore gia' pieno.
    CUORE.setAttribute(
      "aria-label",
      `${ORA ? "Rimuovi" : "Aggiungi"} ${track.title} ${ORA ? "dai" : "ai"} preferiti`
    );
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
  - Se la lista è vuota usa preferiti o cronologia; se non c'è niente, nasconde il pannello.
*/
const MAX_SLIDE = 5; // quante slide al massimo nel carosello

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

  // Il corpo del pannello centra il carosello in orizzontale e in verticale
  PRIMO_PIANO_CORPO.className = "d-flex align-items-center justify-content-center";

  const SLIDES = lista.slice(0, MAX_SLIDE);
  const ID = "carosello-primo-piano";

  const CAROSELLO = creaElemento("div", "carousel slide w-100", PRIMO_PIANO_CORPO);
  CAROSELLO.id = ID;

  // Pallini
  if (SLIDES.length > 1) {
    const INDICATORI = creaElemento("div", "carousel-indicators mb-0", CAROSELLO);
    SLIDES.forEach((_, i) => {
      const PALLINO = creaElemento("button", i === 0 ? "active" : undefined, INDICATORI);
      PALLINO.type = "button";
      PALLINO.dataset.bsTarget = `#${ID}`;
      PALLINO.dataset.bsSlideTo = String(i);
      PALLINO.setAttribute("aria-label", `Slide ${i + 1}`);
      if (i === 0) PALLINO.setAttribute("aria-current", "true");
    });
  }

  // Slide
  const INNER = creaElemento("div", "carousel-inner", CAROSELLO);

  SLIDES.forEach((BRANO, i) => {
    const ITEM = creaElemento("div", i === 0 ? "carousel-item active" : "carousel-item", INNER);
    const CONTENUTO = creaElemento("div", "d-flex flex-column align-items-center text-center px-5 pb-4", ITEM);

    // Copertina
    const ARTE = creaElemento("div", "feature-art-lg rounded-4 overflow-hidden flex-shrink-0 bg-body-secondary mb-3", CONTENUTO);
    const IMG = creaElemento("img", "w-100 h-100 object-fit-cover d-block", ARTE);
    IMG.src = BIG_ART(BRANO.cover);
    IMG.alt = `Copertina di ${BRANO.title}`;
    // alcune copertine vecchie di iTunes non esistono piu': resta il riquadro scuro
    IMG.addEventListener("error", () => IMG.remove());

    // Etichetta
    creaElemento("p", "eyebrow text-uppercase fw-semibold small mb-1", CONTENUTO, `In evidenza · ${i + 1}/${SLIDES.length}`);

    // Titolo (porta alla pagina del brano)
    const TITOLO = creaElemento("h3", "fs-4 fw-bold text-truncate w-100 mb-1", CONTENUTO);
    const LINK = creaElemento("a", "text-reset text-decoration-none", TITOLO, BRANO.title);
    LINK.href = `track.html?id=${BRANO.id}`;

    // Artista + dimensione del mix
    let info = BRANO.artist;
    if (lista.length > 1) info = `${BRANO.artist} · ${lista.length} brani nel mix`;
    creaElemento("p", "text-body-secondary text-truncate w-100 small mb-3", CONTENUTO, info);

    // Bottone
    const BOTTONE = creaElemento("button", "btn btn-accent rounded-pill fw-bold px-4", CONTENUTO, "▶ Riproduci mix");
    BOTTONE.type = "button";
    BOTTONE.disabled = !BRANO.previewUrl;
    BOTTONE.addEventListener("click", () => PLAYER.play(BRANO, lista));
  });

  // Frecce
  if (SLIDES.length > 1) {
    [["prev", "Precedente"], ["next", "Successivo"]].forEach(([dir, label]) => {
      const FRECCIA = creaElemento("button", `carousel-control-${dir}`, CAROSELLO);
      FRECCIA.type = "button";
      FRECCIA.dataset.bsTarget = `#${ID}`;
      FRECCIA.dataset.bsSlide = dir;
      creaElemento("span", `carousel-control-${dir}-icon`, FRECCIA).setAttribute("aria-hidden", "true");
      creaElemento("span", "visually-hidden", FRECCIA, label);
    });
  }

  new bootstrap.Carousel(CAROSELLO, { interval: 4000, ride: "carousel", pause: "hover" });
};

/* ---------- In riproduzione (la coda del player) ---------- */

const CODA_COL = creaElemento("div", "col-12 col-lg-5", PANNELLI);
const CODA_PANNELLO = creaElemento("section", "h-100 bg-body-tertiary border rounded-4 p-4", CODA_COL);
TESTATA_SEZIONE(CODA_PANNELLO, "In riproduzione").classList.replace("mt-5", "mt-0");
const CODA_LISTA = creaElemento("ul", "list-unstyled m-0 overflow-y-auto position-relative", CODA_PANNELLO);
CODA_LISTA.style.maxHeight = "280px"; // oltre questa altezza la lista scorre, non esce dalla card

/*
  RENDER_CODA()
  - Mostra tutta la coda del player, nel suo ordine (01 = primo brano della coda).
  - Il brano in ascolto e' acceso (lime e grassetto) e la lista scorre da sola
    per portarlo al centro: con ⏮ / ⏭ del player la riga accesa si sposta
    e la lista la segue.
  - Ogni riga e' un <button>: click = suona quel brano restando nella stessa coda.
  - Viene richiamata a ogni "cambio-brano" (evento lanciato da Player.play in common.js).
*/
const RENDER_CODA = () => {
  const SCROLL_PRIMA = CODA_LISTA.scrollTop; // dove era scorsa la lista: svuotandola tornerebbe in cima
  CODA_LISTA.replaceChildren();

  const CODA = PLAYER.coda;
  if (CODA.length === 0) {
    creaElemento("li", "small text-body-secondary border-top pt-3", CODA_LISTA, "Nessun brano in coda: scegline uno dalle card.");
    return;
  }

  let rigaAttuale = null; // la riga del brano in ascolto, se c'e'

  CODA.forEach((BRANO, i) => {
    const RIGA = creaElemento("li", "border-top", CODA_LISTA);
    const BOTTONE = creaElemento("button", "queue-btn w-100 d-flex justify-content-between gap-3 bg-transparent border-0 text-start small py-2 px-1", RIGA);
    BOTTONE.type = "button";
    BOTTONE.setAttribute("aria-label", `Riproduci ${BRANO.title} di ${BRANO.artist}`);

    // Il brano in ascolto e' acceso (lime e grassetto)
    if (PLAYER.currentTrack && PLAYER.currentTrack.id === BRANO.id) {
      BOTTONE.classList.add("is-current", "fw-bold");
      rigaAttuale = RIGA;
    }

    const TITOLO = creaElemento("span", "text-truncate", BOTTONE);
    // 01, 02 ... 09, poi 10, 11: lo zero davanti solo sotto il 10
    const NUMERO = i + 1 < 10 ? `0${i + 1}` : `${i + 1}`;
    creaElemento("span", "text-body-secondary fw-normal me-2", TITOLO, NUMERO);
    creaElemento("span", "queue-title", TITOLO, BRANO.title);
    creaElemento("span", "text-body-secondary fw-normal flex-shrink-0", BOTTONE, `${BRANO.artist} · ${FORMAT_TIME(BRANO.durationMs)}`);

    // play() sul brano gia' in ascolto fa play/pausa: va bene anche qui
    BOTTONE.addEventListener("click", () => PLAYER.play(BRANO, CODA));
  });

  // Rimetto la lista dov'era scorsa, poi la faccio scorrere (morbida) fino
  // al brano in ascolto, al centro del riquadro. Stesso calcolo di CENTRA_RIGA
  // in track.js: offsetTop funziona perche' la lista ha position-relative.
  CODA_LISTA.scrollTop = SCROLL_PRIMA;
  if (rigaAttuale) {
    CODA_LISTA.scrollTo({
      top: rigaAttuale.offsetTop - CODA_LISTA.clientHeight / 2 + rigaAttuale.offsetHeight / 2,
      behavior: "smooth",
    });
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

    BRANI.sort(() => Math.random() - 0.5); // ordine diverso a ogni caricamento
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