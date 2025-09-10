// List of songs to display

function parseSong(text) {
    const lines = text.trim().split('\n');
    let i = 0;

    const title = lines[i++];
    const author = lines[i++];

    while (i < lines.length && lines[i].trim() === '') i++;

    const arrangement = lines[i++].split(',').map(s => s.trim());

    while (i < lines.length && lines[i].trim() === '') i++;

    const elements = {};
    while (i < lines.length) {
        const elementType = lines[i++];
        if (!elementType || elementType.trim() === '') continue;

        const lyrics = [];
        while (i < lines.length && lines[i].trim() !== '') {
            lyrics.push(lines[i++]);
        }

        const key = elementType.toLowerCase().replace(/\s+/g, '');
        elements[key] = {
            type: elementType,
            lyrics: lyrics
        };

        while (i < lines.length && lines[i].trim() === '') i++;
    }

    return { name: title, author, arrangement, elements };
}

async function loadSong(filename) {
    try {
        const response = await fetch(`songs/${filename}`);
        if (!response.ok) throw new Error('File not found');
        const text = await response.text();
        const song = parseSong(text);

        let html = `
            <div class="song-header">
                <h1 class="song-title">${song.name}</h1>
                <p class="song-author">${song.author}</p>
            </div>
            <div class="lyrics-container">
        `;

        song.arrangement.forEach(elementKey => {
            const element = song.elements[elementKey];
            if (!element) return;

            html += `
                <div class="song-section">
                    <div class="section-label">${element.type}</div>
                    <div class="section-lyrics">
                        ${element.lyrics.join('<br>')}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        document.getElementById('songContent').innerHTML = html;

        document.getElementById('toc').classList.remove('active');
        document.getElementById('song').classList.add('active');

    } catch (error) {
        document.getElementById('songContent').innerHTML =
            `<div class="error-msg">Error loading song: ${filename}</div>`;
        document.getElementById('toc').classList.remove('active');
        document.getElementById('song').classList.add('active');
    }
}

function showTOC() {
    document.getElementById('song').classList.remove('active');
    document.getElementById('toc').classList.add('active');
}

async function loadSongList() {
    const list = document.getElementById('songList');
    list.innerHTML = '';

    for (const filename of songFiles) {
        const li = document.createElement('li');

        try {
            const response = await fetch(`songs/${filename}`);
            if (!response.ok) throw new Error('Not found');
            const text = await response.text();
            const song = parseSong(text);

            li.className = 'song-item';
            li.textContent = song.name;
            li.onclick = () => loadSong(filename);

        } catch (error) {
            li.className = 'song-item error';
            li.textContent = `${filename} (NOT FOUND)`;
        }

        list.appendChild(li);
    }
}

// Initialize
loadSongList();