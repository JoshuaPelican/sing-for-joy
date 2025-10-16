// Cache for loaded songs
const songCache = new Map();

function displaySong(song) {
    let html = `
        <div class="song-header">
            <h1 class="song-title">${song.name}</h1>
            <p class="song-author">${song.author}</p>
        </div>
        <div class="lyrics-container">
    `;

    song.arrangement.forEach(elementKey => {
        const lyrics = song.elements[elementKey];
        if (!lyrics) return;

        html += `
            <div class="song-section">
                <div class="section-label">${elementKey.replace(/(\D+)(\d+)/, '$1 $2')}</div>
                <div class="section-lyrics">
                    ${lyrics.map((lyric, i) => {
                        if (!lyric) return `<div style="margin: 0.75em 0;"></div>`;
                        return `<div>${lyric}</div>`;
                    }).join('')}
                </div>
            </div>
        `;
    });

    html += '</div>';
    document.getElementById('songContent').innerHTML = html;

    document.getElementById('toc').classList.remove('active');
    document.getElementById('song').classList.add('active');
}

function loadSong(filename) {
    const cachedSong = songCache.get(filename);
    
    if (cachedSong) {
        if (cachedSong.error) {
            document.getElementById('songContent').innerHTML =
                `<div class="error-msg">Error loading song: ${filename}</div>`;
            document.getElementById('toc').classList.remove('active');
            document.getElementById('song').classList.add('active');
        } else {
            displaySong(cachedSong);
        }
    }
}

function showTOC() {
    document.getElementById('song').classList.remove('active');
    document.getElementById('toc').classList.add('active');
}

async function loadAllSongs() {
    const list = document.getElementById('songList');
    list.innerHTML = '<div class="loading">Loading songs...</div>';
    
    // Fetch all songs in parallel
    const songPromises = songFiles.map(async (filename) => {
        try {
            const response = await fetch(`songs/${filename}.yaml`);
            if (!response.ok) throw new Error('Not found');
            const text = await response.text();
            const parsed = jsyaml.load(text);
            
            const song = {
                name: parsed.name,
                author: parsed.author,
                arrangement: parsed.arrangement,
                elements: parsed.elements
            };
            
            return { filename, song, error: false };
        } catch (error) {
            console.error(`Error loading ${filename}:`, error);
            return { filename, song: null, error: true };
        }
    });
    
    const results = await Promise.all(songPromises);
    
    // Clear loading message
    list.innerHTML = '';
    
    // Cache results and create list items
    results.forEach(({ filename, song, error }) => {
        const li = document.createElement('li');
        
        if (error) {
            songCache.set(filename, { error: true });
            li.className = 'song-item error';
            li.textContent = `${filename} (NOT FOUND)`;
        } else {
            songCache.set(filename, song);
            li.className = 'song-item';
            li.textContent = song.name;
            li.onclick = () => loadSong(filename);
        }
        
        list.appendChild(li);
    });
}

// Initialize
loadAllSongs();