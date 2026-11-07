
const songCache = new Map();

const songPage = document.getElementById('song');
const songContent = document.getElementById('songContent');
const tocPage = document.getElementById('toc');
const tocSongList = document.getElementById('songList');
const archiveButton = document.getElementById('archiveButton');
const credits = document.getElementById('credits');
const footer = document.querySelector('footer');

const songIDPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function escapeHTML(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );
}

// ----------------------------
// SONG CATALOG
// ----------------------------

async function loadSongCatalog() {
  const response = await fetch('songs/index.json', {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw Error(`Song catalog unavailable (${response.status})`);
  }

  const catalog = await response.json();

  if (
    !Array.isArray(catalog) ||
    !catalog.every(id =>
      typeof id === 'string' && songIDPattern.test(id)
    )
  ) {
    throw Error('Invalid song catalog');
  }

  return [...new Set(catalog)];
}

// ----------------------------
// SONG RENDERING
// ----------------------------

function buildSong(song) {
  let html = `
    <div class="song-header">
      <h1 class="song-title">${escapeHTML(song.name)}</h1>
      <div class="line"></div>
    </div>
    <div class="lyrics-container">
  `;

  for (const elementKey of song.arrangement) {
    const lyrics = song.elements[elementKey];

    if (!lyrics) continue;

    html += `
      <div class="song-section">
        <div class="section-label">
          ${escapeHTML(
            elementKey.replace(/(\D+)(\d+)/, '$1 $2')
          )}
        </div>
        <div class="section-lyrics">
    `;

    html += lyrics.map(line =>
      line
        ? `<div>${escapeHTML(line)}</div>`
        : '<div style="margin: 0.75em 0;"></div>'
    ).join('');

    html += '</div></div>';
  }

  html += `
    </div>
    <div class="song-footer">
      <div class="line"></div>
      <p class="song-author">
        <b>Author${song.author.split(',').length > 1 ? 's' : ''}</b>
        - ${escapeHTML(song.author)}
      </p>
  `;

  if (song.artist) {
    html += `
      <p class="song-author">
        <b>Artist</b> - ${escapeHTML(song.artist)}
      </p>
    `;
  }

  return html + '</div>';
}

// ----------------------------
// PAGE VISIBILITY
// ----------------------------

function hideEditors() {
  document.getElementById('editorContent').hidden = true;
  document.getElementById('listEditorContent').hidden = true;
}

function setSongContent(htmlContent) {
  songContent.innerHTML = htmlContent;
}

function toggleSongDisplay(isActive) {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'smooth'
  });

  tocPage.classList.toggle('active', !isActive);
  songPage.classList.toggle('active', isActive);
  footer.classList.toggle('active', !isActive);
}

// ----------------------------
// SONG LOADING
// ----------------------------

async function fetchAndCacheSong(songID) {
  let songData;

  try {
    if (!songIDPattern.test(songID)) {
      throw Error('Invalid song ID');
    }

    const response = await fetch(
      `songs/${encodeURIComponent(songID)}.yaml`
    );

    if (!response.ok) {
      throw Error('Not found');
    }

    const parsed = jsyaml.load(await response.text());

    if (
      !parsed ||
      typeof parsed.name !== 'string' ||
      !Array.isArray(parsed.arrangement) ||
      !parsed.elements ||
      typeof parsed.elements !== 'object'
    ) {
      throw Error('Invalid song YAML format');
    }

    songData = {
      id: songID,
      name: parsed.name,
      author: parsed.author || '',
      artist: parsed.artist,
      arrangement: parsed.arrangement,
      elements: parsed.elements,
      error: false
    };

  } catch (error) {
    console.error(`Error loading ${songID}:`, error);

    songData = {
      id: songID,
      error: true
    };
  }

  songCache.set(songID, songData);
  return songData;
}

async function tryGetSong(songID) {
  if (!songCache.has(songID)) {
    return fetchAndCacheSong(songID);
  }

  return songCache.get(songID);
}

// ----------------------------
// SONG PAGE
// ----------------------------

async function displaySong(data) {
  hideEditors();

  const songID = data.params.id;
  const song = await tryGetSong(songID);

  if (
    router.currentRoute !== '/song' ||
    new URLSearchParams(
      location.hash.split('?')[1] || ''
    ).get('id') !== songID
  ) {
    return;
  }

  if (!song || song.error) {
    setSongContent(`
      <div class="error-msg">
        Error displaying song: ${escapeHTML(songID)}
      </div>
    `);
  } else {
    setSongContent(buildSong(song));

    const editLink = document.createElement('div');
    editLink.href = `#/edit?id=${encodeURIComponent(songID)}`;
    editLink.textContent = 'Edit Song';
    editLink.className = 'song-item dev-only';
    editLink.style.margin = '15px 0';

    editLink.addEventListener('click', event => {
      event.preventDefault();
      navEdit(songID);
    });

    songContent.append(editLink);
  }

  toggleSongDisplay(true);
}

// ----------------------------
// PRINT VIEW
// ----------------------------

function displayPrint() {
  hideEditors();

  setSongContent(
    hymnalPrinter.createPrintPageContent()
  );

  toggleSongDisplay(true);

  setTimeout(() => {
    const button = document.getElementById('generatePdfBtn');

    if (button) {
      button.addEventListener(
        'click',
        () => hymnalPrinter.handleGeneratePDF()
      );
    }
  }, 0);
}

// ----------------------------
// SONG LIST ITEMS
// ----------------------------

async function buildSongItem(songID) {
  const song = await tryGetSong(songID);
  const li = document.createElement('li');

  if (song.error) {
    li.className = 'song-item error';
    li.textContent = `${songID} (NOT FOUND)`;
  } else {
    li.className = 'song-item';
    li.textContent = song.name;
    li.onclick = () => navSong(songID);
  }

  return li;
}

async function buildSongList(songIDs) {
  await Promise.all(
    songIDs.map(id => tryGetSong(id))
  );

  const ol = document.createElement('ol');
  ol.className = 'song-list';

  const items = await Promise.all(
    songIDs.map(id => buildSongItem(id))
  );

  items.forEach(li => ol.append(li));
  return ol;
}

// ----------------------------
// CREDITS
// ----------------------------

function loadCredits(songList = songFiles[0]) {
  credits.replaceChildren();

  for (const credit of (songList?.credits ?? [])) {
    const name = document.createElement('b');
    name.textContent = credit.name;

    credits.append(
      name,
      document.createTextNode(` - ${credit.role}`),
      document.createElement('br')
    );
  }
}

// ----------------------------
// ARCHIVE BUTTON
// ----------------------------

function updateArchiveButton(isArchive) {
  archiveButton.textContent = isArchive
    ? '← Latest Songs'
    : 'Song Archive →';

  archiveButton.onclick = isArchive
    ? navHome
    : navArchive;
}

// ----------------------------
// HOME PAGE
// ----------------------------

async function displayHome() {
  hideEditors();
  tocSongList.replaceChildren();
  toggleSongDisplay(false);
  updateArchiveButton(false);

  const list = songFiles?.[0];
  loadCredits(list);

  if (!list) return;

  const header = document.createElement('p');
  header.className = 'credits';
  header.style.marginTop = '10px';
  header.style.fontWeight = 'bold';
  header.textContent = list.date;

  tocSongList.append(header);

  const built = await buildSongList(list.songs);

  if (router.currentRoute === '/') {
    tocSongList.append(built);
  }
}

// ----------------------------
// ARCHIVE PAGE
// ----------------------------

async function displayArchive() {
  hideEditors();
  tocSongList.replaceChildren();
  toggleSongDisplay(false);
  updateArchiveButton(true);

  const songDateMap = new Map();

  // Build performance history from dated lists.
  for (const list of songFiles) {
    for (const id of list.songs) {
      if (!songDateMap.has(id)) {
        songDateMap.set(id, {
          last_sung: list.date,
          count: 1
        });
      } else {
        songDateMap.get(id).count++;
      }
    }
  }

  // Merge the complete catalog with performance history.
  const allSongIDs = new Set(songDateMap.keys());

  try {
    const catalog = await loadSongCatalog();

    for (const id of catalog) {
      allSongIDs.add(id);

      if (!songDateMap.has(id)) {
        songDateMap.set(id, {
          last_sung: null,
          count: 0
        });
      }
    }
  } catch (error) {
    console.error('Unable to load song catalog:', error);

    // The archive still shows songs from config.js
    // if the catalog cannot be loaded.
  }

  const ids = [...allSongIDs];

  await Promise.all(
    ids.map(id => tryGetSong(id))
  );

  ids.sort((a, b) =>
    (songCache.get(a)?.name ?? a).localeCompare(
      songCache.get(b)?.name ?? b
    )
  );

  const ol = document.createElement('ol');
  ol.className = 'song-list';

  for (const id of ids) {
    const song = await tryGetSong(id);
    const { last_sung, count } = songDateMap.get(id);

    const li = document.createElement('li');

    if (song.error) {
      li.className = 'song-item error';
      li.textContent = `${id} (NOT FOUND)`;
    } else {
      li.className = 'song-item';

      const title = document.createTextNode(song.name + ' ');
      const detail = document.createElement('div');

      const date = document.createElement('i');
      date.className = 'song-date';
      date.textContent = last_sung || 'Not yet sung';

      const tally = document.createElement('p');
      tally.textContent = count > 1
        ? `+${count - 1}`
        : '   ';

      detail.append(date, tally);
      li.append(title, detail);

      li.onclick = () => navSong(id);
    }

    ol.append(li);
  }

  if (router.currentRoute === '/archive') {
    tocSongList.append(ol);
  }
}

// ----------------------------
// SONG EDITOR VIEW
// ----------------------------

function displayEditor(data) {
  hideEditors();
  setSongContent('');
  toggleSongDisplay(true);

  document.getElementById('editorContent').hidden = false;

  SongEditor.open(data.params.id || null);
}

// ----------------------------
// SONG LIST EDITOR VIEW
// ----------------------------

function displayListEditor(data) {
  hideEditors();
  setSongContent('');
  toggleSongDisplay(true);

  document.getElementById('listEditorContent').hidden = false;

  const index = data.params.index === undefined
    ? null
    : Number(data.params.index);

  SongListEditor.open(index);
}

// ----------------------------
// ROUTER
// ----------------------------

const router = new HistoryManager();

router
  .register('/', displayHome)
  .register('/archive', displayArchive)
  .register('/song', displaySong)
  .register('/edit', displayEditor)
  .register('/list', displayListEditor)
  .register('/print', displayPrint)
  .register('*', displayHome)
  .init();

// ----------------------------
// NAVIGATION HELPERS
// ----------------------------

function navHome() {
  router.navigate('/');
}

function navArchive() {
  router.navigate('/archive');
}

function navSong(id) {
  router.navigate(
    `/song?id=${encodeURIComponent(id)}`
  );
}

function navPrint() {
  router.navigate('/print');
}

function navEdit(id = null) {
  router.navigate(
    id
      ? `/edit?id=${encodeURIComponent(id)}`
      : '/edit'
  );
}

function navList(index = null) {
  router.navigate(
    index === null
      ? '/list'
      : `/list?index=${index}`
  );
}
