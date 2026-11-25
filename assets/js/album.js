// Importo da common.js solo quello che questo file usa davvero
import {
  initPage,
  creaElemento,
  fetchJSON,
  bigArt,
  formatTime,
  Track,
  Album,
  toggleFavourite,
  isFavourite,
  renderSidebarFavs,
  API_BASE,
} from "./common.js";

/* ============================================================
   album.js — pagina dettaglio album
   ============================================================

   COSA DEVI FARE
   1) initPage("home")
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
const player = initPage("home");

// I due contenitori vuoti di album.html che riempirò
const albumHero = document.querySelector("#album-hero");
const tracklist = document.querySelector("#tracklist");

/* ============================ HELPER ============================ */

/*
  mostraMessaggio(testo, classe)
  - Svuota la pagina e mostra un solo messaggio al posto dell'hero.
  - classe: "loader" (caricamento) oppure "empty" (errore / non trovato),
    sono due classi già pronte in app.css (testo grigio centrato).
  - w-100 perche' #album-hero e' un flex (app.css): senza, il paragrafo
    sarebbe largo quanto il testo e non verrebbe centrato.
*/
const mostraMessaggio = (testo, classe) => {
  albumHero.replaceChildren();
  tracklist.replaceChildren();
  creaElemento("p", `${classe} w-100 m-0`, albumHero, testo);
};

/*
  formatDurataTotale(ms)
  - Come formatTime di common.js, ma per la durata di tutto l'album:
    65 minuti -> "1 h 5 min", 42 minuti -> "42 min".
  - Resta privata di questo file (non serve alle altre pagine).
*/
const formatDurataTotale = (ms) => {
  const minutiTotali = Math.round(ms / 60000); // 60000 ms = 1 minuto
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60; // il resto della divisione = minuti avanzati
  return ore > 0 ? `${ore} h ${minuti} min` : `${minuti} min`;
};

/*
  aggiornaCuori(trackId)
  - La prima traccia ha DUE cuori: uno nell'hero e uno nella sua riga.
  - Ogni cuore ha data-fav-id con l'id del brano: cosi' li trovo tutti
    e li aggiorno insieme, invece di aggiornare solo quello cliccato.
*/
const aggiornaCuori = (trackId) => {
  const preferito = isFavourite(trackId); // rileggo lo stato vero da localStorage
  document.querySelectorAll(`[data-fav-id="${trackId}"]`).forEach((bottone) => {
    bottone.classList.toggle("is-fav", preferito); // is-fav = rosso (app.css)
    bottone.textContent = preferito ? "♥" : "♡";
    bottone.setAttribute("aria-pressed", String(preferito)); // per gli screen reader
  });
};

/*
  creaBottoneCuore(track, genitore, classi)
  - Crea un cuore collegato a un brano e lo attacca al genitore.
  - classi: cambiano tra hero (btn-fav-big) e tracklist (track-fav),
    il comportamento invece e' identico.
*/
const creaBottoneCuore = (track, genitore, classi) => {
  const preferito = isFavourite(track.id); // parte pieno se e' gia' tra i preferiti
  const bottone = creaElemento(
    "button",
    preferito ? `${classi} is-fav` : classi,
    genitore,
    preferito ? "♥" : "♡"
  );
  bottone.type = "button";
  bottone.dataset.favId = String(track.id); // diventa data-fav-id="..." (serve ad aggiornaCuori)
  bottone.setAttribute("aria-label", `Aggiungi ${track.title} ai preferiti`);
  bottone.setAttribute("aria-pressed", String(preferito));

  bottone.addEventListener("click", (event) => {
    event.stopPropagation(); // nella tracklist il cuore sta DENTRO la riga: non deve far partire il brano
    toggleFavourite(track); // salva o toglie in localStorage
    aggiornaCuori(track.id); // aggiorna tutti i cuori di questo brano
    renderSidebarFavs(); // aggiorna la lista "I tuoi preferiti" nella sidebar
  });

  return bottone;
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
      <div class="hero-actions"> [▶] [♡] </div>
    </div>
*/
const renderHero = (album, tracks) => {
  albumHero.replaceChildren(); // tolgo il messaggio "Caricamento..."

  /* ---------- Cover grande ---------- */
  // overflow-hidden flex-shrink-0 bg-black: stessi valori di .album-cover in app.css.
  // Niente w-*/h-* Bootstrap: app.css rimpicciolisce la cover sotto gli 800px.
  const cover = creaElemento("div", "album-cover overflow-hidden flex-shrink-0 bg-black", albumHero);
  const immagine = creaElemento("img", "w-100 h-100 object-fit-cover d-block", cover);
  immagine.src = bigArt(album.cover); // 100x100 -> 600x600
  immagine.alt = `Copertina di ${album.title}`;

  /* ---------- Testi ---------- */
  const meta = creaElemento("div", "hero-meta d-flex flex-column gap-2", albumHero);
  // m-0: Bootstrap mette 1rem sotto ogni <p> e <h1>, qui la spaziatura la da' gap-2
  creaElemento("p", "hero-kicker text-uppercase fw-bold m-0", meta, "ALBUM");
  creaElemento("h1", "hero-title m-0", meta, album.title ?? "Titolo sconosciuto");

  // Sotto-riga: il nome dell'artista e' un LINK alla sua pagina
  const sottoRiga = creaElemento("p", "hero-sub m-0", meta);
  const linkArtista = creaElemento("a", "fw-semibold text-body", sottoRiga, album.artist ?? "Artista sconosciuto");
  if (album.artistId) linkArtista.href = `artist.html?id=${album.artistId}`;

  // Numero brani: uso trackCount dell'API, se manca conto le tracce arrivate
  const numeroBrani = album.trackCount ?? tracks.length;
  const parolaBrani = numeroBrani === 1 ? "brano" : "brani";
  // Durata totale: sommo la durata di ogni traccia (?? 0 se una non ce l'ha)
  const durataTotale = tracks.reduce((somma, track) => somma + (track.durationMs ?? 0), 0);
  // Il resto della riga in uno <span>: cosi' lo creo con creaElemento, senza innerHTML
  creaElemento(
    "span",
    undefined,
    sottoRiga,
    ` · ${album.year} · ${numeroBrani} ${parolaBrani} · ${formatDurataTotale(durataTotale)}`
  );

  /* ---------- Bottoni Play + Cuore (sulla prima traccia) ---------- */
  const azioni = creaElemento("div", "hero-actions d-flex align-items-center gap-3", meta);
  const primaTraccia = tracks[0];

  const bottonePlay = creaElemento("button", "btn-play-big rounded-circle border-0", azioni, "▶");
  bottonePlay.type = "button";
  bottonePlay.setAttribute("aria-label", `Riproduci ${album.title}`);
  bottonePlay.disabled = !primaTraccia.previewUrl; // niente anteprima = bottone spento
  bottonePlay.addEventListener("click", () => player.play(primaTraccia));

  // Niente classi colore: .btn-fav-big.is-fav lo colora di rosso in app.css
  creaBottoneCuore(primaTraccia, azioni, "btn-fav-big rounded-circle");
};

/*
  renderTracklist(tracks)  — punto 6
  Una <li class="track-row"> per traccia. In app.css .track-row e' una
  griglia a 4 colonne (32px | 1fr | 80px | 48px): numero, titolo, durata, cuore.
*/
const renderTracklist = (tracks) => {
  tracklist.replaceChildren();

  // <ol> perche' e' una lista NUMERATA (album.html lo chiede).
  // list-unstyled toglie i numeri del browser: il numero lo scrivo io in .track-num
  const lista = creaElemento("ol", "list-unstyled m-0", tracklist);

  tracks.forEach((track, indice) => {
    // Niente d-* ne' colori sulla riga: il layout e' la griglia di app.css
    // e il colore cambia con hover / .is-playing
    const riga = creaElemento("li", "track-row", lista);
    riga.dataset.trackId = String(track.id); // servira' a player.play() per marcarla .is-playing

    creaElemento("span", "track-num", riga, indice + 1); // indice parte da 0, il numero da 1
    creaElemento("span", "track-title", riga, track.title ?? "Brano sconosciuto");
    creaElemento("span", "track-time", riga, formatTime(track.durationMs)); // ms -> "m:ss"
    creaBottoneCuore(track, riga, "track-fav border-0 bg-transparent");

    // Click su tutta la riga -> play (il cuore ferma il click con stopPropagation)
    riga.addEventListener("click", () => {
      if (track.previewUrl) player.play(track);
    });
  });
};

/* ============================ CARICAMENTO ============================ */

const loadAlbum = async () => {
  // 2) Leggo l'id dall'indirizzo: album.html?id=1440831203 -> "1440831203"
  const id = new URLSearchParams(window.location.search).get("id");

  // 3) Niente id nell'indirizzo -> messaggio e stop
  if (!id) {
    mostraMessaggio("Album non trovato", "empty");
    return;
  }

  mostraMessaggio("Caricamento...", "loader");

  // 4) Una sola richiesta: album + tutte le sue tracce.
  //    try/catch e controllo response.ok sono gia' dentro fetchJSON (common.js):
  //    se qualcosa va storto restituisce { results: [] } invece di lanciare un errore.
  const dati = await fetchJSON(`${API_BASE}/lookup?id=${encodeURIComponent(id)}&entity=song`);

  // results[0] deve essere l'album (wrapperType "collection")
  const primoRisultato = dati.results[0];
  if (!primoRisultato || primoRisultato.wrapperType !== "collection") {
    mostraMessaggio("Album non trovato", "empty"); // id sbagliato, o errore di rete
    return;
  }

  const album = new Album(primoRisultato);

  // results[1..] sono le tracce: tengo solo i "track" e li trasformo in oggetti Track
  const tracks = dati.results
    .slice(1)
    .filter((raw) => raw.wrapperType === "track")
    .map((raw) => new Track(raw));

  if (tracks.length === 0) {
    mostraMessaggio("Nessun brano disponibile per questo album", "empty");
    return;
  }

  document.title = `${album.title} — EpiTunes`; // titolo della scheda del browser

  renderHero(album, tracks);
  renderTracklist(tracks);
};

loadAlbum();
