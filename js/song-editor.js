
(() => {
    'use strict';

    const OWNER = 'JoshuaPelican';
    const REPO = 'sing-for-joy';

    const $ = id => document.getElementById(id);

    const sectionContainer = $('sections');
    const arrangementContainer = $('arrangementList');
    const status = $('status');

    const sections = [];
    const arrangement = [];

    let editID = null;
    let openRevision = 0;
    let nextID = 1;
    let loading = false;

    const validID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const validSection = /^[a-z][a-z0-9]*$/;

    // ----------------------------
    // SHARED HELPERS
    // ----------------------------

    function notice(message, type = '') {
        status.textContent = message;
        status.className = `form-status ${type}`.trim();
    }

    function button(text, action, disabled = false) {
        const element = document.createElement('button');

        element.type = 'button';
        element.textContent = text;
        element.disabled = disabled;
        element.addEventListener('click', action);

        return element;
    }

    function createRow() {
        const row = document.createElement('div');
        row.className = 'control-row';
        return row;
    }

    // ----------------------------
    // LYRIC SECTIONS
    // ----------------------------

    function addSection(
        key = '',
        lyrics = '',
        appendToArrangement = true
    ) {
        const item = {
            id: nextID++,
            key,
            lyrics
        };

        sections.push(item);

        const card = document.createElement('div');
        card.className = 'editor-section';

        const header = createRow();

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
            const index = sections.indexOf(item);

            if (index !== -1) {
                sections.splice(index, 1);
            }

            // Remove all occurrences of this section.
            for (let i = arrangement.length - 1; i >= 0; i--) {
                if (arrangement[i] === item.id) {
                    arrangement.splice(i, 1);
                }
            }

            card.remove();
            renderArrangement();
        });

        header.append(keyInput, remove);

        const lyricsLabel = document.createElement('label');
        lyricsLabel.textContent = 'Lyrics';

        const textarea = document.createElement('textarea');
        textarea.rows = 5;
        textarea.value = lyrics;
        textarea.placeholder = 'One lyric line per row';

        textarea.addEventListener('input', () => {
            item.lyrics = textarea.value;
        });

        lyricsLabel.append(textarea);
        card.append(header, lyricsLabel);
        sectionContainer.append(card);

        if (appendToArrangement) {
            arrangement.push(item.id);
        }

        renderArrangement();

        return item;
    }

    // ----------------------------
    // ARRANGEMENT
    // ----------------------------

    function renderArrangement() {
        arrangementContainer.replaceChildren();

        arrangement.forEach((id, index) => {
            const row = createRow();

            const select = document.createElement('select');

            select.setAttribute(
                'aria-label',
                `Arrangement position ${index + 1}`
            );

            for (const section of sections) {
                const option = document.createElement('option');

                option.value = String(section.id);
                option.textContent =
                    section.key || `(Section ${section.id})`;

                select.append(option);
            }

            select.value = String(id);

            select.addEventListener('change', () => {
                arrangement[index] = Number(select.value);
                renderArrangement();
            });

            function move(delta) {
                const target = index + delta;

                if (target < 0 || target >= arrangement.length) {
                    return;
                }

                [arrangement[index], arrangement[target]] = [
                    arrangement[target],
                    arrangement[index]
                ];

                renderArrangement();
            }

            row.append(
                select,

                button(
                    '↑',
                    () => move(-1),
                    index === 0
                ),

                button(
                    '↓',
                    () => move(1),
                    index === arrangement.length - 1
                ),

                button('×', () => {
                    arrangement.splice(index, 1);
                    renderArrangement();
                })
            );

            arrangementContainer.append(row);
        });
    }

    // ----------------------------
    // VALIDATE AND BUILD SONG
    // ----------------------------

    function buildSong() {
        const name = $('name').value.trim();
        const author = $('author').value.trim();
        const artist = $('artist').value.trim();

        if (!name || !author) {
            throw Error('Song name and author are required.');
        }

        if (
            name.length > 150 ||
            author.length > 150 ||
            artist.length > 150
        ) {
            throw Error('Song metadata exceeds 150 characters.');
        }

        if (!sections.length || !arrangement.length) {
            throw Error('Add at least one section and occurrence.');
        }

        const elements = {};
        const idToKey = new Map();

        for (const section of sections) {
            const key = section.key.trim();

            if (!validSection.test(key)) {
                throw Error(`Invalid section key: ${key}`);
            }

            if (Object.hasOwn(elements, key)) {
                throw Error(`Duplicate section key: ${key}`);
            }

            elements[key] = section.lyrics
                .replace(/\r\n/g, '\n')
                .split('\n');

            idToKey.set(section.id, key);
        }

        const order = arrangement.map(id => idToKey.get(id));

        if (order.some(key => !key)) {
            throw Error('Arrangement references a missing section.');
        }

        for (const key of Object.keys(elements)) {
            if (!order.includes(key)) {
                throw Error(
                    `Section "${key}" is not used in the arrangement.`
                );
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

    // ----------------------------
    // YAML PREVIEW
    // ----------------------------

    function yamlPreview(song) {
        // JSON-quoted strings are valid YAML strings.
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

            for (const line of lyrics) {
                lines.push(`    - ${quote(line)}`);
            }

            lines.push('');
        }

        return lines.join('\n').trimEnd() + '\n';
    }

    // ----------------------------
    // LOAD EXISTING SONG
    // ----------------------------

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

        if (expectedRevision !== openRevision) {
            return;
        }

        if (
            !parsed ||
            typeof parsed !== 'object' ||
            !parsed.elements ||
            !Array.isArray(parsed.arrangement)
        ) {
            throw Error('Unexpected song YAML format.');
        }

        $('name').value = parsed.name || '';
        $('author').value = parsed.author || '';
        $('artist').value = parsed.artist || '';

        sections.splice(0);
        arrangement.splice(0);
        sectionContainer.replaceChildren();

        const byKey = new Map();

        for (const [key, lyrics] of Object.entries(parsed.elements)) {
            if (!Array.isArray(lyrics)) {
                throw Error(`Invalid lyric section: ${key}`);
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
                throw Error(
                    `Arrangement references missing section: ${key}`
                );
            }

            arrangement.push(byKey.get(key));
        }

        renderArrangement();

        $('pageTitle').textContent = 'Edit Song';
        $('modeDescription').textContent =
            `Editing songs/${id}.yaml. Saving updates this same file.`;

        $('submitBtn').textContent = 'Save Changes';

        document.title = `Edit ${parsed.name} - Sing for Joy`;
    }

    // ----------------------------
    // FORM BUTTONS
    // ----------------------------

    $('addSection').addEventListener('click', () => {
        addSection();
    });

    $('addOccurrence').addEventListener('click', () => {
        if (!sections.length) return;

        arrangement.push(
            arrangement.at(-1) ?? sections[0].id
        );

        renderArrangement();
    });

    $('previewBtn').addEventListener('click', () => {
        try {
            const preview = $('preview');

            if (!preview.hidden) {
                preview.hidden = true;
                return;
            }

            preview.textContent = yamlPreview(buildSong());
            preview.hidden = false;

            notice('');
        } catch (error) {
            notice(error.message, 'error');
        }
    });

    // ----------------------------
    // SUBMIT TO GITHUB
    // ----------------------------

    $('songForm').addEventListener('submit', async event => {
        event.preventDefault();

        if (loading) return;

        try {
            const song = buildSong();
            const token = $('token').value.trim();

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
            $('submitBtn').disabled = true;

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
                    `GitHub rejected submission (${response.status}): ` +
                    await response.text()
                );
            }

            // Save token only after GitHub accepts the submission.
            sessionStorage.setItem('github-token', token);

            notice(
                'Submission accepted. Wait 30 seconds and press "ctrl" + "shift" + "R" to refresh the site.',
                'success'
            );

        } catch (error) {
            notice(error.message, 'error');
        } finally {
            loading = false;
            $('submitBtn').disabled = false;
        }
    });

    // ----------------------------
    // OPEN EDITOR
    // ----------------------------

    function open(songID = null) {
        const revision = ++openRevision;

        editID = songID;

        sections.splice(0);
        arrangement.splice(0);
        nextID = 1;

        sectionContainer.replaceChildren();
        arrangementContainer.replaceChildren();

        $('songForm').reset();
        $('token').value = sessionStorage.getItem('github-token') || '';
        $('preview').hidden = true;

        $('pageTitle').textContent =
            songID ? 'Edit Song' : 'Add Song';

        $('modeDescription').textContent = songID
            ? `Loading songs/${songID}.yaml...`
            : 'Create a song in the Sing for Joy format.';

        $('submitBtn').textContent =
            songID ? 'Save Changes' : 'Add Song';

        $('submitBtn').disabled = Boolean(songID);

        document.title = 'Sing for Joy';

        notice('');

        if (songID) {
            notice('Loading existing song...');

            loadEditSong(songID, revision)
                .then(() => {
                    if (revision !== openRevision) return;

                    notice('');
                    $('submitBtn').disabled = false;
                })
                .catch(error => {
                    if (revision !== openRevision) return;

                    notice(error.message, 'error');
                    $('submitBtn').disabled = true;
                });
        } else {
            addSection('verse1');
            addSection('chorus');
            addSection('bridge');
        }
    }

    window.SongEditor = { open };
})();
