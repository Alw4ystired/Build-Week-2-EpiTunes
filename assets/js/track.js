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

// La funzione che aggiorna ▶/⏸ del brano mostrato. La salvo qui per poterla
// togliere (removeEventListener) quando la pagina si ridisegna per un nuovo
// brano: altrimenti i listener sull'audio si accumulano.
let iconaHeroAttuale = null;

// Numero del caricamento in corso: se nel frattempo ne parte un altro
// (cambio brano veloce), i risultati del vecchio vengono ignorati
let caricamentoAttuale = 0;

/* ============================ TESTO (LYRICS) ============================ */

// LRCLIB: database gratuito di testi, anche sincronizzati.
// Non serve nessuna chiave e funziona direttamente dal browser (CORS abilitato).
// Limite: circa 45 richieste al minuto, a noi ne serve 1-2 per pagina.
const LRCLIB_BASE = "https://lrclib.net/api";

/*
  FORMATTA_SINCRONIZZATO(lrc)
  - LRCLIB da' il testo sincronizzato in formato LRC:
        [00:17.12] Prima riga
        [00:21.40] Seconda riga
        [00:25.03]                 <- riga vuota = pausa strumentale
  - Tolgo la parte [mm:ss.xx] e tengo solo il testo:
        Prima riga
        Seconda riga
        ♪
  - Restituisce una STRINGA con le righe separate da "\n":
    RENDER_TESTO poi la divide e crea una riga animata per ogni frase.
*/
const FORMATTA_SINCRONIZZATO = (lrc) => {
  const RIGHE = lrc.split("\n"); // divido il testo in un array di righe

  const RIGHE_PULITE = RIGHE.map((riga) => {
    if (!riga.startsWith("[")) return riga.trim(); // riga senza tempo: la lascio com'e'

    const FINE = riga.indexOf("]");            // dove si chiude la parentesi del tempo
    const TEMPO = riga.slice(1, FINE);         // "[00:17.12] ciao" -> "00:17.12"
    const TESTO = riga.slice(FINE + 1).trim(); // "[00:17.12] ciao" -> "ciao"

    // Tag che non sono tempi (es. [ar:Artista] in alcuni file LRC): li salto.
    // Un tempo vero ha i minuti come numero prima dei due punti.
    const MINUTI = Number(TEMPO.split(":")[0]);
    if (Number.isNaN(MINUTI)) return "";

    return TESTO || "♪"; // riga vuota = pausa musicale: metto una nota
  });

  // filter(Boolean) toglie le righe vuote (""), join("\n") le riunisce con l'a capo
  return RIGHE_PULITE.filter(Boolean).join("\n");
};


/*
  ESTRAI_TESTO(dati)
  - Da un risultato di LRCLIB tira fuori il testo da mostrare, in quest'ordine:
      1) testo sincronizzato (syncedLyrics) -> formattato con i tempi
      2) testo semplice (plainLyrics)
      3) brano strumentale (instrumental: true) -> messaggio apposito
  - Restituisce null se in quel risultato non c'e' niente di utile.
  - ?. perche' dati potrebbe essere undefined (es. ricerca senza risultati).
*/
const ESTRAI_TESTO = (dati) => {
  if (dati?.syncedLyrics) return FORMATTA_SINCRONIZZATO(dati.syncedLyrics);
  if (dati?.plainLyrics) return dati.plainLyrics;
  if (dati?.instrumental) return "♪ Brano strumentale ♪";
  return null;
};

// cerca il testo su LRCLIB.
// Aggiunti due parametri (album, durataMs): aiutano LRCLIB a trovare la versione giusta.
/*
  CERCA_TESTO(titolo, artista, album, durataMs)
  - Restituisce una STRINGA con il testo, oppure null (regola decisa dal collega:
    RENDER_TESTO non va toccato).
  - TENTATIVO 1: /api/get -> la corrispondenza esatta. Gli passo anche album e
    durata in secondi: LRCLIB accetta il risultato solo se la durata coincide
    (al massimo ±2 secondi), cosi' non prende per esempio una versione live.
  - TENTATIVO 2: se il primo non trova niente (404 "TrackNotFound", che
    FETCH_JSON trasforma in { results: [] }), uso /api/search con solo titolo
    e artista, e prendo il primo risultato che ha un testo.
    Serve perche' a volte la durata di iTunes e quella di LRCLIB non coincidono.
  - NOTA: quando LRCLIB non trova il brano, FETCH_JSON scrive un errore 404
    in console. E' normale: significa solo "testo non trovato".
*/
const CERCA_TESTO = async (titolo, artista, album, durataMs) => {
  if (!titolo || !artista) return null;

  // URLSearchParams costruisce la parte ?chiave=valore&... e codifica
  // da solo spazi e caratteri speciali (come encodeURIComponent)
  const PARAMETRI = new URLSearchParams({
    track_name: titolo,
    artist_name: artista,
  });
  if (album) PARAMETRI.set("album_name", album);
  if (durataMs) PARAMETRI.set("duration", String(Math.round(durataMs / 1000))); // ms -> secondi

  // TENTATIVO 1: corrispondenza esatta
  const ESATTO = await FETCH_JSON(`${LRCLIB_BASE}/get?${PARAMETRI}`);
  const TESTO_ESATTO = ESTRAI_TESTO(ESATTO);
  if (TESTO_ESATTO) return TESTO_ESATTO;

  // TENTATIVO 2: ricerca piu' larga (solo titolo + artista)
  const RICERCA = await FETCH_JSON(
    `${LRCLIB_BASE}/search?${new URLSearchParams({ track_name: titolo, artist_name: artista })}`
  );
  // /api/search restituisce un ARRAY; se c'e' stato un errore FETCH_JSON
  // restituisce invece { results: [] }: Array.isArray distingue i due casi
  if (!Array.isArray(RICERCA)) return null;

  // find: il primo risultato da cui ESTRAI_TESTO riesce a tirare fuori qualcosa
  const TROVATO = RICERCA.find((risultato) => ESTRAI_TESTO(risultato));
  return ESTRAI_TESTO(TROVATO); // null se non c'e' nessun risultato utile
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

  const AZIONI = creaElemento("div", "hero-actions d-flex align-items-center justify-content-center gap-3 pb-0", META)

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

  // Tolgo i listener del brano mostrato prima (se c'era)
  if (iconaHeroAttuale) {
    PLAYER.audio.removeEventListener("play", iconaHeroAttuale);
    PLAYER.audio.removeEventListener("pause", iconaHeroAttuale);
    PLAYER.audio.removeEventListener("ended", iconaHeroAttuale);
  }
  iconaHeroAttuale = AGGIORNA_ICONA;

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
  CENTRA_RIGA(box, riga)
  - Fa scorrere il riquadro del testo finche' la riga cliccata e' al centro.
  - offsetTop = distanza della riga dall'inizio del riquadro (funziona perche'
    il riquadro ha position-relative). Tolgo meta' altezza del riquadro e
    aggiungo meta' altezza della riga: cosi' il CENTRO della riga va al CENTRO del riquadro.
  - Uso box.scrollTo e non riga.scrollIntoView: scrollIntoView farebbe
    scorrere anche tutta la pagina, non solo il riquadro.
*/
const CENTRA_RIGA = (box, riga) => {
  box.scrollTo({
    top: riga.offsetTop - box.clientHeight / 2 + riga.offsetHeight / 2,
    behavior: "smooth",
  });
};

// Prima il testo era un unico paragrafo; ora e' un riquadro con
// scorrimento, righe grandi e la riga centrale "accesa" come su Spotify.
/*
  renderTesto(testo)
  - testo: stringa con il testo (righe separate da "\n"), oppure null.
  - Struttura:
      <h2>Testo</h2>
      <div class="lyrics-box">          <- riquadro che scorre (stile in app.css)
        <p class="lyrics-line">...</p>  <- una per frase
        <p class="lyrics-line is-active">...</p>  <- quella al centro
      </div>
  - Non e' sincronizzato con la musica: la riga accesa e' quella che sta
    al CENTRO del riquadro, e cambia mentre scorri con la rotellina.
*/
const RENDER_TESTO = (testo) => {
  TRACK_LYRICS.replaceChildren();

  // Colonne Bootstrap: il riquadro resta al centro e largo circa come il rettangolo rosso
  const RIGA = creaElemento("div", "row justify-content-center", TRACK_LYRICS);
  const COLONNA = creaElemento("div", "col-12 col-md-8 col-lg-6 text-center", RIGA);
  creaElemento("h2", "fs-4 fw-bold mb-2", COLONNA, "Testo"); //  mb-2 (prima mb-3): un filo piu' compatto

  if (!testo) {
    creaElemento("p", "text-body-secondary", COLONNA, "Testo non ancora disponibile");
    return;
  }

  // Il riquadro che scorre. position-relative serve a CENTRA_RIGA (offsetTop).
  const BOX = creaElemento("div", "lyrics-box position-relative", COLONNA);
  BOX.tabIndex = 0; // si puo' raggiungere col tasto Tab e scorrere con le frecce della tastiera
  BOX.setAttribute("aria-label", "Testo del brano, scorri per leggere");

  // Divido la stringa in righe, tolgo gli spazi ai lati e scarto le righe vuote
  // (il testo semplice di LRCLIB ha righe vuote tra una strofa e l'altra)
  const FRASI = testo
    .split("\n")
    .map((frase) => frase.trim())
    .filter(Boolean);

  // Una <p> per ogni frase. map restituisce l'array degli elementi creati:
  // mi serve dopo per capire quale riga e' al centro.
  const RIGHE = FRASI.map((frase) => {
    const P = creaElemento("p", "lyrics-line", BOX, frase);
    P.addEventListener("click", () => CENTRA_RIGA(BOX, P)); // click = porta la riga al centro
    return P;
  });

  /*
    AGGIORNA_RIGA_ATTIVA()
    - Trova la riga il cui centro e' piu' vicino al centro del riquadro
      e le da' la classe is-active (bianca e piena, vedi app.css).
    - getBoundingClientRect() da' la posizione sullo schermo: confronto
      il centro di ogni riga con il centro del riquadro.
  */
  const AGGIORNA_RIGA_ATTIVA = () => {
    const BOX_RECT = BOX.getBoundingClientRect();
    const CENTRO_BOX = BOX_RECT.top + BOX_RECT.height / 2;

    let rigaPiuVicina = RIGHE[0];
    let distanzaMinima = Infinity; // Infinity = "piu' grande di qualsiasi numero"

    RIGHE.forEach((riga) => {
      const RECT = riga.getBoundingClientRect();
      const DISTANZA = Math.abs(RECT.top + RECT.height / 2 - CENTRO_BOX); // abs = distanza sempre positiva
      if (DISTANZA < distanzaMinima) {
        distanzaMinima = DISTANZA;
        rigaPiuVicina = riga;
      }
    });

    // toggle con il secondo argomento: true = aggiungi la classe, false = toglila
    RIGHE.forEach((riga) => riga.classList.toggle("is-active", riga === rigaPiuVicina));
  };

  BOX.addEventListener("scroll", AGGIORNA_RIGA_ATTIVA); // a ogni movimento della rotellina
  AGGIORNA_RIGA_ATTIVA(); // all'inizio: accende la prima riga
};

/* ============================ CARICAMENTO ============================ */

const LOAD_TRACK = async () => {
  caricamentoAttuale = caricamentoAttuale + 1;
  const QUESTO_CARICAMENTO = caricamentoAttuale;

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
  if (QUESTO_CARICAMENTO !== caricamentoAttuale) return; // e' gia' partito un altro brano

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
  // Passo anche album e durata: LRCLIB trova piu' facilmente
  // la versione giusta del brano (es. non la versione live o remix)
  const TESTO = await CERCA_TESTO(TRACK.title, TRACK.artist, TRACK.album, TRACK.durationMs);
  if (QUESTO_CARICAMENTO !== caricamentoAttuale) return; // testo di un brano vecchio: lo scarto
  RENDER_TESTO(TESTO);
};

LOAD_TRACK();

// Quando il player cambia brano (sidebar, avanti/indietro, fine coda...)
// la pagina segue il brano in ascolto: aggiorno l'id nell'indirizzo e ricarico.
// replaceState non ricarica la pagina, cambia solo l'URL (cosi' anche F5 resta sul brano giusto).
window.addEventListener("cambio-brano", (evento) => {
  const BRANO = evento.detail;
  const ID_ATTUALE = new URLSearchParams(window.location.search).get("id");
  if (!BRANO || String(BRANO.id) === ID_ATTUALE) return; // e' gia' quello mostrato

  history.replaceState(null, "", `track.html?id=${BRANO.id}`);
  LOAD_TRACK();
});
