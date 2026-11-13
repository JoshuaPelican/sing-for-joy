
(() => {
    'use strict';

    const OWNER = 'JoshuaPelican';
    const REPO = 'sing-for-joy';

    const $ = id => document.getElementById(id);

    const songIDPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    let editIndex = null;
    let songs = [];
    let credits = [];
    let busy = false;
    let revision = 0;

    const songIDs = [
        ...new Set(songFiles.flatMap(list => list.songs))
    ].sort();

    const titleCache = new Map();

    // ----------------------------
    // SHARED HELPERS
    // ----------------------------

    function button(text, callback, disabled = false) {
        const element = document.createElement('button');

        element.type = 'button';
        element.textContent = text;
        element.disabled = disabled;
        element.addEventListener('click', callback);

        return element;
    }

    function row() {
        const element = document.createElement('div');
        element.className = 'control-row';
        return element;
    }

    function notice(message, type = '') {
        const status = $('listStatus');

        status.textContent = message;
        status.className = `form-status ${type}`.trim();
    }

    function move(array, index, delta) {
        const target = index + delta;

        if (target < 0 || target >= array.length) {
            return;
        }

        [array[index], array[target]] = [
            array[target],
            array[index]
        ];
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
                    `Song catalog unavailable (${response.status}).`
                );
            }

            const catalog = await response.json();

            if (!Array.isArray(catalog)) {
                throw Error('Invalid song catalog');
            }

            const validSongs = catalog.filter(id =>
                typeof id === 'string' &&
                songIDPattern.test(id)
            );

            for (const id of validSongs) {
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
                    // Fall back to the song file ID.
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
            const element = row();

            const select = document.createElement('select');

            select.setAttribute(
                'aria-label',
                `Song ${index + 1}`
            );

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

            element.append(
                select,

                button(
                    '↑',
                    () => {
                        move(songs, index, -1);
                        renderSongs();
                    },
                    index === 0
                ),

                button(
                    '↓',
                    () => {
                        move(songs, index, 1);
                        renderSongs();
                    },
                    index === songs.length - 1
                ),

                button('×', () => {
                    songs.splice(index, 1);
                    renderSongs();
                })
            );

            container.append(element);
        });
    }

    // ----------------------------
    // CREDIT ROWS
    // ----------------------------

    function renderCredits() {
        const container = $('listCreditRows');
        container.replaceChildren();

        credits.forEach((credit, index) => {
            const element = row();

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

            element.append(
                name,
                role,

                button(
                    '↑',
                    () => {
                        move(credits, index, -1);
                        renderCredits();
                    },
                    index === 0
                ),

                button(
                    '↓',
                    () => {
                        move(credits, index, 1);
                        renderCredits();
                    },
                    index === credits.length - 1
                ),

                button('×', () => {
                    credits.splice(index, 1);
                    renderCredits();
                })
            );

            container.append(element);
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
            $('listSubmit').disabled = true;
            return;
        }

        $('listSubmit').disabled = false;

        songs = old ? [...old.songs] : [];

        credits = old
            ? (old.credits || []).map(credit => ({
                name: credit.name,
                role: credit.role
            }))
            : [];

        // New lists inherit the latest credits as a starting point.
        if (!old && songFiles[0]?.credits) {
            credits = songFiles[0].credits.map(credit => ({
                ...credit
            }));
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

        notice('');

        renderSongs();
        renderCredits();

        // Refresh catalog whenever the editor opens.
        loadCatalog(currentRevision);
    }

    // ----------------------------
    // ADD SONG FROM CATALOG
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

                const cleanedCredits = credits.map(credit => ({
                    name: credit.name.trim(),
                    role: credit.role.trim()
                }));

                if (cleanedCredits.some(credit =>
                    !credit.name ||
                    !credit.role ||
                    credit.name.length > 150 ||
                    credit.role.length > 150
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

                if (new TextEncoder().encode(body).length > 60000) {
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
                    'Submission accepted. Wait 30 seconds and press "ctrl" + "shift" + "R" to refresh the site.',
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
