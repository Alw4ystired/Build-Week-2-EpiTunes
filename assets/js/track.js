// Importo da common.js solo quello che questo file usa davvero
import {
  INIT_PAGE,
  creaElemento,
  FETCH_JSON,
  BIG_ART,
  FORMAT_TIME,
  Track,
  TOGGLE_FAVOURITE,
  IS_FAVOURITE,
  RENDER_SIDEBAR_FAVS,
  API_BASE,
} from "./common.js";

/* ============================================================
   track.js — pagina dettaglio brano (track.html?id=...)
   ============================================================

   COSA FA
   1) INIT_PAGE("home")  // monta sidebar + player
   2) Legge l'id del brano dall'indirizzo (URLSearchParams)
   3) fetch /lookup?id=ID  -> results[0] e' il brano
   4) Hero al centro: cover grande, titolo, artista, album, anno, genere, durata, Play, Cuore
   5) Sotto: il testo (lyrics), preso da CERCA_TESTO
*/

const PLAYER = INIT_PAGE("home");

// I due contenitori vuoti di track.html che riempio
const TRACK_HERO = document.querySelector("#track-hero");
const TRACK_LYRICS = document.querySelector("#track-lyrics");

/* ============================ TESTO (LYRICS) ============================ */

/*
  CERCA_TESTO(titolo, artista)
  - QUI VA COLLEGATA LA API DEI TESTI (la sta cercando il collega).
  - Regola da rispettare: restituire una STRINGA con il testo,
    oppure null se il testo non si trova.
  - Il resto della pagina non va toccato: basta cambiare questa funzione.
  - Esempio di come potrebbe diventare:
      const DATI = await FETCH_JSON(`https://URL_API/${encodeURIComponent(artista)}/${encodeURIComponent(titolo)}`);
      return DATI.lyrics ?? null;
*/
const CERCA_TESTO = async (titolo, artista) => {
  return null;
};

/* ============================ HELPER ============================ */

/*
  mostraMessaggio(testo, classe)
  - Svuota la pagina e mostra un solo messaggio (caricamento o errore).
*/
const MOSTRA_MESSAGGIO = (testo, classe) => {
  TRACK_HERO.replaceChildren();
  TRACK_LYRICS.replaceChildren();
  creaElemento("p", `${classe} w-100 m-0 text-center text-body-secondary`, TRACK_HERO, testo);
};

/* ============================ RENDER ============================ */

/*
  renderHero(track, raw)
  - track: oggetto Track (titolo, artista, cover...)
  - raw: la risposta grezza dell'API: serve per anno e genere,
    che la classe Track non salva.
  Usa le stesse classi dell'hero di album.js, ma centrate.
*/
const RENDER_HERO = (track, raw) => {
  TRACK_HERO.replaceChildren(); // tolgo il messaggio "Caricamento..."

  /* ---------- Cover in alto al centro ---------- */
  // Stesse classi dell'hero di album.js: la grandezza la decide .album-cover in app.css
  const COVER = creaElemento("div", "album-cover rounded-3 overflow-hidden flex-shrink-0 bg-black", TRACK_HERO);
  const IMMAGINE = creaElemento("img", "w-100 h-100 object-fit-cover d-block", COVER);
  IMMAGINE.src = BIG_ART(track.cover); // 100x100 -> 600x600
  IMMAGINE.alt = `Copertina di ${track.title}`;

  /* ---------- Testi (centrati) ---------- */
  const META = creaElemento("div", "hero-meta d-flex flex-column align-items-center gap-2", TRACK_HERO);
  creaElemento("p", "hero-kicker text-uppercase fw-bold m-0 small", META, "BRANO");
  creaElemento("h1", "hero-title m-0", META, track.title ?? "Titolo sconosciuto");

  // Artista e album sono LINK alle loro pagine
  const RIGA_ARTISTA = creaElemento("p", "fs-5 m-0", META);
  const LINK_ARTISTA = creaElemento("a", "fw-semibold text-body", RIGA_ARTISTA, track.artist ?? "Artista sconosciuto");
  if (track.artistId) {
    LINK_ARTISTA.href = `artist.html?id=${track.artistId}`;
  }
  if (track.album) {
    creaElemento("span", "text-body-secondary", RIGA_ARTISTA, " · ");
    const LINK_ALBUM = creaElemento("a", "text-body-secondary", RIGA_ARTISTA, track.album);
    if (track.albumId) {
      LINK_ALBUM.href = `album.html?id=${track.albumId}`;
    }
  }

  // Anno, genere e durata
  let anno = "Anno non trovato";
  if (raw.releaseDate) {
    anno = raw.releaseDate.slice(0, 4); // "2023-05-15T07:00:00Z" -> "2023"
  }
  let genere = "Genere sconosciuto";
  if (raw.primaryGenreName) {
    genere = raw.primaryGenreName;
  }
  creaElemento("p", "hero-sub text-body-secondary m-0 fs-6", META, `${anno} · ${genere} · ${FORMAT_TIME(track.durationMs)}`);

  /* ---------- Bottoni Play + Cuore (stessi di album.js) ---------- */
  const AZIONI = creaElemento("div", "hero-actions d-flex align-items-center justify-content-center gap-3", META);

  const BOTTONE_PLAY = creaElemento("button", "btn-play-big rounded-circle border-0 fs-6", AZIONI, "▶");
  BOTTONE_PLAY.type = "button";
  BOTTONE_PLAY.setAttribute("aria-label", `Riproduci ${track.title}`);
  BOTTONE_PLAY.disabled = !track.previewUrl; // niente anteprima = bottone spento

  // Mette ▶ oppure ⏸ in base a cosa sta succedendo nel player
  const AGGIORNA_ICONA = () => {
    const E_QUESTO_BRANO = PLAYER.currentTrack && PLAYER.currentTrack.id === track.id;
    if (E_QUESTO_BRANO && PLAYER.isPlaying) {
      BOTTONE_PLAY.textContent = "⏸";
    } else {
      BOTTONE_PLAY.textContent = "▶";
    }
  };

  AGGIORNA_ICONA(); // se il brano sta gia' suonando (arrivo dal footer) parte con ⏸

  BOTTONE_PLAY.addEventListener("click", () => {
    if (PLAYER.currentTrack && PLAYER.currentTrack.id === track.id) {
      PLAYER.togglePlay(); // e' gia' questo brano: play/pausa
    } else {
      PLAYER.play(track); // altro brano (o nessuno): faccio partire questo
    }
    AGGIORNA_ICONA();
  });

  // Se play/pausa/fine arrivano da fuori (es. dal pulsante nel footer), aggiorno comunque l'icona
  PLAYER.audio.addEventListener("play", AGGIORNA_ICONA);
  PLAYER.audio.addEventListener("pause", AGGIORNA_ICONA);
  PLAYER.audio.addEventListener("ended", AGGIORNA_ICONA);

  const BOTTONE_CUORE = creaElemento("button", "btn-fav-big rounded-circle fs-5", AZIONI);
  BOTTONE_CUORE.type = "button";

  // Sistema simbolo e colore del cuore in base a localStorage (is-fav = rosso in app.css)
  const AGGIORNA_CUORE = () => {
    const PREFERITO = IS_FAVOURITE(track.id);
    BOTTONE_CUORE.classList.toggle("is-fav", PREFERITO);
    if (PREFERITO) {
      BOTTONE_CUORE.textContent = "♥";
    } else {
      BOTTONE_CUORE.textContent = "♡";
    }
    BOTTONE_CUORE.setAttribute("aria-pressed", String(PREFERITO));
    BOTTONE_CUORE.setAttribute("aria-label", `Aggiungi o togli ${track.title} dai preferiti`);
  };
  AGGIORNA_CUORE(); // parte pieno se e' gia' tra i preferiti

  BOTTONE_CUORE.addEventListener("click", () => {
    TOGGLE_FAVOURITE(track); // salva o toglie
    AGGIORNA_CUORE();
    RENDER_SIDEBAR_FAVS(); // aggiorno anche la lista nella sidebar
  });
};

/*
  renderTesto(testo)
  - testo: stringa col testo, oppure null se non c'e'.
  - Colonne Bootstrap: il testo resta al centro e non troppo largo.
*/
const RENDER_TESTO = (testo) => {
  TRACK_LYRICS.replaceChildren();

  const RIGA = creaElemento("div", "row justify-content-center", TRACK_LYRICS);
  const COLONNA = creaElemento("div", "col-12 col-md-8 col-lg-6 text-center", RIGA);
  creaElemento("h2", "fs-4 fw-bold mb-3", COLONNA, "Testo");

  if (testo) {
    const PARAGRAFO = creaElemento("p", "lh-lg", COLONNA, testo);
    PARAGRAFO.style.whiteSpace = "pre-line"; // rispetta gli "a capo" del testo
  } else {
    creaElemento("p", "text-body-secondary", COLONNA, "Testo non ancora disponibile");
  }
};

/* ============================ CARICAMENTO ============================ */

const LOAD_TRACK = async () => {
  // Leggo l'id dall'indirizzo: track.html?id=1440831203 -> "1440831203"
  const ID = new URLSearchParams(window.location.search).get("id");

  // Niente id nell'indirizzo -> messaggio e stop
  if (!ID) {
    MOSTRA_MESSAGGIO("Brano non trovato", "empty");
    return;
  }

  MOSTRA_MESSAGGIO("Caricamento...", "loader");

  // Una sola richiesta: il brano con quell'id.
  // try/catch e controllo response.ok sono gia' dentro FETCH_JSON (common.js).
  const DATI = await FETCH_JSON(`${API_BASE}/lookup?id=${encodeURIComponent(ID)}`);

  // results[0] deve essere il brano (wrapperType "track")
  const RAW = DATI.results[0];
  if (!RAW || RAW.wrapperType !== "track") {
    MOSTRA_MESSAGGIO("Brano non trovato", "empty"); // id sbagliato, o errore di rete
    return;
  }

  const TRACK = new Track(RAW);

  document.title = `${TRACK.title} — EpiTunes`; // titolo della scheda del browser
  RENDER_HERO(TRACK, RAW);

  // Il testo arriva dopo: intanto mostro un messaggio di attesa
  TRACK_LYRICS.replaceChildren();
  creaElemento("p", "text-center text-body-secondary", TRACK_LYRICS, "Caricamento del testo...");
  const TESTO = await CERCA_TESTO(TRACK.title, TRACK.artist);
  RENDER_TESTO(TESTO);
};

LOAD_TRACK();
