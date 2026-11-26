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
   8) Export

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
// TheAudioDB: API gratuita con le foto degli artisti (iTunes non le ha).
// "123" e' la chiave gratuita indicata nella documentazione.
const AUDIODB_BASE = "https://www.theaudiodb.com/api/v1/json/123";
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
  const ELEMENTO = document.createElement(tag); // crea il nodo, per ora staccato dalla pagina

  if (classe) ELEMENTO.className = classe; // salta se non passiamo la classe (undefined o "")
  if (testo !== undefined) ELEMENTO.textContent = testo; // !== undefined perche' lo 0 e la stringa vuota sono testi validi
  if (id) ELEMENTO.id = id; // serve dove il CSS o il JS cercano l'elemento per id
  if (genitore) genitore.appendChild(ELEMENTO); // solo qui l'elemento entra davvero nella pagina

  return ELEMENTO; // lo restituiamo per poterlo riusare dopo
}

/*
  fetchJSON(url)
  - Fa una richiesta GET e ritorna i dati JSON 
  - Gestisce errori HTTP e di rete con try/catch
  - In caso di errore ritorna { results: [], resultCount: 0 } per semplificare i chiamanti
*/

const FETCH_JSON = async (url) => {
  try {
    const RISPOSTA = await fetch(url);
    // fetch NON lancia errore sugli stati HTTP: un 404 o un 500 arrivano qui
    // come risposte normali. Siamo noi a doverli trasformare in errori.
    if (!RISPOSTA.ok) {
      throw new Error(`Richiesta fallita: ${RISPOSTA.status} ${RISPOSTA.statusText}`);
    }
    return await RISPOSTA.json();
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
  cercaInfoArtista(nome)
  - Cerca l'artista per NOME su TheAudioDB e restituisce (come Promise):
      { foto: "https://..." oppure null, follower: 57510550 oppure null }
    oppure null se TheAudioDB non conosce l'artista.
  - Campi usati della risposta:
      strArtistThumb -> foto dell'artista
      intFollowers   -> numero di follower (arriva come STRINGA, es. "57510550")
  - Number(...) trasforma la stringa in numero; || null copre i casi
    in cui il campo manca o e' vuoto (Number(null) e Number("") danno 0).
  - MEMORIA (infoArtistiCache): la chiave gratuita permette solo 30 richieste
    al minuto. Ogni nome viene chiesto UNA volta sola: le volte dopo la
    risposta arriva dalla Map. Salvo la Promise (non il risultato) cosi'
    due richieste quasi contemporanee dello stesso artista ne fanno partire una.
  - toLowerCase(): "Linkin Park" e "LINKIN PARK" sono lo stesso artista.
*/
const INFO_ARTISTI_CACHE = new Map();

const CERCA_INFO_ARTISTA = (nome) => {
  if (!nome) return Promise.resolve(null); // nessun nome: rispondo subito "niente"

  const CHIAVE = nome.toLowerCase();

  if (!INFO_ARTISTI_CACHE.has(CHIAVE)) {
    const RICHIESTA = FETCH_JSON(`${AUDIODB_BASE}/search.php?s=${encodeURIComponent(nome)}`)
      .then((dati) => {
        const TROVATO = dati.artists?.[0]; // ?. perche' "artists" puo' essere null
        if (!TROVATO) return null; // artista non presente su TheAudioDB

        return {
          foto: TROVATO.strArtistThumb || null,
          follower: Number(TROVATO.intFollowers) || null,
        };
      });
    INFO_ARTISTI_CACHE.set(CHIAVE, RICHIESTA);
  }

  return INFO_ARTISTI_CACHE.get(CHIAVE);
};

/*
  bigArt(url)
  - L'API iTunes ritorna artwork 100x100 (artworkUrl100)
  - Sostituisce "100x100bb" con "600x600bb" per avere una cover più grande
*/
const BIG_ART = (url) => {
  if (!url) return "";
  return url.replace("100x100", "600x600");
};

/*
  formatTime(ms)
  - Converte millisecondi in stringa "m:ss"
  - Esempio: 65000 -> "1:05"
*/
const FORMAT_TIME = (ms) => {
  if (!ms) return "0:00";
  const TOTAL_SEC = Math.floor(ms / 1000);
  const MIN = Math.floor(TOTAL_SEC / 60);
  const SEC = TOTAL_SEC % 60;
  return `${MIN}:${String(SEC).padStart(2, "0")}`;
};

/*
  debounce(fn, ms)
  - Restituisce una nuova funzione che chiama fn solo dopo "ms" millisecondi
    di pausa rispetto all'ultima chiamata. Usata per la ricerca al type.
*/
const DEBOUNCE = (fn, ms) => {
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
    this.el = {}; // lo riempie mount(), quando il footer esiste davvero

    this.audio.addEventListener("timeupdate", () => {
      if (!this.el.tempoCorrente || !this.audio.duration) return;
      this.el.tempoCorrente.textContent = FORMAT_TIME(this.audio.currentTime * 1000);
      this.el.progressFill.style.width = `${(this.audio.currentTime / this.audio.duration) * 100}%`;
    });

    this.audio.addEventListener("ended", () => {
      this.isPlaying = false;
      if (this.el.toggle) this.el.toggle.textContent = "▶";
      AGGIORNA_SIDEBAR_PLAY();
    });

    // Se il file audio non si carica (indirizzo sbagliato,
    // formato non supportato...) il browser lancia l'evento "error":
    // ora lo scriviamo in console invece di ignorarlo, e rimettiamo l'icona ▶
    this.audio.addEventListener("error", () => {
      console.error("Audio non caricato:", this.audio.error?.message || this.audio.error?.code, this.audio.src);
      this.isPlaying = false;
      if (this.el.toggle) this.el.toggle.textContent = "▶";
    });
    //
  }

  mount() {
    const FOOTER = document.querySelector(".player");
    if (!FOOTER) return;

    FOOTER.replaceChildren(); // svuota, come faceva innerHTML

    /* ---------- SINISTRA: cover + titolo/artista ---------- */
    const PLAYER_TRACK = creaElemento("div", "player-track d-flex align-items-center gap-3", FOOTER);

    const PLAYER_COVER = creaElemento("div", "player-cover rounded-1 overflow-hidden flex-shrink-0 bg-black", PLAYER_TRACK);
    const COVER_IMG = creaElemento("img", "w-100 h-100 object-fit-cover d-block", PLAYER_COVER, undefined, "player-cover-img");
    COVER_IMG.alt = "";

    const PLAYER_META = creaElemento("div", "player-meta", PLAYER_TRACK);
    creaElemento("p", "player-title fw-semibold text-truncate m-0", PLAYER_META, "Seleziona un brano", "player-title");
    creaElemento("p", "player-artist text-body-secondary text-truncate m-0", PLAYER_META, "—", "player-artist");

    /* ---------- CENTRO: controlli + barra di avanzamento ---------- */
    const PLAYER_CENTER = creaElemento("div", "player-center d-flex flex-column align-items-center gap-2", FOOTER);

    const CONTROLS = creaElemento("div", "player-controls d-flex align-items-center gap-3", PLAYER_CENTER);
    const BOTTONI = [
      { id: "btn-shuffle", cls: "btn-ctrl border-0 bg-transparent", label: "Shuffle", text: "⇄" },
      { id: "btn-prev", cls: "btn-ctrl border-0 bg-transparent", label: "Precedente", text: "⏮" },
      { id: "btn-toggle", cls: "btn-play rounded-circle border-0 bg-white text-black fs-6", label: "Play/Pausa", text: "▶" },
      { id: "btn-next", cls: "btn-ctrl border-0 bg-transparent", label: "Successivo", text: "⏭" },
      { id: "btn-repeat", cls: "btn-ctrl border-0 bg-transparent", label: "Ripeti", text: "↻" },
    ];
    BOTTONI.forEach(({ id, cls, label, text }) => {
      const BTN = creaElemento("button", cls, CONTROLS, text, id);
      BTN.setAttribute("aria-label", label);
    });

    const PROGRESS = creaElemento("div", "player-progress d-flex align-items-center gap-2 w-100", PLAYER_CENTER);
    creaElemento("span", undefined, PROGRESS, "0:00", "time-current");
    const PROGRESS_BAR = creaElemento("div", "progress-bar flex-grow-1", PROGRESS, undefined, "progress-bar");
    creaElemento("div", "progress-fill h-100", PROGRESS_BAR, undefined, "progress-fill");
    creaElemento("span", undefined, PROGRESS, "0:00", "time-total");

    let staTrascinando = false;

    const SPOSTA_PROGRESS = (evento) => {
      const BOX = PROGRESS_BAR.getBoundingClientRect();
      this.seek((evento.clientX - BOX.left) / BOX.width);
    };

    PROGRESS_BAR.addEventListener("mousedown", (evento) => {
      staTrascinando = true;
      SPOSTA_PROGRESS(evento);
    });

    document.addEventListener("mousemove", (evento) => {
      if (staTrascinando) {
        SPOSTA_PROGRESS(evento);
      }
    });

    document.addEventListener("mouseup", () => {
      staTrascinando = false;
    });

    /* ---------- DESTRA: volume ---------- */
    const PLAYER_RIGHT = creaElemento("div", "player-right d-none d-sm-flex align-items-center justify-content-end gap-2", FOOTER);
    creaElemento("span", undefined, PLAYER_RIGHT, "🔊");
    const VOLUME_BAR = creaElemento("div", "volume-bar", PLAYER_RIGHT, undefined, "volume-bar");
    creaElemento("div", "volume-fill h-100", VOLUME_BAR, undefined, "volume-fill");

    let staTrascinandoVolume = false;

    const SPOSTA_VOLUME = (evento) => {
      evento.preventDefault();
      const BOX = VOLUME_BAR.getBoundingClientRect();
      this.setVolume((evento.clientX - BOX.left) / BOX.width);
    };

    VOLUME_BAR.addEventListener("mousedown", (evento) => {
      evento.preventDefault();
      staTrascinandoVolume = true;
      SPOSTA_VOLUME(evento);
    });

    document.addEventListener("mousemove", (evento) => {
      evento.preventDefault();
      if (staTrascinandoVolume) {
        SPOSTA_VOLUME(evento);
      }
    });

    document.addEventListener("mouseup", () => {
      staTrascinandoVolume = false;
    });

    /* ---------- riferimenti agli elementi, ora che esistono ---------- */

    this.el = {
      cover: document.querySelector("#player-cover-img"),
      titolo: document.querySelector("#player-title"),
      artista: document.querySelector("#player-artist"),
      toggle: document.querySelector("#btn-toggle"),
      tempoCorrente: document.querySelector("#time-current"),
      tempoTotale: document.querySelector("#time-total"),
      progressFill: document.querySelector("#progress-fill"),
      volumeFill: document.querySelector("#volume-fill"),
    };

    this.el.toggle.addEventListener("click", () => this.togglePlay());
    this.setVolume(0.5);
  }

  play(track) {
    if (!track || !track.previewUrl) return;

    this.currentTrack = track;
    this.isPlaying = true;
    this.audio.src = track.previewUrl;

    this.audio.play().catch((errore) => {
      console.error("Riproduzione fallita:", errore.name, errore.message);
      this.isPlaying = false;
      if (this.el.toggle) this.el.toggle.textContent = "▶";
    });


    ADD_TO_HISTORY(track);

    if (this.el.titolo) {
      this.el.cover.src = track.cover;
      this.el.cover.alt = track.title;
      this.el.titolo.textContent = track.title;
      this.el.artista.textContent = track.artist;
      this.el.tempoTotale.textContent = FORMAT_TIME(track.durationMs);
      this.el.toggle.textContent = "⏸";
    }

    document.querySelector(".track-row.is-playing")?.classList.remove("is-playing");
    document.querySelector(`.track-row[data-track-id="${track.id}"]`)?.classList.add("is-playing");
    AGGIORNA_SIDEBAR_PLAY();
  }

  togglePlay() {
    if (!this.currentTrack) return;

    if (this.audio.paused) {
      this.audio.play().catch((errore) => {
        console.error("Riproduzione fallita:", errore.name, errore.message);
        this.isPlaying = false;
        if (this.el.toggle) this.el.toggle.textContent = "▶";
      });
      this.isPlaying = true;
    } else {
      this.audio.pause();
      this.isPlaying = false;
    }

    if (this.el.toggle) this.el.toggle.textContent = this.isPlaying ? "⏸" : "▶";
    AGGIORNA_SIDEBAR_PLAY();
  }

  setVolume(v) {
    const VOLUME = Math.min(1, Math.max(0, v));
    this.audio.volume = VOLUME;

    if (this.el.volumeFill) this.el.volumeFill.style.width = `${VOLUME * 100}%`;
  }

  seek(percent) {
    if (!this.audio.duration) return;

    const FRAZIONE = Math.min(1, Math.max(0, percent));
    this.audio.currentTime = this.audio.duration * FRAZIONE;

    if (this.el.progressFill) this.el.progressFill.style.width = `${FRAZIONE * 100}%`;
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
const READ_ARRAY = (chiave) => {
  try {
    const SALVATO = localStorage.getItem(chiave);
    if (!SALVATO) return [];                      // chiave mai scritta

    const DATI = JSON.parse(SALVATO);
    return Array.isArray(DATI) ? DATI : [];       // se non e' un array, lo scartiamo
  } catch (errore) {
    console.error("readArray: dati non validi in", chiave, errore.message);
    return [];
  }
};

/*
  writeArray(chiave, array)
  - localStorage salva solo stringhe, quindi va sempre passato da JSON.stringify.
*/
const WRITE_ARRAY = (chiave, array) => {
  localStorage.setItem(chiave, JSON.stringify(array));
};

const GET_HISTORY = () => READ_ARRAY(STORAGE_KEY_HISTORY);

/*
  addToHistory(track)
  - Rimuove l'eventuale copia dello stesso brano, poi lo rimette in testa:
    cosi' un brano riascoltato risale in cima invece di comparire due volte.
  - Taglia a MAX_HISTORY (12) elementi.
  - Viene chiamata da player.play().
*/
const ADD_TO_HISTORY = (track) => {
  const SENZA_DUPLICATO = GET_HISTORY().filter((t) => t.id !== track.id);
  WRITE_ARRAY(STORAGE_KEY_HISTORY, [track, ...SENZA_DUPLICATO].slice(0, MAX_HISTORY));
};

const GET_FAVOURITES = () => READ_ARRAY(STORAGE_KEY_FAVOURITES);

const IS_FAVOURITE = (trackId) => GET_FAVOURITES().some((t) => t.id === trackId);

/*
  toggleFavourite(track)
  - Se il brano c'e' lo toglie, se non c'e' lo aggiunge in testa.
*/
const TOGGLE_FAVOURITE = (track) => {
  const PREFERITI = GET_FAVOURITES();
  const GIA_PRESENTE = PREFERITI.find((t) => t.id === track.id);

  WRITE_ARRAY(
    STORAGE_KEY_FAVOURITES,
    GIA_PRESENTE ? PREFERITI.filter((t) => t.id !== track.id) : [track, ...PREFERITI]
  );
};

/* ============================ 6. Render sidebar e bottoni ============================ */

/*
  renderSidebar(activePage)
  - activePage: "home" | "search" | "library" (per evidenziare il link attivo)
*/
const RENDER_SIDEBAR = (activePage) => {
  const SIDEBAR = document.querySelector(".sidebar");
  if (!SIDEBAR) return;

  SIDEBAR.replaceChildren();

  /* ---------- Logo ---------- */
  const BRAND = creaElemento("div", "brand d-flex align-items-center gap-2 fw-bold fs-5", SIDEBAR);
  creaElemento("div", "brand-mark d-flex align-items-center justify-content-center rounded-2 text-black fw-bold", BRAND, "E");
  creaElemento("span", "brand-text d-none d-lg-inline", BRAND, "EpiTunes");

  /* ---------- Navigazione ---------- */
  const NAV = creaElemento("nav", "sidebar-nav d-flex flex-column gap-1 mb-4", SIDEBAR);
  const LINKS = [
    { href: "index.html", page: "home", ico: "🏠", text: "Home" },
    { href: "search.html", page: "search", ico: "🔍", text: "Cerca" },
  ];
  LINKS.forEach(({ href, page, ico, text }) => {
    const CLASSE_ATTIVA = activePage === page ? " active" : "";
    const A = creaElemento("a", `d-flex align-items-center justify-content-center justify-content-lg-start gap-3 px-0 px-lg-3 py-2 rounded-2 fw-semibold${CLASSE_ATTIVA}`, NAV);
    A.href = href;
    A.dataset.page = page; // diventa data-page="..."
    creaElemento("span", "ico text-center fs-5", A, ico);
    creaElemento("span", "d-none d-lg-inline", A, text);
  });

  /* ---------- Preferiti ---------- */
  creaElemento("p", "sidebar-section-title d-none d-lg-block text-uppercase text-body-secondary px-3 pt-3 pb-2 m-0", SIDEBAR, "I tuoi preferiti");
  creaElemento("ul", "sidebar-list d-none d-lg-flex flex-column gap-1 list-unstyled m-0 px-1", SIDEBAR, undefined, "sidebar-favs");

  RENDER_SIDEBAR_FAVS();
};

/*
  renderSidebarFavs()
  - Riempie la lista dei preferiti in sidebar.
  - Sta in una funzione a parte perche' va richiamata anche dopo ogni
    toggleFavourite, mentre renderSidebar gira una volta sola all'avvio.
*/
const RENDER_SIDEBAR_FAVS = () => {
  const LISTA = document.querySelector("#sidebar-favs");
  if (!LISTA) return;

  const PREFERITI = GET_FAVOURITES();
  LISTA.replaceChildren();

  if (PREFERITI.length === 0) {
    creaElemento("li", "text-truncate rounded-1 px-2 py-2", LISTA, "Nessun preferito");
    return;
  }

  PREFERITI.forEach((track) => {
    const RIGA = creaElemento("li", "text-truncate rounded-1 px-2 py-2", LISTA, track.title);
    RIGA.dataset.trackId = String(track.id);

    const BOTTONE = creaElemento("button", "sidebar-play position-absolute rounded-circle border-0 text-black d-flex align-items-center justify-content-center", RIGA, "▶");
    BOTTONE.type = "button";
    BOTTONE.setAttribute("aria-label", `Riproduci o metti in pausa ${track.title}`);

    BOTTONE.addEventListener("click", () => {
      const PLAYER = window.player;
      if (PLAYER.currentTrack && PLAYER.currentTrack.id === track.id) {
        PLAYER.togglePlay();
      } else {
        PLAYER.play(track);
      }
    });
  });

  AGGIORNA_SIDEBAR_PLAY();
};

const AGGIORNA_SIDEBAR_PLAY = () => {
  const PLAYER = window.player;
  const RIGHE = document.querySelectorAll("#sidebar-favs li");

  RIGHE.forEach((riga) => {
    const BOTTONE = riga.querySelector(".sidebar-play");
    if (!BOTTONE) return; // la riga "Nessun preferito" non ha il bottone

    let inRiproduzione = false;
    if (PLAYER && PLAYER.currentTrack && String(PLAYER.currentTrack.id) === riga.dataset.trackId) {
      inRiproduzione = true;
    }

    riga.classList.toggle("is-playing", inRiproduzione);

    if (inRiproduzione && PLAYER.isPlaying) {
      BOTTONE.textContent = "⏸";
    } else {
      BOTTONE.textContent = "▶";
    }
  });
};

/*
  attivaFrecce()
  - Collega le frecce ‹ › della topbar (#btn-indietro, #btn-avanti)
    alla cronologia del browser, come le frecce del browser stesso:
      indietro -> history.back()    (torna alla pagina precedente)
      avanti   -> history.forward() (annulla l'ultimo "indietro")
  - Se il browser supporta la Navigation API (window.navigation), DISATTIVA
    le frecce che non hanno niente da fare:
      canGoBack    = c'e' una pagina precedente?
      canGoForward = sono tornato indietro almeno una volta? (c'e' un "avanti"?)
  - Se la Navigation API non c'e', le frecce restano sempre attive:
    funzionano comunque, history.forward() senza "avanti" non fa nulla.
*/
const attivaFrecce = () => {
  const indietro = document.querySelector("#btn-indietro");
  const avanti = document.querySelector("#btn-avanti");
  if (!indietro || !avanti) return; // pagina senza frecce: non faccio niente

  // Il comportamento: deleghiamo tutto alla cronologia del browser
  indietro.addEventListener("click", () => history.back());
  avanti.addEventListener("click", () => history.forward());

  // Feature detection: se il browser non ha la Navigation API mi fermo qui
  const navigazione = window.navigation;
  if (!navigazione) return;

  // Aggiorna lo stato dei bottoni (attivo / disattivato)
  const aggiornaStato = () => {
    indietro.disabled = !navigazione.canGoBack;
    avanti.disabled = !navigazione.canGoForward;
    // opacity-50 (Bootstrap): freccia semi-trasparente quando e' disattivata
    indietro.classList.toggle("opacity-50", indietro.disabled);
    avanti.classList.toggle("opacity-50", avanti.disabled);
  };

  aggiornaStato(); // stato iniziale, appena la pagina si carica

  // "pageshow" scatta anche quando il browser, tornando indietro, ripristina
  // la pagina dalla sua memoria (bfcache) SENZA rieseguire il JavaScript:
  // senza questo, la freccia "avanti" resterebbe disattivata anche quando
  // in realta' c'e' una pagina in avanti.
  window.addEventListener("pageshow", aggiornaStato);
};

/* ============================ 7. Inizializzazione ============================ */

/*
  INIT_PAGE(activePage)
  - Chiamata da home.js / search.js / album.js / artist.js
  - Monta sidebar, monta player, restituisce il player per essere usato.
  - Fa in modo che le frecce ‹ › della topbar vadano avanti e indietro
*/
const INIT_PAGE = (activePage) => {
  RENDER_SIDEBAR(activePage);
   attivaFrecce();
  const PLAYER = new Player();
  PLAYER.mount();
  window.player = PLAYER;
  return PLAYER;
};

/* ============================ 8. Export ============================ */

export {
  // Costanti
  API_BASE,
  STORAGE_KEY_LAST_SEARCH,
  // Helpers
  creaElemento,
  FETCH_JSON,
  BIG_ART,
  FORMAT_TIME,
  DEBOUNCE,
  CERCA_INFO_ARTISTA,
  // Classi
  Track,
  Album,
  Artist,
  Player,
  // localStorage
  GET_HISTORY,
  ADD_TO_HISTORY,
  GET_FAVOURITES,
  IS_FAVOURITE,
  TOGGLE_FAVOURITE,
  // Render
  RENDER_SIDEBAR_FAVS,
  // Inizializzazione
  INIT_PAGE,
};