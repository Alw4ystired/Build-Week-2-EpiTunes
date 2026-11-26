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
  FAV_BUTTON.setAttribute("aria-label", `Aggiungi ${TRACK.title} ai preferiti`);

  FAV_BUTTON.addEventListener("click", (event) => {
    event.stopPropagation();
    TOGGLE_FAVOURITE(TRACK);

    const ORA = IS_FAVOURITE(TRACK.id);
    FAV_BUTTON.classList.toggle("is-fav", ORA);
    FAV_BUTTON.textContent = ORA ? "♥" : "♡";

    RENDER_SIDEBAR_FAVS();
  });

  const PLAY_BUTTON = creaElemento("button", "card-play position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center", CARD, "▶");

  PLAY_BUTTON.type = "button";
  PLAY_BUTTON.setAttribute(
    "aria-label",
    TRACK.previewUrl
      ? `Riproduci ${TRACK.title} di ${TRACK.artist}`
      : `Anteprima non disponibile per ${TRACK.title}`
  );
  PLAY_BUTTON.disabled = !TRACK.previewUrl;

  PLAY_BUTTON.addEventListener("click", (event) => {
    event.stopPropagation();
    if (TRACK.previewUrl) PLAYER.play(TRACK);
  });

  CARD.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    if (TRACK.previewUrl) PLAYER.play(TRACK);
  });
};

const RENDER_ALBUM_CARD = (rawAlbum) => {
  const ALBUM = new Album(rawAlbum);
  const CARD = CREATE_CARD(GRID_ALBUMS, "a");

  CARD.href = `album.html?id=${ALBUM.id}`;

  CREATE_IMAGE(CARD, BIG_ART(ALBUM.cover), ALBUM.title);
  creaElemento("p", "card-title fw-bold text-truncate mt-0 mb-1 fs-6", CARD, ALBUM.title);
  creaElemento("p", "card-sub text-body-secondary text-truncate m-0 small", CARD, ALBUM.artist);
};

const RENDER_ARTIST_CARD = (rawArtist) => {
  const ARTIST = new Artist(rawArtist);
  const CARD = CREATE_CARD(GRID_ARTISTS, "a");
  const IMAGE_WRAP = creaElemento("div", "card-image-wrap position-relative w-100 overflow-hidden round", CARD);

  CARD.href = `artist.html?id=${ARTIST.id}`;

  // Il 🎤 resta come segnaposto finche' non arriva la foto
  creaElemento(
    "div",
    "w-100 h-100 d-flex align-items-center justify-content-center fs-1",
    IMAGE_WRAP,
    "🎤"
  );
  creaElemento("p", "card-title fw-bold text-truncate mt-0 mb-1 fs-6", CARD, ARTIST.name);
  creaElemento("p", "card-sub text-body-secondary text-truncate m-0 small", CARD, ARTIST.genre || "Artista");

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

  TRACKS.forEach(RENDER_TRACK_CARD);
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