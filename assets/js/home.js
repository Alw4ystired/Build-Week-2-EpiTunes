// Importo da common.js solo quello che questo file usa davvero
import {
  initPage,
  getFavourites,
  toggleFavourite,
  isFavourite,
  getHistory,
  renderSidebarFavs,
  
  creaElemento,
  fetchJSON,
  bigArt,
  Track,
} from "./common.js";

/* ============================================================
   home.js — costruzione della Home
   ============================================================

   COSA DEVI FARE
   1) initPage("home")  // monta sidebar + player
   2) Costruisci queste righe (sezioni) nella .home:
        - "Riprodotti di recente" (da getHistory())  -- mostra solo se non vuota
        - "I tuoi preferiti"       (da getFavourites()) -- mostra solo se non vuota
        - "Suggerimenti pop"       (fetch search term=pop entity=song limit=12)
        - "Suggerimenti rock"      (fetch search term=rock entity=song limit=12)
        - "Suggerimenti hits"   (fetch search term=hits pop entity=song limit=12)
   3) Le tre fetch dei suggerimenti vanno in PARALLELO con Promise.all
   4) Ogni card è una Track: cover, titolo, artista, button play, button cuore (favourite)
   5) Click card -> window.player.play(track)
   6) Click cover senza play -> link a album.html?id=albumId (opzionale)
*/

const player = initPage("home");

const home = document.querySelector(".home");

/*
  renderRow(rowTitle, tracks)
  - crea una <section> con titolo h2 e una griglia Bootstrap (row > col > card)
  - una card per ogni track: cover, titolo, artista, bottone play, bottone cuore
  - se l'array è vuoto non crea niente (nessuna sezione vuota con solo il titolo)
*/
const renderRow = (rowTitle, tracks, idSezione) => {
  if (!tracks || tracks.length === 0) return;

  const section = creaElemento("section", "mt-4", home);
  if (idSezione) {
    section.id = idSezione;
  }
  creaElemento("h2", "fs-4 fw-bold mb-3", section, rowTitle);

  const grid = creaElemento(
    "div",
    "row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-6 g-3",
    section
  );

  tracks.forEach((track) => {
    const column = creaElemento("div", "col", grid);
    const card = creaElemento("article", "card h-100 border-0", column);
    card.dataset.trackId = String(track.id);

    // Cover
    const imageWrap = creaElemento("div", "card-image-wrap", card);
    const image = creaElemento(
      "img",
      "w-100 h-100 object-fit-cover d-block",
      imageWrap
    );

    image.src = bigArt(track.cover);
    image.alt = track.title ?? "";
    image.loading = "lazy";

    // Titolo e artista
    creaElemento("p", "card-title", card, track.title);
    creaElemento("p", "card-sub", card, track.artist);

    // Cuore
    const giaPreferito = isFavourite(track.id);
    const favButton = creaElemento(
      "button",
      giaPreferito ? "card-fav is-fav" : "card-fav",
      card,
      giaPreferito ? "♥" : "♡"
    );

    favButton.type = "button";
    favButton.setAttribute(
      "aria-label",
      `${giaPreferito ? "Rimuovi" : "Aggiungi"} ${track.title} ${
        giaPreferito ? "dai" : "ai"
      } preferiti`
    );
    //clicco dei favoriti 
    favButton.addEventListener("click", (event) => {
      event.stopPropagation();

      // Aggiunge o rimuove il brano dai preferiti
      toggleFavourite(track);
      const ora = isFavourite(track.id); // rileggo lo stato aggiornato
      favButton.classList.toggle("is-fav", ora);
      favButton.textContent = ora ? "♥" : "♡";
      renderSidebarFavs(); // aggiorno anche la lista nella sidebar
      AGGIORNA_PREFERITI(); 
    });

    // Bottone play
    const playButton = creaElemento("button", "card-play", card, "▶");
    playButton.type = "button";
    playButton.setAttribute(
      "aria-label",
      `Riproduci ${track.title} di ${track.artist}`
    );
    playButton.disabled = !track.previewUrl;

    playButton.addEventListener("click", (event) => {
      event.stopPropagation();

      if (track.previewUrl) {
        player.play(track);
      }
    });

    // Click sulla card per riprodurre
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;

      if (track.previewUrl) {
        player.play(track);
      }
    });
  });

  return section;
};

const AGGIORNA_PREFERITI = () => {
  const VECCHIA = document.querySelector("#sezione-preferiti")
  if (VECCHIA){
    VECCHIA.remove();
  }

  renderRow("I tuoi preferiti", getFavourites(), "sezione-preferiti");

  const NUOVA = document.querySelector("#sezione-preferiti");
  if (NUOVA) {
    home.prepend(NUOVA);
  }
}

/* ---------- I tuoi preferiti ---------- */

const preferiti = getFavourites(); // array di brani salvati in localStorage
renderRow("I tuoi preferiti", preferiti, "sezione-preferiti"); // se è vuoto, renderRow non mostra niente


/*Riprodotti di recente*/
renderRow("Riprodotti di recente", getHistory());

/*I tuoi preferiti*/
renderRow("I tuoi preferiti", getFavourites());


/*Suggerimenti*/

const caricaSuggerimenti = async (termine) => {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(termine)}&entity=song&limit=12`;
    const dati = await fetchJSON(url);// fa la richiesta e trasforma la risposta in un oggetto JS
    const brani = dati.results.map((raw) => new Track(raw));// da ogni risultato "grezzo" dell'API crea un oggetto Track, in un nuovo array
    
    brani.sort(() => Math.random() - 0.5);//album radom
    return brani.slice(0, 6);

  } catch (err) {
    console.error(err);
    return []; // renderRow con array vuoto non crea niente
  }
};
caricaSuggerimenti("hits pop")

/*
  loadHome()
  - lancia in parallelo le 3 ricerche dei suggerimenti
  - costruisce le righe nell'ordine: pop, rock, hits
*/
const loadHome = async () => {
  // Le tre ricerche partono insieme
  const risultati = await Promise.allSettled([
    caricaSuggerimenti("pop"),
    caricaSuggerimenti("rock"),
    caricaSuggerimenti("hits"),
  ]);
  const [pop, rock, hits] = risultati;

  if (pop.status === "fulfilled") {
    renderRow("Suggerimenti pop", pop.value);
  }

  if (rock.status === "fulfilled") {
    renderRow("Suggerimenti rock", rock.value);
  }

  if (hits.status === "fulfilled") {
    renderRow("Suggerimenti hits", hits.value);
  }
};

loadHome();







