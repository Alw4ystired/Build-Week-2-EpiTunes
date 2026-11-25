
/* ============================================================
   common.js — codice condiviso tra tutte le pagine
   ============================================================

   REGOLE GENERALI
   - Solo const e let (mai var)
   - DOM: querySelector / querySelectorAll
   - Eventi: addEventListener (mai onclick inline)
   - fetch + async/await + try/catch
   - localStorage: setItem / getItem / removeItem (salva sempre stringhe)
   - Pattern OOP: classi Track, Album, Artist, Player

   COSA CONTIENE QUESTO FILE
   1) Costanti (URL base API, chiavi localStorage)
   2) Helpers (fetchJSON, formatTime, bigArt, debounce)
   3) Classi modello: Track, Album, Artist
   4) Classe Player (gestisce <audio>)
   5) localStorage helpers (history, favourites)
   6) Render sidebar e player footer
   7) Inizializzazione al DOMContentLoaded

   ESEMPIO USO DELL'ELEMENTO <audio>
   --------------------------------
     const audio = document.querySelector("#audio-element");
     audio.src = "https://...preview.m4a"; // URL della preview MP3
     audio.play();                         // avvia la riproduzione
     audio.pause();                        // mette in pausa
     audio.currentTime = 10;               // salta a 10 secondi
     audio.duration;                       // durata in secondi
     audio.volume = 0.5;                   // volume tra 0 e 1

     audio.addEventListener("timeupdate", () => {
       // chiamato continuamente durante la riproduzione
       const percent = (audio.currentTime / audio.duration) * 100;
     });

     audio.addEventListener("ended", () => {
       // brano finito
     });

   ESEMPIO USO DELL'API iTunes
   ---------------------------
     // Ricerca brani
     fetch("https://itunes.apple.com/search?term=eminem&entity=song&limit=10")

     // Ricerca album
     fetch("https://itunes.apple.com/search?term=pink+floyd&entity=album&limit=10")

     // Ricerca artisti
     fetch("https://itunes.apple.com/search?term=jovanotti&entity=musicArtist&limit=5")

     // Dettagli album (con tracce)
     fetch("https://itunes.apple.com/lookup?id=1440831203&entity=song")

     // Top tracks artista
     fetch("https://itunes.apple.com/lookup?id=909253&entity=song&limit=10")
*/

/* ============================ 1. Costanti ============================ */

const API_BASE = "https://itunes.apple.com";
const STORAGE_KEY_HISTORY = "epitunes_history";
const STORAGE_KEY_FAVOURITES = "epitunes_favourites";
const STORAGE_KEY_LAST_SEARCH = "epitunes_last_search";
const MAX_HISTORY = 12;

/* ============================ 2. Helpers ============================ */

/*
creaElemento(tag, classe, genitore, testo, id)
Crea un elemento del DOM e, se gli passiamo gli argomenti opzionali,
gli mette una classe, ci scrive dentro del testo, gli assegna un id
e lo attacca a un genitore.
Serve a non ripetere ogni volta le stesse righe, e per usare solo createElement + appendChild.
*/

function creaElemento(tag, classe, genitore, testo, id) {
  const elemento = document.createElement(tag); // crea il nodo, per ora staccato dalla pagina

  if (classe) elemento.className = classe; // salta se non passiamo la classe (undefined o "")
  if (testo !== undefined) elemento.textContent = testo; // !== undefined perche' lo 0 e la stringa vuota sono testi validi
  if (id) elemento.id = id; // serve dove il CSS o il JS cercano l'elemento per id
  if (genitore) genitore.appendChild(elemento); // solo qui l'elemento entra davvero nella pagina

  return elemento; // lo restituiamo per poterlo riusare dopo
}

/*
  fetchJSON(url)
  - Fa una richiesta GET e ritorna i dati JSON 
  - Gestisce errori HTTP e di rete con try/catch
  - In caso di errore ritorna { results: [], resultCount: 0 } per semplificare i chiamanti
*/

const fetchJSON = async (url) => {
  try {
    const risposta = await fetch(url);
    // fetch NON lancia errore sugli stati HTTP: un 404 o un 500 arrivano qui
    // come risposte normali. Siamo noi a doverli trasformare in errori.
    if (!risposta.ok) {
      throw new Error(`Richiesta fallita: ${risposta.status} ${risposta.statusText}`);
    }
    return await risposta.json();
  } catch (errore) {
    // Finisce qui sia l'errore lanciato sopra, sia quelli di rete
    // (host irraggiungibile, connessione assente, JSON malformato).
    console.error("fetchJSON:", errore.message, "->", url);
    // Ritorniamo la stessa forma di una risposta riuscita ma vuota:
    // cosi' chi chiama puo' fare sempre dati.results.forEach senza controlli.
    return { results: [], resultCount: 0 };
  }
};

/*
  bigArt(url)
  - L'API iTunes ritorna artwork 100x100 (artworkUrl100)
  - Sostituisce "100x100bb" con "600x600bb" per avere una cover più grande
*/
const bigArt = (url) => {
  if (!url) return "";
  return url.replace("100x100", "600x600");
};

/*
  formatTime(ms)
  - Converte millisecondi in stringa "m:ss"
  - Esempio: 65000 -> "1:05"
*/
const formatTime = (ms) => {
  if (!ms) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
};

/*
  debounce(fn, ms)
  - Restituisce una nuova funzione che chiama fn solo dopo "ms" millisecondi
    di pausa rispetto all'ultima chiamata. Usata per la ricerca al type.
*/
const debounce = (fn, ms) => {
  let timerId = null;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), ms);
  };
};

/* ============================ 3. Classi modello ============================ */

/*
  Classe Track
  Modella un brano restituito dall'API iTunes (wrapperType === "track").
  Campi utili dell'API: trackId, trackName, artistName, collectionName,
  collectionId, artistId, artworkUrl100, previewUrl, trackTimeMillis.
*/
 class Track {
  constructor(raw) {
    this.id = raw.trackId;                 // identifica il brano: history, preferiti, dataset
    this.title = raw.trackName;
    this.artist = raw.artistName;
    this.artistId = raw.artistId;          // per il link a artist.html?id=...
    this.album = raw.collectionName;
    this.albumId = raw.collectionId;       // per il link a album.html?id=...
    this.cover = raw.artworkUrl100;        // 100x100: usa bigArt(cover) dove serve grande
    this.previewUrl = raw.previewUrl;      // l'mp3 da dare all'elemento <audio>
    this.durationMs = raw.trackTimeMillis; // durata del brano intero, non della preview
  }
}

/*
  Classe Album
  Modella un album (wrapperType === "collection").
  Campi utili: collectionId, collectionName, artistName, artworkUrl100,
  releaseDate, trackCount.
*/
 class Album {
  constructor(raw) {
    this.id = raw.collectionId;
    this.title = raw.collectionName;
    this.artist = raw.artistName;
    this.artistId = raw.artistId;          // serve per il link all'artista nell'hero
    this.cover = raw.artworkUrl100;
    // La ISO che ritorna l'API di iTunes è in un formato così "2023-05-15T07:00:00Z", con .slice(0, 4) prendo in considerazione solo i primo 4 valori, nel caso di questo esempio uscirebbe "2023"
    this.year = raw.releaseDate ? raw.releaseDate.slice(0, 4) : "Anno non trovato"; 
    this.trackCount = raw.trackCount;
  }
}

/*
  Classe Artist
  Modella un artista (wrapperType === "artist").
  Campi utili: artistId, artistName, primaryGenreName.
*/
class Artist {
  constructor(raw) {
    this.id = raw.artistId;
    this.name = raw.artistName;
    this.genre = raw.primaryGenreName;
    // NB: l'API non restituisce nessuna immagine per l'artista.
    // La cover della pagina artista va presa dal primo brano.
  }
}

/* ============================ 4. Classe Player ============================ */

/*
  Classe Player
  Gestisce la riproduzione audio e la UI del player footer.

  Stato interno:
    - currentTrack: Track corrente (null se nessun brano)
    - isPlaying: true/false

  Metodi pubblici:
    - mount()        -> rende la UI del player nel footer (.player)
    - play(track)    -> imposta currentTrack, src audio, avvia, salva in history
    - togglePlay()   -> alterna play/pause sul brano corrente
    - setVolume(v)   -> v tra 0 e 1
    - seek(percent)  -> sposta currentTime a percent% della durata

  Eventi audio da agganciare:
    - "timeupdate" per aggiornare la progress bar
    - "ended" per fermarsi a fine brano
*/
class Player {
  constructor() {
    this.audio = document.querySelector("#audio-element");
    this.currentTrack = null;
    this.isPlaying = false;
    // TODO: salva i riferimenti agli elementi del footer (.player-cover, .player-title, ...)
    // TODO: aggancia eventi audio (timeupdate, ended)
  }

  mount() {
    const footer = document.querySelector(".player");
    if (!footer) return;

    footer.replaceChildren(); // svuota, come faceva innerHTML

    /* ---------- SINISTRA: cover + titolo/artista ---------- */
    const playerTrack = creaElemento("div", "player-track d-flex align-items-center", footer);

    const playerCover = creaElemento("div", "player-cover rounded-1 overflow-hidden flex-shrink-0 bg-black", playerTrack);
    const coverImg = creaElemento("img", "w-100 h-100 object-fit-cover d-block", playerCover, undefined, "player-cover-img");
    coverImg.alt = "";

    const playerMeta = creaElemento("div", "player-meta", playerTrack);
    creaElemento("p", "player-title fw-semibold text-truncate m-0", playerMeta, "Seleziona un brano", "player-title");
    creaElemento("p", "player-artist text-body-secondary text-truncate m-0", playerMeta, "—", "player-artist");

    /* ---------- CENTRO: controlli + barra di avanzamento ---------- */
    const playerCenter = creaElemento("div", "player-center d-flex flex-column align-items-center gap-2", footer);

    const controls = creaElemento("div", "player-controls d-flex align-items-center gap-3", playerCenter);
    const bottoni = [
      { id: "btn-shuffle", cls: "btn-ctrl border-0 bg-transparent", label: "Shuffle", text: "⇄" },
      { id: "btn-prev", cls: "btn-ctrl border-0 bg-transparent", label: "Precedente", text: "⏮" },
      { id: "btn-toggle", cls: "btn-play rounded-circle border-0 bg-white text-black", label: "Play/Pausa", text: "▶" },
      { id: "btn-next", cls: "btn-ctrl border-0 bg-transparent", label: "Successivo", text: "⏭" },
      { id: "btn-repeat", cls: "btn-ctrl border-0 bg-transparent", label: "Ripeti", text: "↻" },
    ];
    bottoni.forEach(({ id, cls, label, text }) => {
      const btn = creaElemento("button", cls, controls, text, id);
      btn.setAttribute("aria-label", label);
    });

    const progress = creaElemento("div", "player-progress d-flex align-items-center gap-2 w-100", playerCenter);
    creaElemento("span", undefined, progress, "0:00", "time-current");
    const progressBar = creaElemento("div", "progress-bar flex-grow-1", progress, undefined, "progress-bar");
    creaElemento("div", "progress-fill h-100", progressBar, undefined, "progress-fill");
    creaElemento("span", undefined, progress, "0:00", "time-total");

    /* ---------- DESTRA: volume ---------- */
    const playerRight = creaElemento("div", "player-right align-items-center justify-content-end", footer);
    creaElemento("span", undefined, playerRight, "🔊");
    const volumeBar = creaElemento("div", "volume-bar", playerRight, undefined, "volume-bar");
    const volumeFill = creaElemento("div", "volume-fill h-100", volumeBar, undefined, "volume-fill");
    volumeFill.style.width = "80%";

    // TODO: aggancia eventi click su #btn-toggle, click su #progress-bar (seek),
    //       click su #volume-bar (setVolume), volume iniziale (this.audio.volume = 0.8).
  }

  play(track) {
    // TODO:
    // 1) salva track in this.currentTrack
    // 2) this.audio.src = track.previewUrl
    // 3) this.audio.play()
    // 4) aggiorna UI (cover, titolo, artista, durata totale, icona play -> "⏸")
    // 5) chiama addToHistory(track)
    // 6) marca .track-row.is-playing se siamo nella tracklist
  }

  togglePlay() {
    // TODO: alterna play/pause + aggiorna icona del button
  }

  setVolume(v) {
    // TODO: this.audio.volume = v; aggiorna #volume-fill style.width
  }

  seek(percent) {
    // TODO: this.audio.currentTime = this.audio.duration * percent
  }
}

/* ============================ 5. localStorage helpers ============================ */

/*
  getHistory() -> array di Track (al più MAX_HISTORY)
  addToHistory(track) -> aggiunge in testa, rimuove duplicati, taglia a MAX_HISTORY
  getFavourites() -> array di Track
  isFavourite(trackId) -> bool
  toggleFavourite(track) -> aggiunge o rimuove
*/

/*
  readArray(chiave)
  - Legge un array salvato in localStorage e lo restituisce.
  - try/catch perche' JSON.parse esplode se il contenuto non e' JSON valido
    (puo' capitare se qualcuno modifica a mano i dati dal pannello del browser).
  - Ritorna sempre un array: cosi' i chiamanti possono fare .filter / .map
    senza controllare niente.
*/
const readArray = (chiave) => {
  try {
    const salvato = localStorage.getItem(chiave);
    if (!salvato) return [];                      // chiave mai scritta

    const dati = JSON.parse(salvato);
    return Array.isArray(dati) ? dati : [];       // se non e' un array, lo scartiamo
  } catch (errore) {
    console.error("readArray: dati non validi in", chiave, errore.message);
    return [];
  }
};

/*
  writeArray(chiave, array)
  - localStorage salva solo stringhe, quindi va sempre passato da JSON.stringify.
*/
const writeArray = (chiave, array) => {
  localStorage.setItem(chiave, JSON.stringify(array));
};

const getHistory = () => readArray(STORAGE_KEY_HISTORY);

/*
  addToHistory(track)
  - Rimuove l'eventuale copia dello stesso brano, poi lo rimette in testa:
    cosi' un brano riascoltato risale in cima invece di comparire due volte.
  - Taglia a MAX_HISTORY (12) elementi.
  - Viene chiamata da player.play().
*/
const addToHistory = (track) => {
  const senzaDuplicato = getHistory().filter((t) => t.id !== track.id);
  writeArray(STORAGE_KEY_HISTORY, [track, ...senzaDuplicato].slice(0, MAX_HISTORY));
};

const getFavourites = () => readArray(STORAGE_KEY_FAVOURITES);

const isFavourite = (trackId) => getFavourites().some((t) => t.id === trackId);

/*
  toggleFavourite(track)
  - Se il brano c'e' lo toglie, se non c'e' lo aggiunge in testa.
*/
const toggleFavourite = (track) => {
  const preferiti = getFavourites();
  const giaPresente = preferiti.find((t) => t.id === track.id);

  writeArray(
    STORAGE_KEY_FAVOURITES,
    giaPresente ? preferiti.filter((t) => t.id !== track.id) : [track, ...preferiti]
  );
};

/* ============================ 6. Render sidebar ============================ */

/*
  renderSidebar(activePage)
  - activePage: "home" | "search" | "library" (per evidenziare il link attivo)
*/
const renderSidebar = (activePage) => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  sidebar.replaceChildren();

  /* ---------- Logo ---------- */
  const brand = creaElemento("div", "brand d-flex align-items-center fw-bold", sidebar);
  creaElemento("div", "brand-mark rounded-2 text-black", brand, "E");
  creaElemento("span", "brand-text", brand, "EpiTunes");

  /* ---------- Navigazione ---------- */
  const nav = creaElemento("nav", "sidebar-nav d-flex flex-column gap-1 mb-4", sidebar);
  const links = [
    { href: "index.html", page: "home", ico: "🏠", text: "Home" },
    { href: "search.html", page: "search", ico: "🔍", text: "Cerca" },
  ];
  links.forEach(({ href, page, ico, text }) => {
    const classeAttiva = activePage === page ? " active" : "";
    const a = creaElemento("a", `d-flex align-items-center rounded-2 fw-semibold${classeAttiva}`, nav);
    a.href = href;
    a.dataset.page = page; // diventa data-page="..."
    creaElemento("span", "ico text-center", a, ico);
    creaElemento("span", undefined, a, text);
  });

  /* ---------- Preferiti ---------- */
  creaElemento("p", "sidebar-section-title text-uppercase text-body-secondary m-0", sidebar, "I tuoi preferiti");
  creaElemento("ul", "sidebar-list list-unstyled m-0", sidebar, undefined, "sidebar-favs");

  renderSidebarFavs();
};

/*
  renderSidebarFavs()
  - Riempie la lista dei preferiti in sidebar.
  - Sta in una funzione a parte perche' va richiamata anche dopo ogni
    toggleFavourite, mentre renderSidebar gira una volta sola all'avvio.
*/
const renderSidebarFavs = () => {
  const lista = document.querySelector("#sidebar-favs");
  if (!lista) return;

  const preferiti = getFavourites();
  lista.replaceChildren();

  if (preferiti.length === 0) {
    creaElemento("li", "text-truncate rounded-1", lista, "Nessun preferito");
    return;
  }

  preferiti.forEach((track) => {
    creaElemento("li", "text-truncate rounded-1", lista, track.title);
  });
};

/* ============================ 7. Inizializzazione ============================ */

/*
  initPage(activePage)
  - Chiamata da home.js / search.js / album.js / artist.js
  - Monta sidebar, monta player, restituisce il player per essere usato.
*/
const initPage = (activePage) => {
  renderSidebar(activePage);
  const player = new Player();
  player.mount();
  window.player = player;
  return player;
};


/* ============================ 8. Export ============================ */

export {
  // Costanti
  API_BASE,
  STORAGE_KEY_LAST_SEARCH,
  // Helpers
  creaElemento,
  fetchJSON,
  bigArt,
  formatTime,
  debounce,
  // Classi
  Track,
  Album,
  Artist,
  Player,
  // localStorage
  getHistory,
  addToHistory,
  getFavourites,
  isFavourite,
  toggleFavourite,
  // Render
  renderSidebarFavs,
  // Inizializzazione
  initPage,
}