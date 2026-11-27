// Importo da common.js solo quello che questo file usa davvero
import {
  INIT_PAGE,
  creaElemento,
  FETCH_JSON,
  BIG_ART,
  FORMAT_TIME,
  Track,
  Album,
  TOGGLE_FAVOURITE,
  IS_FAVOURITE,
  RENDER_SIDEBAR_FAVS,
  API_BASE,
  IS_FAV_ALBUM,     // l'album e' gia' salvato?
  TOGGLE_FAV_ALBUM, // salva / togli l'album
  CREA_PLAY_E_MISCHIA, // bottoni ▶ e ⇄ dell'hero
} from "./common.js";

/* ============================================================
   album.js — pagina dettaglio album
   ============================================================

   COSA DEVI FARE
   1) INIT_PAGE("home")
   2) Leggi l'id dell'album dalla query string:
        const id = new URLSearchParams(window.location.search).get("id");
   3) Se manca l'id -> messaggio "Album non trovato" e stop.
   4) fetch /lookup?id=ID&entity=song
      - results[0] è la collection (album)
      - results[1..] sono le track
   5) Costruisci #album-hero con:
      - cover grande (bigArt)
      - kicker "ALBUM"
      - titolo album
      - sotto-riga: artista · anno · numero brani · durata totale
      - button "Play" che chiama player.play sulla prima track
      - button "Cuore" (favourite) sulla prima track
   6) Costruisci #tracklist:
      - una riga per track: numero, titolo, durata, cuore
      - click sulla riga -> player.play(track)
      - click sul cuore -> toggleFavourite(track)
*/

// 1) Monta sidebar + player e mi restituisce il player da usare per il play
const PLAYER = INIT_PAGE("home");

// I due contenitori vuoti di album.html che riempirò
const ALBUM_HERO = document.querySelector("#album-hero");
const TRACKLIST = document.querySelector("#tracklist");

/* ============================ HELPER ============================ */

/*
  mostraMessaggio(testo, classe)
  - Svuota la pagina e mostra un solo messaggio al posto dell'hero.
  - classe: "loader" (caricamento) oppure "empty" (errore / non trovato),
    due classi gia' pronte in app.css (testo grigio centrato).
  - w-100 perche' #album-hero e' un flex (app.css): senza, il paragrafo
    sarebbe largo quanto il testo e non verrebbe centrato.
*/
const MOSTRA_MESSAGGIO = (testo, classe) => {
  ALBUM_HERO.replaceChildren();
  TRACKLIST.replaceChildren();
  creaElemento("p", `${classe} w-100 m-0 text-center text-body-secondary`, ALBUM_HERO, testo);
};

/*
  formatDurataTotale(ms)
  - Come formatTime di common.js, ma per la durata di tutto l'album:
    65 minuti -> "1 h 5 min", 42 minuti -> "42 min".
  - Resta privata di questo file (non serve alle altre pagine).
*/
const FORMAT_DURATA_TOTALE = (ms) => {
  const MINUTI_TOTALI = Math.round(ms / 60000); // 60000 ms = 1 minuto
  const ORE = Math.floor(MINUTI_TOTALI / 60);
  const MINUTI = MINUTI_TOTALI % 60; // il resto della divisione = minuti avanzati
  return ORE > 0 ? `${ORE} h ${MINUTI} min` : `${MINUTI} min`;
};

/*
  aggiornaCuori(trackId)
  - Aggiorna il cuore della riga del brano dopo un click.
  - Ogni cuore ha data-fav-id con l'id del brano: se ci fossero piu' cuori
    per lo stesso brano, si aggiornano tutti insieme.
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
  creaBottoneCuore(track, genitore, classi)
  - Crea un cuore collegato a un brano e lo attacca al genitore.
  - classi: cambiano tra hero (btn-fav-big) e tracklist (track-fav),
    il comportamento invece e' identico.
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
    event.stopPropagation(); // nella tracklist il cuore sta DENTRO la riga: non deve far partire il brano
    TOGGLE_FAVOURITE(track); // salva o toglie in localStorage
    AGGIORNA_CUORI(track.id); // aggiorna tutti i cuori di questo brano
    RENDER_SIDEBAR_FAVS(); // aggiorna la lista "I tuoi preferiti" nella sidebar
  });

  return BOTTONE;
};

/*
  CREA_LINK_TESTO(track, genitore)
  - Bottoncino "Testo" che apre la pagina del brano (track.html) con il testo scorrevole.
  - E' un <a> (link vero) con l'aspetto di un bottone Bootstrap piccolo.
  - stopPropagation: il link sta DENTRO la riga, che al click fa partire il brano.
    Fermo il click qui (la navigazione del link avviene lo stesso).
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
  renderHero(album, tracks)  — punto 5
  Struttura che costruisce (classi di app.css + utility Bootstrap):
    <div class="album-cover"><img></div>
    <div class="hero-meta">
      <p class="hero-kicker">ALBUM</p>
      <h1 class="hero-title">Titolo</h1>
      <p class="hero-sub"><a>Artista</a><span> · anno · brani · durata</span></p>
      <div class="hero-actions"> [▶] [+ Salva album] </div>
    </div>
*/
const RENDER_HERO = (album, tracks) => {
  ALBUM_HERO.replaceChildren(); // tolgo il messaggio "Caricamento..."

  /* ---------- Cover grande ---------- */
  // overflow-hidden flex-shrink-0 bg-black: stessi valori di .album-cover in app.css.
  // Niente w-*/h-* Bootstrap: app.css rimpicciolisce la cover sotto gli 800px.
  const COVER = creaElemento("div", "album-cover overflow-hidden flex-shrink-0 bg-black", ALBUM_HERO);
  const IMMAGINE = creaElemento("img", "w-100 h-100 object-fit-cover d-block", COVER);
  IMMAGINE.src = BIG_ART(album.cover); // 100x100 -> 600x600
  IMMAGINE.alt = `Copertina di ${album.title}`;

  /* ---------- Testi ---------- */
  const META = creaElemento("div", "hero-meta d-flex flex-column gap-2", ALBUM_HERO);
  // m-0: Bootstrap mette 1rem sotto ogni <p> e <h1>, qui la spaziatura la da' gap-2
  creaElemento("p", "hero-kicker text-uppercase fw-bold m-0 small", META, "ALBUM");
  creaElemento("h1", "hero-title m-0", META, album.title ?? "Titolo sconosciuto");

  // Sotto-riga: il nome dell'artista e' un LINK alla sua pagina
  const SOTTO_RIGA = creaElemento("p", "hero-sub text-body-secondary m-0 fs-6", META);
  const LINK_ARTISTA = creaElemento("a", "fw-semibold text-body", SOTTO_RIGA, album.artist ?? "Artista sconosciuto");
  if (album.artistId) LINK_ARTISTA.href = `artist.html?id=${album.artistId}`;

  // Numero brani: uso trackCount dell'API, se manca conto le tracce arrivate
  const NUMERO_BRANI = album.trackCount ?? tracks.length;
  const PAROLA_BRANI = NUMERO_BRANI === 1 ? "brano" : "brani";
  // Durata totale: sommo la durata di ogni traccia (?? 0 se una non ce l'ha)
  const DURATA_TOTALE = tracks.reduce((somma, track) => somma + (track.durationMs ?? 0), 0);
  // album.year arriva gia' pronto dalla classe Album ("2018" oppure "Anno non trovato").
  // Il resto della riga in uno <span>: cosi' lo creo con creaElemento, senza innerHTML
  creaElemento(
    "span",
    undefined,
    SOTTO_RIGA,
    ` · ${album.year} · ${NUMERO_BRANI} ${PAROLA_BRANI} · ${FORMAT_DURATA_TOTALE(DURATA_TOTALE)}`
  );

  /* ---------- Bottoni Play + Salva album ---------- */
  const AZIONI = creaElemento("div", "hero-actions d-flex align-items-center gap-3", META);
  //  ▶ e ⇄ li crea CREA_PLAY_E_MISCHIA (common.js),
  // la stessa funzione usata dalla pagina artista
  CREA_PLAY_E_MISCHIA(AZIONI, tracks, album.title);

  // Tolto il cuore della prima traccia (bastano i cuori delle righe).
  // "+ Salva album": aggiunge o toglie l'album dagli "Album preferiti".
  const BOTTONE_SALVA = creaElemento("button", "btn btn-outline-light btn-sm rounded-pill px-3", AZIONI);
  BOTTONE_SALVA.type = "button";

  // Scrive il testo giusto in base a cosa c'e' in localStorage
  const AGGIORNA_SALVA = () => {
    const SALVATO = IS_FAV_ALBUM(album.id);
    BOTTONE_SALVA.textContent = SALVATO ? "✓ Salvato" : "+ Salva album";
    BOTTONE_SALVA.setAttribute("aria-pressed", String(SALVATO)); // per gli screen reader
  };
  AGGIORNA_SALVA(); // parte gia' su "✓ Salvato" se l'album era stato salvato

  BOTTONE_SALVA.addEventListener("click", () => {
    TOGGLE_FAV_ALBUM(album); // salva o toglie l'oggetto Album in localStorage
    AGGIORNA_SALVA();
    RENDER_SIDEBAR_FAVS();   // la sidebar si aggiorna subito
  });
};

/*
  renderTracklist(tracks)  — punto 6
  Una <li class="track-row d-grid align-items-center"> per traccia. In app.css .track-row e' una
  griglia a 4 colonne (32px | 1fr | 80px | auto): numero, titolo, durata, "Testo" + cuore.
*/
const RENDER_TRACKLIST = (tracks) => {
  TRACKLIST.replaceChildren();

  // <ol> perche' e' una lista NUMERATA (album.html lo chiede).
  // list-unstyled toglie i numeri del browser: il numero lo scrivo io in .track-num
  const LISTA = creaElemento("ol", "list-unstyled m-0", TRACKLIST);

  tracks.forEach((track, indice) => {
    // Niente d-* ne' colori sulla riga: il layout e' la griglia di app.css
    // e il colore cambia con hover / .is-playing
    const RIGA = creaElemento("li", "track-row d-grid align-items-center", LISTA);
    // data-track-id: player.play() cerca .track-row[data-track-id="..."]
    // per aggiungere .is-playing (testo verde) alla riga in riproduzione
    RIGA.dataset.trackId = String(track.id);

    creaElemento("span", "track-num text-center text-body-secondary", RIGA, indice + 1); // indice parte da 0, il numero da 1
    creaElemento("span", "track-title fw-semibold text-truncate", RIGA, track.title ?? "Brano sconosciuto");
    creaElemento("span", "track-time text-end text-body-secondary", RIGA, FORMAT_TIME(track.durationMs)); // ms -> "m:ss"
    // "Testo" e cuore insieme nell'ultima colonna della griglia
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

const LOAD_ALBUM = async () => {
  // 2) Leggo l'id dall'indirizzo: album.html?id=1440831203 -> "1440831203"
  const ID = new URLSearchParams(window.location.search).get("id");

  // 3) Niente id nell'indirizzo -> messaggio e stop
  if (!ID) {
    MOSTRA_MESSAGGIO("Album non trovato", "empty");
    return;
  }

  MOSTRA_MESSAGGIO("Caricamento...", "loader");

  // 4) Una sola richiesta: album + tutte le sue tracce.
  //    try/catch e controllo response.ok sono gia' dentro fetchJSON (common.js):
  //    se qualcosa va storto restituisce { results: [] } invece di lanciare un errore.
  const DATI = await FETCH_JSON(`${API_BASE}/lookup?id=${encodeURIComponent(ID)}&entity=song`);

  // results[0] deve essere l'album (wrapperType "collection")
  const PRIMO_RISULTATO = DATI.results[0];
  if (!PRIMO_RISULTATO || PRIMO_RISULTATO.wrapperType !== "collection") {
    MOSTRA_MESSAGGIO("Album non trovato", "empty"); // id sbagliato, o errore di rete
    return;
  }

  const ALBUM = new Album(PRIMO_RISULTATO);

  // results[1..] sono le tracce: tengo solo i "track" e li trasformo in oggetti Track
  const TRACKS = DATI.results
    .slice(1)
    .filter((raw) => raw.wrapperType === "track")
    .map((raw) => new Track(raw));

  if (TRACKS.length === 0) {
    MOSTRA_MESSAGGIO("Nessun brano disponibile per questo album", "empty");
    return;
  }

  document.title = `${ALBUM.title} — EpiTunes`; // titolo della scheda del browser

  RENDER_HERO(ALBUM, TRACKS);
  RENDER_TRACKLIST(TRACKS);
};

LOAD_ALBUM();