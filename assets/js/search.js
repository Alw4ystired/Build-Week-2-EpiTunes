const player = initPage("search");
const input = document.querySelector("#search-input");
const rowTracks = document.querySelector("#row-tracks");
const rowAlbums = document.querySelector("#row-albums");
const rowArtists = document.querySelector("#row-artists");
const gridTracks = document.querySelector("#grid-tracks");
const gridAlbums = document.querySelector("#grid-albums");
const gridArtists = document.querySelector("#grid-artists");

let searchSequence = 0;

// Ogni card sta dentro una colonna Bootstrap (row > col > card)
const createCard = (grid, tag) => {
  const column = creaElemento("div", "col", grid);
  return creaElemento(tag, "card h-100 border-0", column);
};

const createImage = (parent, url, alt = "") => {
  const imageWrap = creaElemento("div", "card-image-wrap", parent);
  const image = creaElemento("img", "w-100 h-100 object-fit-cover d-block", imageWrap);

  image.src = url || "";
  image.alt = alt;
  image.loading = "lazy";

  return imageWrap;
};

const renderTrackCard = (rawTrack) => {
  const track = new Track(rawTrack);
  const card = createCard(gridTracks, "article");

  card.dataset.trackId = String(track.id);

  createImage(card, bigArt(track.cover), track.title);
  creaElemento("p", "card-title", card, track.title);
  creaElemento("p", "card-sub", card, track.artist);

  const playButton = creaElemento("button", "card-play", card, "▶");

  playButton.type = "button";
  playButton.setAttribute(
    "aria-label",
    track.previewUrl
      ? `Riproduci ${track.title} di ${track.artist}`
      : `Anteprima non disponibile per ${track.title}`
  );
  playButton.disabled = !track.previewUrl;

  playButton.addEventListener("click", (event) => {
    event.stopPropagation();

    if (track.previewUrl) player.play(track);
  });

  card.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    if (track.previewUrl) player.play(track);
  });
};

const renderAlbumCard = (rawAlbum) => {
  const album = new Album(rawAlbum);
  const card = createCard(gridAlbums, "a");

  card.href = `album.html?id=${album.id}`;

  createImage(card, bigArt(album.cover), album.title);
  creaElemento("p", "card-title", card, album.title);
  creaElemento("p", "card-sub", card, album.artist);
};

const renderArtistCard = (rawArtist) => {
  const artist = new Artist(rawArtist);
  const card = createCard(gridArtists, "a");
  const imageWrap = creaElemento("div", "card-image-wrap round", card);

  card.href = `artist.html?id=${artist.id}`;

  creaElemento("div", "w-100 h-100 d-flex align-items-center justify-content-center fs-1", imageWrap, "🎤");
  creaElemento("p", "card-title", card, artist.name);
  creaElemento("p", "card-sub", card, artist.genre || "Artista");
};

const doSearch = async (term) => {
  const requestId = ++searchSequence;
  const normalizedTerm = term.trim();

  if (!normalizedTerm) {
    gridTracks.replaceChildren();
    gridAlbums.replaceChildren();
    gridArtists.replaceChildren();

    rowTracks.hidden = true;
    rowAlbums.hidden = true;
    rowArtists.hidden = true;

    localStorage.removeItem(STORAGE_KEY_LAST_SEARCH);
    return;
  }

  localStorage.setItem(STORAGE_KEY_LAST_SEARCH, normalizedTerm);

  const searchUrl = (entity, limit) =>
    `${API_BASE}/search?term=${encodeURIComponent(normalizedTerm)}&entity=${entity}&limit=${limit}`;

  const [trackResult, albumResult, artistResult] =
    await Promise.allSettled([
      fetchJSON(searchUrl("song", 12)),
      fetchJSON(searchUrl("album", 8)),
      fetchJSON(searchUrl("musicArtist", 8)),
    ]);

  // Ignora le risposte di ricerche precedenti arrivate in ritardo.
  if (requestId !== searchSequence) return;

  const trackData = trackResult.status === "fulfilled" ? trackResult.value : {};
  const albumData = albumResult.status === "fulfilled" ? albumResult.value : {};
  const artistData = artistResult.status === "fulfilled" ? artistResult.value : {};

  gridTracks.replaceChildren();
  gridAlbums.replaceChildren();
  gridArtists.replaceChildren();

  const tracks = trackData.results || [];
  const albums = albumData.results || [];
  const artists = artistData.results || [];

  tracks.forEach(renderTrackCard);
  albums.forEach(renderAlbumCard);
  artists.forEach(renderArtistCard);

  rowTracks.hidden = tracks.length === 0;
  rowAlbums.hidden = albums.length === 0;
  rowArtists.hidden = artists.length === 0;
};

const debouncedSearch = debounce(doSearch, 400);

input.addEventListener("input", (event) => {
  debouncedSearch(event.target.value);
});

const ultimaRicerca = localStorage.getItem(STORAGE_KEY_LAST_SEARCH);

if (ultimaRicerca) {
  input.value = ultimaRicerca;
  doSearch(ultimaRicerca);
}