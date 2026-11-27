// Importo da common.js solo quello che questo file usa davvero
import {
  INIT_PAGE,
  GET_FAVOURITES,
  TOGGLE_FAVOURITE,
  IS_FAVOURITE,
  GET_HISTORY,
  RENDER_SIDEBAR_FAVS,
  AGGIORNA_CARD_PLAY,

  creaElemento,
  FETCH_JSON,
  BIG_ART,
  Track,
} from "./common.js";

/* ============================================================
   home.js — costruzione della Home
   ============================================================

   COSA DEVI FARE
   1) INIT_PAGE("home")  // monta sidebar + player
   2) Costruisci queste righe (sezioni) nella .home:
        - "Riprodotti di recente" (da getHistory())  -- mostra solo se non vuota
        - "I tuoi preferiti"       (da getFavourites()) -- mostra solo se non vuota
        - "Suggerimenti pop"       (fetch search term=pop entity=song limit=12)
        - "Suggerimenti rock"      (fetch search term=rock entity=song limit=12)
        - "Suggerimenti hits"      (fetch search term=hits pop entity=song limit=12)
   3) Le tre fetch dei suggerimenti vanno in PARALLELO con Promise.all
   4) Ogni card è una Track: cover, titolo, artista, button play, button cuore (favourite)
   5) Click card -> window.player.play(track)
   6) Click cover senza play -> link a album.html?id=albumId (opzionale)
*/

const PLAYER = INIT_PAGE("home");

const HOME = document.querySelector(".home");

/*
  renderRow(rowTitle, tracks)
  - crea una <section> con titolo h2 e una griglia Bootstrap (row > col > card)
  - una card per ogni track: cover, titolo, artista, bottone play, bottone cuore
  - se l'array è vuoto non crea niente (nessuna sezione vuota con solo il titolo)
*/
const RENDER_ROW = (rowTitle, tracks, idSezione) => {
  if (!tracks || tracks.length === 0) return;

  const SECTION = creaElemento("section", "mt-4", HOME);
  if (idSezione) {
    SECTION.id = idSezione;
  }
  creaElemento("h2", "fs-4 fw-bold mb-3", SECTION, rowTitle);

  const GRID = creaElemento(
    "div",
    "row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-6 g-3",
    SECTION
  );

  tracks.forEach((track) => {
    const COLUMN = creaElemento("div", "col", GRID);
    const CARD = creaElemento("article", "card h-100 border-0 position-relative p-3", COLUMN);
    CARD.dataset.trackId = String(track.id);

    // Cover
    const IMAGE_WRAP = creaElemento("div", "card-image-wrap position-relative w-100 overflow-hidden", CARD);
    const IMAGE = creaElemento(
      "img",
      "w-100 h-100 object-fit-cover d-block",
      IMAGE_WRAP
    );

    IMAGE.src = BIG_ART(track.cover);
    IMAGE.alt = track.title ?? "";
    IMAGE.loading = "lazy";

    // Titolo e artista
    creaElemento("p", "card-title fw-bold text-truncate mt-0 mb-1 fs-6", CARD, track.title);
    creaElemento("p", "card-sub text-body-secondary text-truncate m-0 small", CARD, track.artist);

    // Cuore
    const GIA_PREFERITO = IS_FAVOURITE(track.id);
    const FAV_BUTTON = creaElemento(
      "button",
      GIA_PREFERITO ? "card-fav position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center is-fav" : "card-fav position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center",
      CARD,
      GIA_PREFERITO ? "♥" : "♡"
    );

    FAV_BUTTON.type = "button";
    FAV_BUTTON.setAttribute(
      "aria-label",
      `${GIA_PREFERITO ? "Rimuovi" : "Aggiungi"} ${track.title} ${GIA_PREFERITO ? "dai" : "ai"
      } preferiti`
    );
    //clicco dei favoriti 
    // Bottone play
    const PLAY_BUTTON = creaElemento("button", "card-play position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center", CARD, "▶");
    PLAY_BUTTON.type = "button";
    PLAY_BUTTON.setAttribute(
      "aria-label",
      `Riproduci ${track.title} di ${track.artist}`
    );
    PLAY_BUTTON.disabled = !track.previewUrl;

  });

  /*
    Event delegation.
    Invece di tre ascoltatori su ogni card (cuore, play, card intera), ne
    mettiamo UNO solo sulla griglia. Il click "sale" dal bottone alla card
    alla griglia: closest() dice da dove e' partito, e il data-track-id
    della card dice quale brano e'.
    Con 12 card per riga: 1 ascoltatore invece di 36.
  */
  const PER_ID = new Map(tracks.map((brano) => [String(brano.id), brano]));

  GRID.addEventListener("click", (event) => {
    const CARD = event.target.closest(".card");
    if (!CARD) return; // click nel vuoto fra una card e l'altra

    const TRACK = PER_ID.get(CARD.dataset.trackId);
    if (!TRACK) return;

    // Cuore
    if (event.target.closest(".card-fav")) {
      TOGGLE_FAVOURITE(TRACK);
      RENDER_SIDEBAR_FAVS(); // la lista nella sidebar
      AGGIORNA_CUORI(TRACK); // tutti i cuori di questo brano, anche nelle altre righe
      AGGIORNA_PREFERITI(); // la riga "I tuoi preferiti"
      return;
    }

    // Un altro bottone che qualcuno aggiungesse in futuro non fa partire la musica
    const BOTTONE = event.target.closest("button");
    if (BOTTONE && !BOTTONE.classList.contains("card-play")) return;

    // Bottone verde, oppure un punto qualsiasi della card
    if (TRACK.previewUrl) PLAYER.play(TRACK, tracks); // la coda e' la riga da cui parto
  });

  AGGIORNA_CARD_PLAY(); // le card nuove partono con l'icona giusta (▶ o ⏸)
  return SECTION;
};

const AGGIORNA_PREFERITI = () => {
  const VECCHIA = document.querySelector("#sezione-preferiti")
  if (VECCHIA) {
    VECCHIA.remove();
  }

  RENDER_ROW("I tuoi preferiti", GET_FAVOURITES(), "sezione-preferiti");

  const NUOVA = document.querySelector("#sezione-preferiti");
  if (NUOVA) {
    HOME.prepend(NUOVA);
  }
}

const AGGIORNA_CUORI = (track) => {
  const ORA = IS_FAVOURITE(track.id);
  const CARTE = document.querySelectorAll(`.card[data-track-id="${track.id}"]`);

  CARTE.forEach((carta) => {
    const CUORE = carta.querySelector(".card-fav");

    CUORE.classList.toggle("is-fav", ORA);
    if(ORA) {
      CUORE.textContent = "♥";
    } else {
      CUORE.textContent = "♡";
    }

    // Anche l'etichetta per gli screen reader: senza questa resta quella di
    // quando la card e' nata, e direbbe "Aggiungi" su un cuore gia' pieno.
    CUORE.setAttribute(
      "aria-label",
      `${ORA ? "Rimuovi" : "Aggiungi"} ${track.title} ${ORA ? "dai" : "ai"} preferiti`
    );
  });
}

/* ---------- I tuoi preferiti ---------- */

const PREFERITI = GET_FAVOURITES(); // array di brani salvati in localStorage
RENDER_ROW("I tuoi preferiti", PREFERITI, "sezione-preferiti"); // se è vuoto, renderRow non mostra niente


/*Riprodotti di recente*/
RENDER_ROW("Riprodotti di recente", GET_HISTORY());


/*Suggerimenti*/

const CARICA_SUGGERIMENTI = async (termine) => {
  try {
    const URL = `https://itunes.apple.com/search?term=${encodeURIComponent(termine)}&entity=song&limit=12`;
    const DATI = await FETCH_JSON(URL);// fa la richiesta e trasforma la risposta in un oggetto JS
    const BRANI = DATI.results.map((raw) => new Track(raw));// da ogni risultato "grezzo" dell'API crea un oggetto Track, in un nuovo array

    BRANI.sort(() => Math.random() - 0.5); // ordine diverso a ogni caricamento
    return BRANI;

  } catch (err) {
    console.error(err);
    return []; // renderRow con array vuoto non crea niente
  }
};

/*
  loadHome()
  - lancia in parallelo le 3 ricerche dei suggerimenti
  - costruisce le righe nell'ordine: pop, rock, hits
*/
const LOAD_HOME = async () => {
  // Le tre ricerche partono insieme
  const RISULTATI = await Promise.allSettled([
    CARICA_SUGGERIMENTI("pop"),
    CARICA_SUGGERIMENTI("rock"),
    CARICA_SUGGERIMENTI("hits"),
  ]);
  const [POP, ROCK, HITS] = RISULTATI;

  if (POP.status === "fulfilled") {
    RENDER_ROW("Suggerimenti pop", POP.value);
  }

  if (ROCK.status === "fulfilled") {
    RENDER_ROW("Suggerimenti rock", ROCK.value);
  }

  if (HITS.status === "fulfilled") {
    RENDER_ROW("Suggerimenti hits", HITS.value);
  }
};

LOAD_HOME();
