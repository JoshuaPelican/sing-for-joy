
(() => {
  'use strict';

  const OWNER = 'JoshuaPelican';
  const REPO = 'sing-for-joy';

  const input = id => document.getElementById(id);
  const sectionContainer = input('sections');
  const arrangementContainer = input('arrangementList');
  const status = input('status');

  let editID = null;
  let openRevision = 0;
  let nextID = 1;
  let loading = false;

  const validID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const sections = [];
  const arrangement = [];

  function notice(message, type = '') {
    status.className = type;
    status.textContent = message;
  }

  function button(text, action, disabled = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.disabled = disabled;
    b.onclick = action;
    return b;
  }

  function addSection(key = '', lyrics = '', appendToArrangement = true) {
    const item = { id: nextID++, key, lyrics };
    sections.push(item);

    const card = document.createElement('div');
    card.className = 'editor-section';

    const header = document.createElement('div');
    header.className = 'editor-section-header';

    const keyInput = document.createElement('input');
    keyInput.value = key;
    keyInput.placeholder = 'verse1, chorus, bridge';
    keyInput.required = true;
    keyInput.setAttribute('aria-label', 'Section key');

    keyInput.addEventListener('input', () => {
      item.key = keyInput.value.trim();
      renderArrangement();
    });

    const remove = button('Remove', () => {
      const i = sections.indexOf(item);
      if (i >= 0) sections.splice(i, 1);

      for (let j = arrangement.length - 1; j >= 0; j--) {
        if (arrangement[j] === item.id) {
          arrangement.splice(j, 1);
        }
      }

      card.remove();
      renderArrangement();
    });

    header.append(keyInput, remove);

    const label = document.createElement('label');
    label.textContent = 'Lyrics';

    const area = document.createElement('textarea');
    area.rows = 5;
    area.value = lyrics;
    area.placeholder = 'One lyric line per row';

    area.addEventListener('input', () => {
      item.lyrics = area.value;
    });

    label.append(area);
    card.append(header, label);
    sectionContainer.append(card);

    if (appendToArrangement) arrangement.push(item.id);

    renderArrangement();
    return item;
  }

  function renderArrangement() {
    arrangementContainer.replaceChildren();

    for (let i = 0; i < arrangement.length; i++) {
      const row = document.createElement('div');
      row.className = 'editor-order-row';

      const select = document.createElement('select');
      select.setAttribute(
        'aria-label',
        `Arrangement position ${i + 1}`
      );

      for (const s of sections) {
        const option = document.createElement('option');
        option.value = String(s.id);
        option.textContent = s.key || `(Section ${s.id})`;
        select.append(option);
      }

      select.value = String(arrangement[i]);

      select.onchange = () => {
        arrangement[i] = Number(select.value);
        renderArrangement();
      };

      const move = delta => {
        const target = i + delta;

        [arrangement[i], arrangement[target]] =
          [arrangement[target], arrangement[i]];

        renderArrangement();
      };

      row.append(
        select,
        button('↑', () => move(-1), i === 0),
        button('↓', () => move(1), i === arrangement.length - 1),
        button('×', () => {
          arrangement.splice(i, 1);
          renderArrangement();
        })
      );

      arrangementContainer.append(row);
    }
  }

  function buildSong() {
    const name = input('name').value.trim();
    const author = input('author').value.trim();
    const artist = input('artist').value.trim();

    if (!name || !author) {
      throw Error('Song name and author are required.');
    }

    if (!sections.length || !arrangement.length) {
      throw Error('Add at least one section and occurrence.');
    }

    const elements = {};
    const idToKey = new Map();

    for (const s of sections) {
      if (!/^[a-z][a-z0-9]*$/.test(s.key)) {
        throw Error(`Invalid section key: ${s.key}`);
      }

      if (Object.hasOwn(elements, s.key)) {
        throw Error(`Duplicate section key: ${s.key}`);
      }

      elements[s.key] = s.lyrics
        .replace(/\r\n/g, '\n')
        .split('\n');

      idToKey.set(s.id, s.key);
    }

    const order = arrangement.map(id => idToKey.get(id));

    if (order.some(k => !k)) {
      throw Error('Arrangement refers to a deleted section.');
    }

    for (const key of Object.keys(elements)) {
      if (!order.includes(key)) {
        throw Error(`Section "${key}" is not used in arrangement.`);
      }
    }

    return {
      name,
      author,
      ...(artist ? { artist } : {}),
      arrangement: order,
      elements
    };
  }

  function yamlPreview(song) {
    // The existing song viewer expects arrangement as an array.
    const quote = value => JSON.stringify(value);

    const lines = [
      `name: ${quote(song.name)}`,
      `author: ${quote(song.author)}`
    ];

    if (song.artist) {
      lines.push(`artist: ${quote(song.artist)}`);
    }

    lines.push(
      '',
      `arrangement: [${song.arrangement.join(', ')}]`,
      '',
      'elements:'
    );

    for (const [key, lyrics] of Object.entries(song.elements)) {
      lines.push(`  ${key}:`);

      lyrics.forEach(line => {
        lines.push(`    - ${quote(line)}`);
      });

      lines.push('');
    }

    return lines.join('\n').trimEnd() + '\n';
  }

  async function loadEditSong(id, expectedRevision) {
    if (!validID.test(id)) {
      throw Error('Invalid song ID.');
    }

    const response = await fetch(
      `songs/${encodeURIComponent(id)}.yaml`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw Error(
        `Could not load songs/${id}.yaml (${response.status}).`
      );
    }

    const parsed = jsyaml.load(await response.text());

    if (expectedRevision !== openRevision) return;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.elements ||
      !Array.isArray(parsed.arrangement)
    ) {
      throw Error(
        'Unexpected song format: expected an arrangement array and elements object.'
      );
    }

    input('name').value = parsed.name || '';
    input('author').value = parsed.author || '';
    input('artist').value = parsed.artist || '';

    sections.splice(0);
    arrangement.splice(0);
    sectionContainer.replaceChildren();

    const byKey = new Map();

    for (const [key, lyrics] of Object.entries(parsed.elements)) {
      if (!Array.isArray(lyrics)) {
        throw Error(`Invalid lyric list: ${key}`);
      }

      const item = addSection(
        key,
        lyrics.map(line => String(line ?? '')).join('\n'),
        false
      );

      byKey.set(key, item.id);
    }

    for (const key of parsed.arrangement) {
      if (!byKey.has(key)) {
        throw Error(`Arrangement references missing section: ${key}`);
      }

      arrangement.push(byKey.get(key));
    }

    renderArrangement();

    input('pageTitle').textContent = 'Edit Song';
    input('modeDescription').textContent =
      `Editing songs/${id}.yaml. Saving updates this same file.`;

    input('submitBtn').textContent = 'Save changes';
    document.title = `Edit ${parsed.name} - Sing for Joy`;
  }

  input('addSection').onclick = () => addSection();

  input('addOccurrence').onclick = () => {
    if (!sections.length) return;

    arrangement.push(
      arrangement.at(-1) ?? sections[0].id
    );

    renderArrangement();
  };

  input('previewBtn').onclick = () => {
    try {
      const panel = input('preview');

      if (!panel.hidden) {
        panel.hidden = true;
        return;
      }

      panel.textContent = yamlPreview(buildSong());
      panel.hidden = false;
      notice('');
    } catch (e) {
      notice(e.message, 'error');
    }
  };

  input('songForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (loading) return;

    try {
      const song = buildSong();
      const token = input('token').value.trim();

      if (!token) {
        throw Error('GitHub token is required.');
      }

      const payload = {
        event_type: 'save_song',
        client_payload: {
          ...song,
          mode: editID ? 'edit' : 'add',
          ...(editID ? { song_id: editID } : {})
        }
      };

      const body = JSON.stringify(payload);

      if (new TextEncoder().encode(body).length > 60000) {
        throw Error('Submission exceeds the size limit.');
      }

      loading = true;
      input('submitBtn').disabled = true;
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
          `GitHub rejected submission (${response.status}): ${await response.text()}`
        );
      }

      input('token').value = '';

      notice(
        'Submission accepted. Check GitHub Actions to confirm the commit completed.',
        'success'
      );
    } catch (e) {
      notice(e.message, 'error');
    } finally {
      loading = false;
      input('submitBtn').disabled = false;
    }
  });

  function open(songID = null) {
    const revision = ++openRevision;
    editID = songID;

    sections.splice(0);
    arrangement.splice(0);
    nextID = 1;

    sectionContainer.replaceChildren();
    arrangementContainer.replaceChildren();

    input('songForm').reset();
    input('preview').hidden = true;

    input('pageTitle').textContent =
      songID ? 'Edit Song' : 'Add Song';

    input('modeDescription').textContent = songID
      ? `Loading songs/${songID}.yaml...`
      : 'Create a song in the existing Sing for Joy format.';

    input('submitBtn').textContent =
      songID ? 'Save changes' : 'Add Song';

    document.title = 'Sing for Joy';
    notice('');

    input('submitBtn').disabled = !!songID;

    if (songID) {
      notice('Loading existing song...');

      loadEditSong(songID, revision)
        .then(() => {
          if (revision !== openRevision) return;

          notice('');
          input('submitBtn').disabled = false;
        })
        .catch(error => {
          if (revision !== openRevision) return;

          notice(error.message, 'error');
          input('submitBtn').disabled = true;
        });
    } else {
      addSection('verse1');
      addSection('chorus');
      addSection('bridge');
    }
  }

  window.SongEditor = { open };
})();
