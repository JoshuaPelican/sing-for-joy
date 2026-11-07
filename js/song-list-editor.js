
(() => {
  'use strict';

  const OWNER = 'JoshuaPelican';
  const REPO = 'sing-for-joy';

  const $ = id => document.getElementById(id);

  let editIndex = null;
  let songs = [];
  let credits = [];
  let busy = false;
  let revision = 0;

  const songIDPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  // Start with the songs already referenced in config.js.
  // The complete catalog is loaded when the editor opens.
  const songIDs = [
    ...new Set(songFiles.flatMap(list => list.songs))
  ].sort();

  const titleCache = new Map();

  // ----------------------------
  // UTILITIES
  // ----------------------------

  function button(text, callback, disabled = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.disabled = disabled;
    b.addEventListener('click', callback);
    return b;
  }

  function row() {
    const el = document.createElement('div');
    el.className = 'list-editor-row';
    return el;
  }

  function notice(message, type = '') {
    $('listStatus').textContent = message;
    $('listStatus').className = type;
  }

  function move(array, i, delta) {
    const j = i + delta;

    if (j < 0 || j >= array.length) return;

    [array[i], array[j]] = [array[j], array[i]];
  }

  function formatDate(value) {
    const [year, month, day] = value.split('-');

    return `${Number(month)}-${Number(day)}-${year}`;
  }

  function dateInputValue(value) {
    const [month, day, year] = value.split('-');

    return [
      year,
      month.padStart(2, '0'),
      day.padStart(2, '0')
    ].join('-');
  }

  // ----------------------------
  // SONG CATALOG
  // ----------------------------

  async function loadCatalog(currentRevision) {
    try {
      const response = await fetch('songs/index.json', {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw Error(
          `Catalog unavailable (${response.status})`
        );
      }

      const catalog = await response.json();

      if (
        !Array.isArray(catalog) ||
        !catalog.every(id =>
          typeof id === 'string' &&
          songIDPattern.test(id)
        )
      ) {
        throw Error('Invalid song catalog');
      }

      // Add new songs without removing existing selections.
      for (const id of catalog) {
        if (!songIDs.includes(id)) {
          songIDs.push(id);
        }
      }

      songIDs.sort();

      if (revision === currentRevision) {
        renderSongs();
      }

    } catch (error) {
      console.error('Unable to load song catalog:', error);

      if (revision === currentRevision) {
        notice(
          'Could not load the complete song catalog. ' +
          'Showing songs from existing dated lists.',
          'error'
        );
      }
    }

    await loadTitles(currentRevision);
  }

  async function loadTitles(currentRevision) {
    await Promise.all(
      songIDs.map(async id => {
        if (titleCache.has(id)) return;

        try {
          const response = await fetch(
            `songs/${encodeURIComponent(id)}.yaml`
          );

          if (!response.ok) return;

          const song = jsyaml.load(await response.text());

          titleCache.set(id, song?.name || id);
        } catch {
          // Fall back to song ID.
        }
      })
    );

    if (revision === currentRevision) {
      renderSongs();
    }
  }

  // ----------------------------
  // SONG ROWS
  // ----------------------------

  function renderSongs() {
    const container = $('listSongRows');
    container.replaceChildren();

    songs.forEach((id, index) => {
      const r = row();

      const select = document.createElement('select');

      select.setAttribute(
        'aria-label',
        `Song ${index + 1}`
      );

      // Include custom IDs so existing selections
      // remain available even if not in the catalog.
      const availableIDs = [
        ...new Set([...songIDs, id])
      ].sort((a, b) =>
        (titleCache.get(a) || a).localeCompare(
          titleCache.get(b) || b
        )
      );

      for (const songID of availableIDs) {
        const option = document.createElement('option');

        option.value = songID;
        option.textContent =
          titleCache.get(songID) || songID;

        select.append(option);
      }

      select.value = id;

      select.addEventListener('change', () => {
        songs[index] = select.value;
      });

      r.append(
        select,

        button('↑', () => {
          move(songs, index, -1);
          renderSongs();
        }, index === 0),

        button('↓', () => {
          move(songs, index, 1);
          renderSongs();
        }, index === songs.length - 1),

        button('×', () => {
          songs.splice(index, 1);
          renderSongs();
        })
      );

      container.append(r);
    });
  }

  // ----------------------------
  // CREDIT ROWS
  // ----------------------------

  function renderCredits() {
    const container = $('listCreditRows');
    container.replaceChildren();

    credits.forEach((credit, index) => {
      const r = row();

      const name = document.createElement('input');
      name.placeholder = 'Name';
      name.value = credit.name;

      name.setAttribute(
        'aria-label',
        `Credit ${index + 1} name`
      );

      name.addEventListener('input', () => {
        credit.name = name.value;
      });

      const role = document.createElement('input');
      role.placeholder = 'Role';
      role.value = credit.role;

      role.setAttribute(
        'aria-label',
        `Credit ${index + 1} role`
      );

      role.addEventListener('input', () => {
        credit.role = role.value;
      });

      r.append(
        name,
        role,

        button('↑', () => {
          move(credits, index, -1);
          renderCredits();
        }, index === 0),

        button('↓', () => {
          move(credits, index, 1);
          renderCredits();
        }, index === credits.length - 1),

        button('×', () => {
          credits.splice(index, 1);
          renderCredits();
        })
      );

      container.append(r);
    });
  }

  // ----------------------------
  // OPEN EDITOR
  // ----------------------------

  function open(index = null) {
    revision++;
    const currentRevision = revision;

    editIndex =
      index === null || index === undefined
        ? null
        : Number(index);

    const old =
      editIndex === null
        ? null
        : songFiles[editIndex];

    if (
      editIndex !== null &&
      (!Number.isInteger(editIndex) || !old)
    ) {
      notice('Song list not found.', 'error');
      return;
    }

    songs = old ? [...old.songs] : [];

    credits = old
      ? (old.credits || []).map(c => ({
          name: c.name,
          role: c.role
        }))
      : [];

    // New lists inherit the latest credits as a starting
    // point, but can edit or remove them independently.
    if (!old && songFiles[0]?.credits) {
      credits = songFiles[0].credits.map(c => ({ ...c }));
    }

    const today = new Date();

    $('listDate').value = old
      ? dateInputValue(old.date)
      : [
          today.getFullYear(),
          String(today.getMonth() + 1).padStart(2, '0'),
          String(today.getDate()).padStart(2, '0')
        ].join('-');

    $('listEditorTitle').textContent = old
      ? `Edit Song List: ${old.date}`
      : 'New Song List';

    $('listSubmit').textContent = old
      ? 'Save Song List'
      : 'Create Song List';

    $('listToken').value = '';
    $('listNewSongID').value = '';

    notice('');
    renderSongs();
    renderCredits();

    // Refresh the catalog every time the editor opens.
    loadCatalog(currentRevision);
  }

  // ----------------------------
  // ADD SONG
  // ----------------------------

  $('listAddSong').addEventListener('click', () => {
    if (!songIDs.length) {
      notice('No available songs.', 'error');
      return;
    }

    songs.push(songIDs[0]);
    renderSongs();
    notice('');
  });

  // ----------------------------
  // ADD SONG BY ID
  // ----------------------------

  $('listAddSongID').addEventListener('click', () => {
    const id = $('listNewSongID').value.trim();

    if (!songIDPattern.test(id)) {
      notice('Enter a valid song file ID.', 'error');
      return;
    }

    if (!songIDs.includes(id)) {
      songIDs.push(id);
      songIDs.sort();
    }

    songs.push(id);

    $('listNewSongID').value = '';

    renderSongs();
    notice('');
  });

  // ----------------------------
  // ADD CREDIT
  // ----------------------------

  $('listAddCredit').addEventListener('click', () => {
    credits.push({
      name: '',
      role: ''
    });

    renderCredits();
  });

  // ----------------------------
  // SUBMIT TO GITHUB
  // ----------------------------

  $('listEditorForm').addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      if (busy) return;

      try {
        const dateValue = $('listDate').value;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          throw Error('Select a date.');
        }

        if (!songs.length) {
          throw Error('Add at least one song.');
        }

        if (songs.some(id => !songIDPattern.test(id))) {
          throw Error('Invalid song ID.');
        }

        const cleanedCredits = credits.map(c => ({
          name: c.name.trim(),
          role: c.role.trim()
        }));

        if (cleanedCredits.some(c =>
          !c.name ||
          !c.role ||
          c.name.length > 150 ||
          c.role.length > 150
        )) {
          throw Error(
            'Every credit needs a name and role ' +
            '(maximum 150 characters).'
          );
        }

        const date = formatDate(dateValue);
        const token = $('listToken').value.trim();

        if (!token) {
          throw Error('Enter your GitHub token.');
        }

        const payload = {
          event_type: 'save_song_list',

          client_payload: {
            mode: editIndex === null ? 'add' : 'edit',

            ...(editIndex === null
              ? {}
              : {
                  original_date:
                    songFiles[editIndex].date
                }),

            date,
            songs: [...songs],
            credits: cleanedCredits
          }
        };

        const body = JSON.stringify(payload);

        if (
          new TextEncoder().encode(body).length > 60000
        ) {
          throw Error('Payload is too large.');
        }

        busy = true;
        $('listSubmit').disabled = true;

        notice('Submitting...');

        const response = await fetch(
          `https://api.github.com/repos/${OWNER}/${REPO}/dispatches`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body
          }
        );

        if (!response.ok) {
          throw Error(
            `GitHub API ${response.status}: ` +
            await response.text()
          );
        }

        $('listToken').value = '';

        notice(
          'Submission accepted. Check GitHub Actions ' +
          'for the commit, then reload the site.',
          'success'
        );

      } catch (error) {
        notice(error.message, 'error');
      } finally {
        busy = false;
        $('listSubmit').disabled = false;
      }
    }
  );

  window.SongListEditor = { open };
})();
