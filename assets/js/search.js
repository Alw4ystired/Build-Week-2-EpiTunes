import {
  INIT_PAGE,
  creaElemento,
  FETCH_JSON,
  BIG_ART,
  DEBOUNCE,
  Track,
  Album,
  Artist,
  API_BASE,
  STORAGE_KEY_LAST_SEARCH,
  IS_FAVOURITE,
  TOGGLE_FAVOURITE,
  RENDER_SIDEBAR_FAVS,
  CERCA_INFO_ARTISTA,
  AGGIORNA_CARD_PLAY,
  IS_FAV_ALBUM,      // ⭐ NUOVO — cuore sulle card album
  TOGGLE_FAV_ALBUM,  // ⭐ NUOVO
  IS_FAV_ARTIST,     // ⭐ NUOVO — cuore sulle card artista
  TOGGLE_FAV_ARTIST, // ⭐ NUOVO
} from "./common.js";

const PLAYER = INIT_PAGE("search");
const INPUT = document.querySelector("#search-input");
const ROW_TRACKS = document.querySelector("#row-tracks");
const ROW_ALBUMS = document.querySelector("#row-albums");
const ROW_ARTISTS = document.querySelector("#row-artists");
const GRID_TRACKS = document.querySelector("#grid-tracks");
const GRID_ALBUMS = document.querySelector("#grid-albums");
const GRID_ARTISTS = document.querySelector("#grid-artists");

let searchSequence = 0;

const CREATE_CARD = (grid, tag) => {
  const COLUMN = creaElemento("div", "col", grid);
  return creaElemento(tag, "card h-100 border-0 position-relative p-3", COLUMN);
};

const CREATE_IMAGE = (parent, url, alt = "") => {
  const IMAGE_WRAP = creaElemento("div", "card-image-wrap position-relative w-100 overflow-hidden", parent);
  const IMAGE = creaElemento("img", "w-100 h-100 object-fit-cover d-block", IMAGE_WRAP);

  IMAGE.src = url || "";
  IMAGE.alt = alt;
  IMAGE.loading = "lazy";

  return IMAGE_WRAP;
};

// ⭐ NUOVO
/*
  RENDI_CARD_LINK(card, indirizzo, etichetta)
  - Fa comportare una card <article> come un link: click -> apre "indirizzo".
  - Serve perche' le card di album e artisti prima erano <a>, ma dentro un <a>
    non si puo' mettere un <button> (il cuore): HTML non valido, e il click
    sul cuore aprirebbe anche la pagina.
  - Se il click arriva da un bottone (il cuore) NON apro la pagina.
  - role="link" + tabIndex = 0: si raggiunge col Tab e si apre con Invio.
*/
const RENDI_CARD_LINK = (card, indirizzo, etichetta) => {
  card.setAttribute("role", "link");
  card.tabIndex = 0;
  card.setAttribute("aria-label", etichetta);

  const VAI = () => {
    window.location.href = indirizzo; // stessa pagina di prima (album.html?id=... / artist.html?id=...)
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
  - Cuore per le card di album e artisti (stesse classi del cuore dei brani).
  - eGiaPreferito: funzione "e' preferito adesso?" (legge localStorage)
  - alClick:       funzione "aggiungi/togli" (TOGGLE_FAV_ALBUM o TOGGLE_FAV_ARTIST)
  - Stessa funzione dei bottoni "+ Salva album" e "Segui": i dati sono condivisi.
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
    BOTTONE.classList.toggle("is-fav", PREFERITO); // is-fav = rosso e sempre visibile (app.css)
    BOTTONE.textContent = PREFERITO ? "♥" : "♡";
    BOTTONE.setAttribute("aria-pressed", String(PREFERITO));
    BOTTONE.setAttribute("aria-label", `${PREFERITO ? "Rimuovi" : "Aggiungi"} ${nome} ${PREFERITO ? "dai" : "ai"} preferiti`);
  };
  AGGIORNA(); // parte pieno se era gia' tra i preferiti

  BOTTONE.addEventListener("click", (event) => {
    event.stopPropagation(); // il cuore sta dentro la card: non deve aprire la pagina
    alClick();
    AGGIORNA();
    RENDER_SIDEBAR_FAVS(); // la sidebar si aggiorna subito
  });
};

/*
  caricaFotoArtista(imageWrap, nome)
  - Cerca la foto dell'artista su TheAudioDB e, se c'e', la mette nel cerchio
    della card AL POSTO del 🎤.
  - Il 🎤 resta finche' la foto non e' caricata del tutto (evento "load"):
    solo allora sostituisco il contenuto del cerchio. Cosi' non si vede mai
    un cerchio vuoto o un'immagine a meta'.
  - Prima provo la versione /medium (piu' leggera); se non si carica,
    ripiego UNA volta sulla foto originale ({ once: true }).
  - Se TheAudioDB non ha l'artista, o entrambe le foto falliscono, resta il 🎤.
  - E' async ma NON la aspetto con await: le card vengono disegnate subito
    e le foto arrivano ognuna per conto suo.
*/
const CARICA_FOTO_ARTISTA = async (imageWrap, nome) => {
  // cercaInfoArtista restituisce { foto, follower }: qui mi serve solo la foto.
  // ?. perche' info e' null se TheAudioDB non conosce l'artista.
  const INFO = await CERCA_INFO_ARTISTA(nome);
  const FOTO = INFO?.foto;
  if (!FOTO) return; // niente foto: resta il 🎤

  // Creo l'immagine SENZA genitore: non e' ancora nella pagina
  const IMAGE = creaElemento("img", "w-100 h-100 object-fit-cover d-block");
  IMAGE.alt = nome;

  // Caricata -> sostituisco il 🎤 con la foto (replaceChildren svuota e inserisce)
  IMAGE.addEventListener("load", () => imageWrap.replaceChildren(IMAGE), { once: true });
  // /medium non disponibile -> provo l'originale (una volta sola)
  IMAGE.addEventListener("error", () => (IMAGE.src = FOTO), { once: true });

  IMAGE.src = `${FOTO}/medium`;
};

// L'elenco dei brani mostrati adesso: e' la coda dei bottoni del player.
let BRANI_IN_PAGINA = [];

const RENDER_TRACK_CARD = (rawTrack) => {
  const TRACK = new Track(rawTrack);
  const CARD = CREATE_CARD(GRID_TRACKS, "article");

  CARD.dataset.trackId = String(TRACK.id);

  CREATE_IMAGE(CARD, BIG_ART(TRACK.cover), TRACK.title);
  creaElemento("p", "card-title fw-bold text-truncate mt-0 mb-1 fs-6", CARD, TRACK.title);
  creaElemento("p", "card-sub text-body-secondary text-truncate m-0 small", CARD, TRACK.artist);

  const GIA_PREFERITO = IS_FAVOURITE(TRACK.id);
  const FAV_BUTTON = creaElemento(
    "button",
    GIA_PREFERITO ? "card-fav position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center is-fav" : "card-fav position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center",
    CARD,
    GIA_PREFERITO ? "♥" : "♡"
  );

  FAV_BUTTON.type = "button";
  FAV_BUTTON.setAttribute(
    "aria-label",
    `${GIA_PREFERITO ? "Rimuovi" : "Aggiungi"} ${TRACK.title} ${GIA_PREFERITO ? "dai" : "ai"} preferiti`
  );

  const PLAY_BUTTON = creaElemento("button", "card-play position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center", CARD, "▶");

  PLAY_BUTTON.type = "button";
  PLAY_BUTTON.setAttribute(
    "aria-label",
    TRACK.previewUrl
      ? `Riproduci ${TRACK.title} di ${TRACK.artist}`
      : `Anteprima non disponibile per ${TRACK.title}`
  );
  PLAY_BUTTON.disabled = !TRACK.previewUrl;

};

/*
  Event delegation sulla griglia dei brani.
  Un ascoltatore solo, messo una volta all'avvio, invece di tre su ogni card.
  Il click "sale" dal bottone alla card alla griglia: closest() dice da dove
  e' partito, e il data-track-id della card dice quale brano e'.
  Con 12 risultati: 1 ascoltatore invece di 36.
  Funziona anche con le card di una ricerca nuova, perche' la griglia resta
  sempre la stessa: cambiano solo le card dentro.
*/
GRID_TRACKS.addEventListener("click", (event) => {
  const CARD = event.target.closest(".card");
  if (!CARD) return; // click nel vuoto fra una card e l'altra

  const TRACK = BRANI_IN_PAGINA.find((brano) => String(brano.id) === CARD.dataset.trackId);
  if (!TRACK) return;

  // Cuore
  const CUORE = event.target.closest(".card-fav");
  if (CUORE) {
    TOGGLE_FAVOURITE(TRACK);
    const ORA = IS_FAVOURITE(TRACK.id);
    CUORE.classList.toggle("is-fav", ORA);
    CUORE.textContent = ORA ? "♥" : "♡";
    CUORE.setAttribute(
      "aria-label",
      `${ORA ? "Rimuovi" : "Aggiungi"} ${TRACK.title} ${ORA ? "dai" : "ai"} preferiti`
    );
    RENDER_SIDEBAR_FAVS();
    return;
  }

  // Un altro bottone che qualcuno aggiungesse in futuro non fa partire la musica
  const BOTTONE = event.target.closest("button");
  if (BOTTONE && !BOTTONE.classList.contains("card-play")) return;

  // Bottone verde, oppure un punto qualsiasi della card
  if (TRACK.previewUrl) PLAYER.play(TRACK, BRANI_IN_PAGINA);
});

const RENDER_ALBUM_CARD = (rawAlbum) => {
  const ALBUM = new Album(rawAlbum);
  // ⭐ MODIFICA — "article" invece di "a": dentro ci va il cuore (un <button>)
  const CARD = CREATE_CARD(GRID_ALBUMS, "article");

  // ⭐ MODIFICA — prima era CARD.href = ...: ora il click lo gestisce RENDI_CARD_LINK
  RENDI_CARD_LINK(CARD, `album.html?id=${ALBUM.id}`, `Apri l'album ${ALBUM.title}`);

  CREATE_IMAGE(CARD, BIG_ART(ALBUM.cover), ALBUM.title);
  creaElemento("p", "card-title fw-bold text-truncate mt-0 mb-1 fs-6", CARD, ALBUM.title);
  creaElemento("p", "card-sub text-body-secondary text-truncate m-0 small", CARD, ALBUM.artist);

  // ⭐ NUOVO — cuore: stessa funzione del bottone "+ Salva album" della pagina album
  CREA_CUORE_CARD(CARD, ALBUM.title, () => IS_FAV_ALBUM(ALBUM.id), () => TOGGLE_FAV_ALBUM(ALBUM));
};

const RENDER_ARTIST_CARD = (rawArtist) => {
  const ARTIST = new Artist(rawArtist);
  // ⭐ MODIFICA — "article" invece di "a": dentro ci va il cuore (un <button>)
  const CARD = CREATE_CARD(GRID_ARTISTS, "article");
  const IMAGE_WRAP = creaElemento("div", "card-image-wrap position-relative w-100 overflow-hidden round", CARD);

  // ⭐ MODIFICA — prima era CARD.href = ...: ora il click lo gestisce RENDI_CARD_LINK
  RENDI_CARD_LINK(CARD, `artist.html?id=${ARTIST.id}`, `Apri l'artista ${ARTIST.name}`);

  // Il 🎤 resta come segnaposto finche' non arriva la foto
  creaElemento(
    "div",
    "w-100 h-100 d-flex align-items-center justify-content-center fs-1",
    IMAGE_WRAP,
    "🎤"
  );
  creaElemento("p", "card-title fw-bold text-truncate mt-0 mb-1 fs-6", CARD, ARTIST.name);
  creaElemento("p", "card-sub text-body-secondary text-truncate m-0 small", CARD, ARTIST.genre || "Artista");

  // ⭐ NUOVO — cuore: stessa funzione del bottone "Segui" della pagina artista.
  // Sta sulla CARD (non nel cerchio): la foto, quando arriva, sostituisce il contenuto del cerchio.
  CREA_CUORE_CARD(CARD, ARTIST.name, () => IS_FAV_ARTIST(ARTIST.id), () => TOGGLE_FAV_ARTIST(ARTIST));

  // Chiedo la foto a TheAudioDB (stessa foto della pagina artista)
  CARICA_FOTO_ARTISTA(IMAGE_WRAP, ARTIST.name);
};

const DO_SEARCH = async (term) => {
  const REQUEST_ID = ++searchSequence;
  const NORMALIZED_TERM = term.trim();

  if (!NORMALIZED_TERM) {
    GRID_TRACKS.replaceChildren();
    GRID_ALBUMS.replaceChildren();
    GRID_ARTISTS.replaceChildren();

    ROW_TRACKS.hidden = true;
    ROW_ALBUMS.hidden = true;
    ROW_ARTISTS.hidden = true;

    localStorage.removeItem(STORAGE_KEY_LAST_SEARCH);
    return;
  }

  localStorage.setItem(STORAGE_KEY_LAST_SEARCH, NORMALIZED_TERM);

  const SEARCH_URL = (entity, limit) =>
    `${API_BASE}/search?term=${encodeURIComponent(NORMALIZED_TERM)}&entity=${entity}&limit=${limit}`;

  const [TRACK_RESULT, ALBUM_RESULT, ARTIST_RESULT] = await Promise.allSettled([
    FETCH_JSON(SEARCH_URL("song", 12)),
    FETCH_JSON(SEARCH_URL("album", 8)),
    FETCH_JSON(SEARCH_URL("musicArtist", 8)),
  ]);

  if (REQUEST_ID !== searchSequence) return;

  const TRACK_DATA = TRACK_RESULT.status === "fulfilled" ? TRACK_RESULT.value : {};
  const ALBUM_DATA = ALBUM_RESULT.status === "fulfilled" ? ALBUM_RESULT.value : {};
  const ARTIST_DATA = ARTIST_RESULT.status === "fulfilled" ? ARTIST_RESULT.value : {};

  GRID_TRACKS.replaceChildren();
  GRID_ALBUMS.replaceChildren();
  GRID_ARTISTS.replaceChildren();

  const TRACKS = TRACK_DATA.results || [];
  const ALBUMS = ALBUM_DATA.results || [];
  const ARTISTS = ARTIST_DATA.results || [];

  BRANI_IN_PAGINA = TRACKS.map((grezzo) => new Track(grezzo)); // la coda, prima di disegnare
  TRACKS.forEach(RENDER_TRACK_CARD);
  AGGIORNA_CARD_PLAY(); // le card nuove partono con l'icona giusta (▶ o ⏸)
  ALBUMS.forEach(RENDER_ALBUM_CARD);
  ARTISTS.forEach(RENDER_ARTIST_CARD);

  ROW_TRACKS.hidden = TRACKS.length === 0;
  ROW_ALBUMS.hidden = ALBUMS.length === 0;
  ROW_ARTISTS.hidden = ARTISTS.length === 0;
};

const DEBOUNCED_SEARCH = DEBOUNCE(DO_SEARCH, 400);

INPUT.addEventListener("input", (event) => {
  DEBOUNCED_SEARCH(event.target.value);
});

const ULTIMA_RICERCA = localStorage.getItem(STORAGE_KEY_LAST_SEARCH);

if (ULTIMA_RICERCA) {
  INPUT.value = ULTIMA_RICERCA;
  DO_SEARCH(ULTIMA_RICERCA);
}