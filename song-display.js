const songCache = new Map();

const songPage = document.getElementById("song");
const songContent = document.getElementById("songContent");
const tocPage = document.getElementById("toc");
const tocSongList = document.getElementById("songList");
const archiveButton = document.getElementById("archiveButton")

let isArchive = false;

function buildSong(song){
    let html = `
        <div class="song-header">
            <h1 class="song-title">${song.name}</h1>
            <p class="song-author">${song.author}</p>
            <div class="line"></div>
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
    return html;
}

function displaySong(song) {
    const html = buildSong(song);
    setSongContent(html);
    toggleSongDisplay(true);
}

function setSongContent(htmlContent){
    songContent.innerHTML = htmlContent;
}

function loadSong(songFileName) {
    const cachedSong = songCache.get(songFileName);
    
    if (cachedSong) {
        if (cachedSong.error) {
            setSongContent(`<div class="error-msg">Error loading song: ${songFileName}</div>`);
            toggleSongDisplay(true)
        } else {
            displaySong(cachedSong);
        }
    }
}

function toggleSongDisplay(isActive){
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
    if(isActive){
        tocPage.classList.remove('active');
        songPage.classList.add('active');
    }
    else{
        songPage.classList.remove('active');
        tocPage.classList.add('active');
    }
}

async function loadTOC(songsLists, showDateHeaders = false) {
    tocSongList.innerHTML = '<div class="loading">Loading songs...</div>';

    const songFileList = songsLists.map(x => x.songs).flat();

    // Fetch all songs in parallel
    const songPromises = songFileList.map(async (filename) => {
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
    tocSongList.innerHTML = '';

    // Cache results
    results.forEach(({ filename, song, error }) => {        
        if (error) {
            songCache.set(filename, { error: true });
        } else {
            songCache.set(filename, song);
        }
    });

    songsLists.forEach(songList => {
        if(showDateHeaders){
            const h3 = document.createElement('h3');
            h3.textContent = songList.date;
            tocSongList.appendChild(h3);
        }

        const ol = document.createElement("ol");
        ol.classList.add("song-list");
        tocSongList.appendChild(ol);

        songList.songs.forEach(songID => {
            const song = songCache.get(songID);
            const li = document.createElement('li');
        
            if (song.error) {
                li.className = 'song-item error';
                li.textContent = `${songID} (NOT FOUND)`;
            } else {
                li.className = 'song-item';
                li.textContent = song.name;
                li.onclick = () => loadSong(songID);
            }
        
            ol.appendChild(li);
        });
    });
}

function toggleArchive(){
    isArchive = !isArchive;

    if(isArchive){
        archiveButton.innerText = "Back to Current Song List";
        loadTOC(songFiles, true);
    }
    else{
        archiveButton.innerText = "Song Archive";
        loadTOC([songFiles[0]])
    }
}

// Initialize
loadTOC([songFiles[0]]);
//loadArchive();
//displayArchive();