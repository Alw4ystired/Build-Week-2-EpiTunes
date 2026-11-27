// Importo da common.js solo quello che questo file usa davvero
import {
  INIT_PAGE,
  creaElemento,
  FETCH_JSON,
  BIG_ART,
  FORMAT_TIME,
  Track,
  Artist,
  TOGGLE_FAVOURITE,
  IS_FAVOURITE,
  RENDER_SIDEBAR_FAVS,
  API_BASE,
  CERCA_INFO_ARTISTA, // per foto artista + follower
  IS_FAV_ARTIST,      // ⭐ NUOVO — l'artista e' gia' seguito?
  TOGGLE_FAV_ARTIST,  // ⭐ NUOVO — segui / smetti di seguire
  CREA_PLAY_E_MISCHIA, // ⭐ NUOVO — bottoni ▶ e ⇄ dell'hero
} from "./common.js";

/* ============================================================
   artist.js — pagina dettaglio artista
   ============================================================

   COSA DEVI FARE
   1) INIT_PAGE("home")
   2) Leggi l'id dell'artista dalla query string (URLSearchParams).
   3) Se manca l'id -> messaggio "Artista non trovato" e stop.
   4) fetch /lookup?id=ID&entity=song&limit=15
      - results[0] è l'artist
      - results[1..] sono le top track
   5) Costruisci #artist-hero:
      - kicker "ARTISTA"
      - nome artista grande
      - genere (primaryGenreName) + numero ascoltatori (random, es. Math.random() * 5_000_000)
      - button "Play" -> player.play(prima track)
   6) Costruisci #top-tracks come tracklist (uguale a album).
*/

// 1) Monta sidebar + player e mi restituisce il player da usare per il play
const PLAYER = INIT_PAGE("home");

// I due contenitori vuoti di artist.html che riempirò
const ARTIST_HERO = document.querySelector("#artist-hero");
const TOP_TRACKS = document.querySelector("#top-tracks");

/* ============================ HELPER ============================ */

/*
  mostraMessaggio(testo, classe)
  - Svuota la pagina e mostra un solo messaggio al posto dell'hero.
  - classe: "loader" (caricamento) oppure "empty" (errore / non trovato),
    due classi gia' pronte in app.css (testo grigio centrato).
  - w-100 perche' #artist-hero e' un flex (app.css): senza, il paragrafo
    sarebbe largo quanto il testo e non verrebbe centrato.
*/
const MOSTRA_MESSAGGIO = (testo, classe) => {
  ARTIST_HERO.replaceChildren();
  TOP_TRACKS.replaceChildren();
  creaElemento("p", `${classe} w-100 m-0 text-center text-body-secondary`, ARTIST_HERO, testo);
};

/*
  ascoltatoriCasuali()
  Usata solo quando TheAudioDB non ha i follower dell'artista
  - Math.random() da' un numero tra 0 e 1 -> * 5_000_000 -> tra 0 e 5 milioni.
    (il trattino basso in 5_000_000 serve solo a leggerlo meglio, vale 5000000)
  - toLocaleString("it-IT") aggiunge i punti delle migliaia: 3456789 -> "3.456.789"
*/
const ASCOLTATORI_CASUALI = () => {
  const NUMERO = Math.floor(Math.random() * 5_000_000);
  return NUMERO.toLocaleString("it-IT");
};

/*
  provaImmagini(immagine, indirizzi)
  - Prova gli indirizzi UNO ALLA VOLTA, nell'ordine dato, finche' uno si carica.
    Esempio: [foto TheAudioDB /medium, foto TheAudioDB originale, cover iTunes]
  - Se un indirizzo da' errore (evento "error"), passa al successivo.
  - filter(Boolean) toglie dalla lista i valori vuoti (null, undefined, ""),
    cosi' se TheAudioDB non ha la foto si parte direttamente dalla cover iTunes.
  - Se nessun indirizzo funziona resta il cerchio nero: nessun errore a schermo.
  - { once: true }: ogni listener scatta al massimo una volta.
*/
const PROVA_IMMAGINI = (immagine, indirizzi) => {
  const [PRIMO, ...ALTRI] = indirizzi.filter(Boolean); // primo = da provare ora, altri = riserve
  if (!PRIMO) return; // lista finita: resta il cerchio nero

  immagine.addEventListener("error", () => PROVA_IMMAGINI(immagine, ALTRI), { once: true });
  immagine.src = PRIMO;
};

/*
  aggiornaCuori(trackId)  — identica ad album.js
  - Aggiorna tutti i cuori dello stesso brano (data-fav-id) dopo un click.
*/
const AGGIORNA_CUORI = (trackId) => {
  const PREFERITO = IS_FAVOURITE(trackId); // rileggo lo stato vero da localStorage
  document.querySelectorAll(`[data-fav-id="${trackId}"]`).forEach((bottone) => {
    bottone.classList.toggle("is-fav", PREFERITO); // is-fav = rosso (app.css)
    bottone.textContent = PREFERITO ? "♥" : "♡";
    bottone.setAttribute("aria-pressed", String(PREFERITO)); // per gli screen reader
  });
};

/*
  creaBottoneCuore(track, genitore, classi)  — identica ad album.js
  - Crea un cuore collegato a un brano e lo attacca al genitore.
*/
const CREA_BOTTONE_CUORE = (track, genitore, classi) => {
  const PREFERITO = IS_FAVOURITE(track.id); // parte pieno se e' gia' tra i preferiti
  const BOTTONE = creaElemento(
    "button",
    PREFERITO ? `${classi} is-fav` : classi,
    genitore,
    PREFERITO ? "♥" : "♡"
  );
  BOTTONE.type = "button";
  BOTTONE.dataset.favId = String(track.id); // diventa data-fav-id="..." (serve ad aggiornaCuori)
  BOTTONE.setAttribute("aria-label", `Aggiungi ${track.title} ai preferiti`);
  BOTTONE.setAttribute("aria-pressed", String(PREFERITO));

  BOTTONE.addEventListener("click", (event) => {
    event.stopPropagation(); // il cuore sta DENTRO la riga: non deve far partire il brano
    TOGGLE_FAVOURITE(track); // salva o toglie in localStorage
    AGGIORNA_CUORI(track.id); // aggiorna tutti i cuori di questo brano
    RENDER_SIDEBAR_FAVS(); // aggiorna la lista "I tuoi preferiti" nella sidebar
  });

  return BOTTONE;
};

// ⭐ NUOVO — identica ad album.js
/*
  CREA_LINK_TESTO(track, genitore)
  - Bottoncino "Testo" che apre la pagina del brano (track.html) con il testo scorrevole.
  - stopPropagation: il link sta DENTRO la riga, che al click fa partire il brano.
*/
const CREA_LINK_TESTO = (track, genitore) => {
  const LINK = creaElemento("a", "btn btn-outline-light btn-sm rounded-pill py-0 px-2", genitore, "Testo");
  LINK.href = `track.html?id=${track.id}`;
  LINK.setAttribute("aria-label", `Testo di ${track.title}`);
  LINK.addEventListener("click", (event) => event.stopPropagation());
  return LINK;
};

/* ============================ RENDER ============================ */

/*
  renderHero(artist, tracks)  — punto 5
  Stessa struttura dell'hero di album.js (classi di app.css + utility Bootstrap):
    <div class="album-cover rounded-circle"><img></div>   <- foto tonda
    <div class="hero-meta">
      <p class="hero-kicker">ARTISTA</p>
      <h1 class="hero-title">Nome</h1>
      <p class="hero-sub">Genere<span> · 57.510.550 follower</span></p>
      <div class="hero-actions"> [▶] </div>
    </div>
  Restituisce un oggetto { immagine, conteggio }:
  - immagine  -> l'<img> ancora vuota, la riempie loadArtist
  - conteggio -> lo <span> ancora vuoto dei follower/ascoltatori, lo riempie loadArtist
*/
const RENDER_HERO = (artist, tracks) => {
  ARTIST_HERO.replaceChildren(); // tolgo il messaggio "Caricamento..."


  // Foto: cerchio nero con dentro un'immagine INVISIBILE e SENZA indirizzo.
  // L'indirizzo lo decide loadArtist dopo (cosi' compare una sola immagine).
  const COVER = creaElemento("div", "album-cover rounded-circle overflow-hidden flex-shrink-0 bg-black", ARTIST_HERO);
  // opacity-0 (Bootstrap): immagine trasparente finche' non e' caricata del tutto
  const IMMAGINE = creaElemento("img", "w-100 h-100 object-fit-cover d-block opacity-0", COVER);
  IMMAGINE.alt = artist.name ?? "";
  // Quando una foto si e' caricata davvero (evento "load"), tolgo opacity-0: compare.
  IMMAGINE.addEventListener("load", () => IMMAGINE.classList.remove("opacity-0"), { once: true });

  /* ---------- Testi ---------- */
  const META = creaElemento("div", "hero-meta d-flex flex-column gap-2", ARTIST_HERO);
  creaElemento("p", "hero-kicker text-uppercase fw-bold m-0 small", META, "ARTISTA");
  creaElemento("h1", "hero-title m-0", META, artist.name ?? "Artista sconosciuto");

  // La sotto-riga parte con il solo genere, e lo <span> "conteggio" resta
  // VUOTO: lo riempie loadArtist quando sa se TheAudioDB ha i follower veri.
  // Cosi' non si vede un numero finto che poi cambia (stesso "scatto" della foto).
  const SOTTO_RIGA = creaElemento("p", "hero-sub text-body-secondary m-0 fs-6", META, artist.genre ?? "Genere sconosciuto");
  const CONTEGGIO = creaElemento("span", undefined, SOTTO_RIGA);
 

  /* ---------- Bottoni ▶ e ⇄ ---------- */
  const AZIONI = creaElemento("div", "hero-actions d-flex align-items-center gap-3", META);
  // ⭐ MODIFICA — ▶ e ⇄ li crea CREA_PLAY_E_MISCHIA (common.js), come nella pagina album
  CREA_PLAY_E_MISCHIA(AZIONI, tracks, artist.name);

  // ⭐ NUOVO — "Segui": aggiunge o toglie l'artista dagli "Artisti preferiti".
  const BOTTONE_SEGUI = creaElemento("button", "btn btn-outline-light btn-sm rounded-pill px-3", AZIONI);
  BOTTONE_SEGUI.type = "button";

  const AGGIORNA_SEGUI = () => {
    const SEGUITO = IS_FAV_ARTIST(artist.id);
    BOTTONE_SEGUI.textContent = SEGUITO ? "✓ Segui già" : "Segui";
    BOTTONE_SEGUI.setAttribute("aria-pressed", String(SEGUITO));
  };
  AGGIORNA_SEGUI(); // parte gia' su "✓ Segui già" se l'artista era seguito

  BOTTONE_SEGUI.addEventListener("click", () => {
    TOGGLE_FAV_ARTIST(artist); // salva o toglie l'oggetto Artist in localStorage
    AGGIORNA_SEGUI();
    RENDER_SIDEBAR_FAVS();     // la sidebar si aggiorna subito
  });

  return { IMMAGINE, CONTEGGIO };
};

/*
  renderTopTracks(tracks)  — punto 6
  Tracklist "uguale a album": <li class="track-row d-grid align-items-center"> con numero, titolo,
  durata e cuore (griglia a 4 colonne di app.css).
  In piu' c'e' il titolo "Popolari" sopra, come su Spotify.
*/
const RENDER_TOP_TRACKS = (tracks) => {
  TOP_TRACKS.replaceChildren();

  // Stesso stile dei titoli di sezione di Home e Cerca
  creaElemento("h2", "fs-4 fw-bold mb-3", TOP_TRACKS, "Popolari");

  if (tracks.length === 0) {
    creaElemento("p", "empty m-0 text-center text-body-secondary", TOP_TRACKS, "Nessun brano disponibile per questo artista");
    return;
  }

  // <ol>: lista numerata; list-unstyled toglie i numeri del browser
  const LISTA = creaElemento("ol", "list-unstyled m-0", TOP_TRACKS);

  tracks.forEach((track, indice) => {
    // Niente d-* ne' colori sulla riga: il layout e' la griglia di app.css
    // e il colore cambia con hover / .is-playing
    const RIGA = creaElemento("li", "track-row d-grid align-items-center", LISTA);
    // data-track-id: player.play() lo usa per aggiungere .is-playing (verde)
    RIGA.dataset.trackId = String(track.id);

    creaElemento("span", "track-num text-center text-body-secondary", RIGA, indice + 1); // posizione in classifica
    creaElemento("span", "track-title fw-semibold text-truncate", RIGA, track.title ?? "Brano sconosciuto");
    creaElemento("span", "track-time text-end text-body-secondary", RIGA, FORMAT_TIME(track.durationMs)); // ms -> "m:ss"
    // ⭐ MODIFICA — "Testo" e cuore insieme nell'ultima colonna della griglia
    const AZIONI_RIGA = creaElemento("div", "d-flex align-items-center justify-content-end gap-2", RIGA);
    CREA_LINK_TESTO(track, AZIONI_RIGA);
    CREA_BOTTONE_CUORE(track, AZIONI_RIGA, "track-fav border-0 bg-transparent");

    // Click su tutta la riga -> play (il cuore ferma il click con stopPropagation)
    RIGA.addEventListener("click", () => {
      if (track.previewUrl) PLAYER.play(track, tracks);
    });
  });
};

/* ============================ CARICAMENTO ============================ */

const LOAD_ARTIST = async () => {
  // Leggo l'id dall'indirizzo: artist.html?id=909253 -> "909253"
  const ID = new URLSearchParams(window.location.search).get("id");

  // Niente id nell'indirizzo -> messaggio e stop
  if (!ID) {
    MOSTRA_MESSAGGIO("Artista non trovato", "empty");
    return;
  }

  MOSTRA_MESSAGGIO("Caricamento...", "loader");

  //    Una sola richiesta: artista + i suoi brani piu' popolari.
  //    try/catch e controllo response.ok sono gia' dentro fetchJSON (common.js):
  //    se qualcosa va storto restituisce { results: [] } invece di lanciare un errore.
  const DATI = await FETCH_JSON(`${API_BASE}/lookup?id=${encodeURIComponent(ID)}&entity=song&limit=15`);

  // results[0] deve essere l'artista (wrapperType "artist")
  const PRIMO_RISULTATO = DATI.results[0];
  if (!PRIMO_RISULTATO || PRIMO_RISULTATO.wrapperType !== "artist") {
    MOSTRA_MESSAGGIO("Artista non trovato", "empty"); // id sbagliato, o errore di rete
    return;
  }

  const ARTIST = new Artist(PRIMO_RISULTATO);

  // results[1..] sono le top track: tengo solo i "track" e li trasformo in oggetti Track
  const TRACKS = DATI.results
    .slice(1)
    .filter((raw) => raw.wrapperType === "track")
    .map((raw) => new Track(raw));

  document.title = `${ARTIST.name} — EpiTunes`; // titolo della scheda del browser

  // Restituisce due elementi ancora vuoti:
  // la destrutturazione { immagine, conteggio } li salva in due costanti
  const { IMMAGINE, CONTEGGIO } = RENDER_HERO(ARTIST, TRACKS);
  RENDER_TOP_TRACKS(TRACKS);

  // Una sola richiesta a TheAudioDB per foto e follower.
  // info = { foto, follower } oppure null se l'artista non c'è
  const INFO = await CERCA_INFO_ARTISTA(ARTIST.name);

  // Follower veri se ci sono, altrimenti il numero casuale (come da consegna).
  // Le scritte sono diverse perche' i due numeri NON sono la stessa cosa:
  // i follower sono un dato reale, gli "ascoltatori mensili" sono inventati, ma comunque la dicitura rimane follower.
  CONTEGGIO.textContent = INFO?.follower
    ? ` · ${INFO.follower.toLocaleString("it-IT")} follower`
    : ` · ${ASCOLTATORI_CASUALI()} follower`;

  // Foto: stesso ordine di tentativi di prima (provaImmagini salta i valori vuoti):
  //   1) foto TheAudioDB versione /medium  2) foto TheAudioDB originale
  //   3) cover del primo brano iTunes, solo come riserva
  PROVA_IMMAGINI(IMMAGINE, [
    INFO?.foto ? `${INFO.foto}/medium` : null,
    INFO?.foto,
    BIG_ART(TRACKS[0]?.cover), // ?. perche' l'artista potrebbe non avere brani
  ]);
 };

LOAD_ARTIST();