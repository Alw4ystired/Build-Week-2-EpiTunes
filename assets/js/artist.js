// Importo da common.js solo quello che questo file usa davvero
import {
  initPage,
  creaElemento,
  fetchJSON,
  bigArt,
  formatTime,
  Track,
  Artist,
  toggleFavourite,
  isFavourite,
  renderSidebarFavs,
  API_BASE,
  cercaInfoArtista, // per foto artista + follower
} from "./common.js";

/* ============================================================
   artist.js — pagina dettaglio artista
   ============================================================

   COSA DEVI FARE
   1) initPage("home")
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
const player = initPage("home");

// I due contenitori vuoti di artist.html che riempirò
const artistHero = document.querySelector("#artist-hero");
const topTracks = document.querySelector("#top-tracks");

/* ============================ HELPER ============================ */

/*
  mostraMessaggio(testo, classe)
  - Svuota la pagina e mostra un solo messaggio al posto dell'hero.
  - classe: "loader" (caricamento) oppure "empty" (errore / non trovato),
    due classi gia' pronte in app.css (testo grigio centrato).
  - w-100 perche' #artist-hero e' un flex (app.css): senza, il paragrafo
    sarebbe largo quanto il testo e non verrebbe centrato.
*/
const mostraMessaggio = (testo, classe) => {
  artistHero.replaceChildren();
  topTracks.replaceChildren();
  creaElemento("p", `${classe} w-100 m-0`, artistHero, testo);
};

/*
  ascoltatoriCasuali()
  Usata solo quando TheAudioDB non ha i follower dell'artista
  - Math.random() da' un numero tra 0 e 1 -> * 5_000_000 -> tra 0 e 5 milioni.
    (il trattino basso in 5_000_000 serve solo a leggerlo meglio, vale 5000000)
  - toLocaleString("it-IT") aggiunge i punti delle migliaia: 3456789 -> "3.456.789"
*/
const ascoltatoriCasuali = () => {
  const numero = Math.floor(Math.random() * 5_000_000);
  return numero.toLocaleString("it-IT");
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
const provaImmagini = (immagine, indirizzi) => {
  const [primo, ...altri] = indirizzi.filter(Boolean); // primo = da provare ora, altri = riserve
  if (!primo) return; // lista finita: resta il cerchio nero

  immagine.addEventListener("error", () => provaImmagini(immagine, altri), { once: true });
  immagine.src = primo;
};

/*
  aggiornaCuori(trackId)  — identica ad album.js
  - Aggiorna tutti i cuori dello stesso brano (data-fav-id) dopo un click.
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
  creaBottoneCuore(track, genitore, classi)  — identica ad album.js
  - Crea un cuore collegato a un brano e lo attacca al genitore.
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
    event.stopPropagation(); // il cuore sta DENTRO la riga: non deve far partire il brano
    toggleFavourite(track); // salva o toglie in localStorage
    aggiornaCuori(track.id); // aggiorna tutti i cuori di questo brano
    renderSidebarFavs(); // aggiorna la lista "I tuoi preferiti" nella sidebar
  });

  return bottone;
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
const renderHero = (artist, tracks) => {
  artistHero.replaceChildren(); // tolgo il messaggio "Caricamento..."

  const primaTraccia = tracks[0]; // puo' essere undefined se l'artista non ha brani

  // Foto: cerchio nero con dentro un'immagine INVISIBILE e SENZA indirizzo.
  // L'indirizzo lo decide loadArtist dopo (cosi' compare una sola immagine).
  const cover = creaElemento("div", "album-cover rounded-circle overflow-hidden flex-shrink-0 bg-black", artistHero);
  // opacity-0 (Bootstrap): immagine trasparente finche' non e' caricata del tutto
  const immagine = creaElemento("img", "w-100 h-100 object-fit-cover d-block opacity-0", cover);
  immagine.alt = artist.name ?? "";
  immagine.style.transition = "opacity 0.3s ease"; // comparsa morbida invece di uno scatto
  // Quando una foto si e' caricata davvero (evento "load"), tolgo opacity-0: compare.
  immagine.addEventListener("load", () => immagine.classList.remove("opacity-0"), { once: true });

  /* ---------- Testi ---------- */
  const meta = creaElemento("div", "hero-meta d-flex flex-column gap-2", artistHero);
  creaElemento("p", "hero-kicker text-uppercase fw-bold m-0", meta, "ARTISTA");
  creaElemento("h1", "hero-title m-0", meta, artist.name ?? "Artista sconosciuto");

  // La sotto-riga parte con il solo genere, e lo <span> "conteggio" resta
  // VUOTO: lo riempie loadArtist quando sa se TheAudioDB ha i follower veri.
  // Cosi' non si vede un numero finto che poi cambia (stesso "scatto" della foto).
  const sottoRiga = creaElemento("p", "hero-sub m-0", meta, artist.genre ?? "Genere sconosciuto");
  const conteggio = creaElemento("span", undefined, sottoRiga);
 

  /* ---------- Bottone Play (sulla prima traccia) ---------- */
  const azioni = creaElemento("div", "hero-actions d-flex align-items-center gap-3", meta);
  const bottonePlay = creaElemento("button", "btn-play-big rounded-circle border-0", azioni, "▶");
  bottonePlay.type = "button";
  bottonePlay.setAttribute("aria-label", `Riproduci ${artist.name}`);
  // Spento se non ci sono brani o se il primo non ha l'anteprima
  bottonePlay.disabled = !primaTraccia?.previewUrl;
  // player.play (common.js) avvia l'audio, aggiorna il footer, salva in history
  // e colora di verde la riga .track-row con lo stesso data-track-id
  bottonePlay.addEventListener("click", () => player.play(primaTraccia));

  return { immagine, conteggio };
};

/*
  renderTopTracks(tracks)  — punto 6
  Tracklist "uguale a album": <li class="track-row"> con numero, titolo,
  durata e cuore (griglia a 4 colonne di app.css).
  In piu' c'e' il titolo "Popolari" sopra, come su Spotify.
*/
const renderTopTracks = (tracks) => {
  topTracks.replaceChildren();

  // Stesso stile dei titoli di sezione di Home e Cerca
  creaElemento("h2", "fs-4 fw-bold mb-3", topTracks, "Popolari");

  if (tracks.length === 0) {
    creaElemento("p", "empty m-0", topTracks, "Nessun brano disponibile per questo artista");
    return;
  }

  // <ol>: lista numerata; list-unstyled toglie i numeri del browser
  const lista = creaElemento("ol", "list-unstyled m-0", topTracks);

  tracks.forEach((track, indice) => {
    // Niente d-* ne' colori sulla riga: il layout e' la griglia di app.css
    // e il colore cambia con hover / .is-playing
    const riga = creaElemento("li", "track-row", lista);
    // data-track-id: player.play() lo usa per aggiungere .is-playing (verde)
    riga.dataset.trackId = String(track.id);

    creaElemento("span", "track-num", riga, indice + 1); // posizione in classifica
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

const loadArtist = async () => {
  // Leggo l'id dall'indirizzo: artist.html?id=909253 -> "909253"
  const id = new URLSearchParams(window.location.search).get("id");

  // Niente id nell'indirizzo -> messaggio e stop
  if (!id) {
    mostraMessaggio("Artista non trovato", "empty");
    return;
  }

  mostraMessaggio("Caricamento...", "loader");

  //    Una sola richiesta: artista + i suoi brani piu' popolari.
  //    try/catch e controllo response.ok sono gia' dentro fetchJSON (common.js):
  //    se qualcosa va storto restituisce { results: [] } invece di lanciare un errore.
  const dati = await fetchJSON(`${API_BASE}/lookup?id=${encodeURIComponent(id)}&entity=song&limit=15`);

  // results[0] deve essere l'artista (wrapperType "artist")
  const primoRisultato = dati.results[0];
  if (!primoRisultato || primoRisultato.wrapperType !== "artist") {
    mostraMessaggio("Artista non trovato", "empty"); // id sbagliato, o errore di rete
    return;
  }

  const artist = new Artist(primoRisultato);

  // results[1..] sono le top track: tengo solo i "track" e li trasformo in oggetti Track
  const tracks = dati.results
    .slice(1)
    .filter((raw) => raw.wrapperType === "track")
    .map((raw) => new Track(raw));

  document.title = `${artist.name} — EpiTunes`; // titolo della scheda del browser

  // Restituisce due elementi ancora vuoti:
  // la destrutturazione { immagine, conteggio } li salva in due costanti
  const { immagine, conteggio } = renderHero(artist, tracks);
  renderTopTracks(tracks);

  // Una sola richiesta a TheAudioDB per foto e follower.
  // info = { foto, follower } oppure null se l'artista non c'è
  const info = await cercaInfoArtista(artist.name);

  // Follower veri se ci sono, altrimenti il numero casuale (come da consegna).
  // Le scritte sono diverse perche' i due numeri NON sono la stessa cosa:
  // i follower sono un dato reale, gli "ascoltatori mensili" sono inventati, ma comunque la dicitura rimane follower.
  conteggio.textContent = info?.follower
    ? ` · ${info.follower.toLocaleString("it-IT")} follower`
    : ` · ${ascoltatoriCasuali()} follower`;

  // Foto: stesso ordine di tentativi di prima (provaImmagini salta i valori vuoti):
  //   1) foto TheAudioDB versione /medium  2) foto TheAudioDB originale
  //   3) cover del primo brano iTunes, solo come riserva
  provaImmagini(immagine, [
    info?.foto ? `${info.foto}/medium` : null,
    info?.foto,
    bigArt(tracks[0]?.cover), // ?. perche' l'artista potrebbe non avere brani
  ]);
 };

loadArtist();