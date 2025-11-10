const songCache = new Map();

const songPage = document.getElementById("song");
const songContent = document.getElementById("songContent");
const tocPage = document.getElementById("toc");
const tocSongList = document.getElementById("songList");
const archiveButton = document.getElementById("archiveButton")

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

async function displaySong(songData) {
    const song = await tryGetSong(songData.params.id);
    
    if (!song || song.error) {
        setSongContent(`<div class="error-msg">Error displaying song: ${songData.params.id}</div>`);
    } else {
        const html = buildSong(song);
        setSongContent(html);
    }
    toggleSongDisplay(true);
}

function displayPrint() {
    const html = hymnalPrinter.createPrintPageContent();
    setSongContent(html);
    toggleSongDisplay(true);
    
    // Attach event listener after content is added to DOM
    setTimeout(() => {
        const generateBtn = document.getElementById('generatePdfBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => hymnalPrinter.handleGeneratePDF());
        }
    }, 0);
}

function setSongContent(htmlContent){
    songContent.innerHTML = htmlContent;
}

async function tryGetSong(songID){    
    if(!songCache.has(songID))
        await fetchAndCacheSong(songID);

    return songCache.get(songID);
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

async function buildSongList(songIDs) {
    await Promise.all(songIDs.map(async id => await tryGetSong(id)));

    const ol = document.createElement("ol");
    ol.classList.add("song-list");

    const items = await Promise.all(songIDs.map(songID => buildSongItem(songID)));
    items.forEach(item => ol.appendChild(item));
    return ol;
}

async function buildSongItem(songID){
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



async function fetchAndCacheSong(songID){
    if (songCache.has(songID) && !songCache.get(songID).error) {
        return songCache.get(songID);
    }

    let songData;
    try {
        const response = await fetch(`songs/${songID}.yaml`);
        if (!response.ok) 
            throw new Error('Not found');
        
        const text = await response.text();
        const parsed = jsyaml.load(text);
        const song = {
            id: songID,
            name: parsed.name,
            author: parsed.author,
            arrangement: parsed.arrangement,
            elements: parsed.elements,
            error: false
        };
        
        songData = song;
    } catch (error) {
        console.error(`Error loading ${songID}:`, error);
        songData = { id: songID, error: true };
    }

    songCache.set(songID, songData);
}

const router = new HistoryManager();
router.register('/', displayHome)
    .register('/archive', displayArchive)
    .register('/song', (data) => displaySong(data))
    .register('/print', displayPrint)
    .register('*', displayHome)
    .init();

function navHome(){
    router.navigate("/");
}

function navArchive(){
    router.navigate("/archive");
}

function navSong(songID){
    router.navigate(`/song?id=${songID}`)
}

function navPrint(){
    router.navigate("/print");
}

async function displayHome(){
    tocSongList.innerHTML = '';
    toggleSongDisplay(false);
    updateArchiveButton(false);

    if(songFiles == null)
    {
        return;
    }

    const songList = songFiles[0];

    // create date header
    const header = document.createElement("p");
    header.classList.add("credits")
    header.style.marginTop = "10px";
    header.innerText = songList.date;
    tocSongList.appendChild(header);

    // create song list
    const list = await buildSongList(songList.songs);
    tocSongList.appendChild(list);

}

async function displayArchive() {
    tocSongList.innerHTML = '';
    toggleSongDisplay(false);
    updateArchiveButton(true);

    if(songFiles == null)
    {
        return;
    }

    for (const songList of songFiles){
        // create date header
        const header = document.createElement("p");
        header.classList.add("credits")
        header.style.marginTop = "10px";
        header.innerText = songList.date;
        tocSongList.appendChild(header);

        // create song list
        const list = await buildSongList(songList.songs);
        tocSongList.appendChild(list);
    }
}

function updateArchiveButton(isArchive) {
    if (isArchive) {
        archiveButton.textContent = "← Latest Songs";
        archiveButton.onclick = navHome;
    } else {
        archiveButton.textContent = "Song Archive →";
        archiveButton.onclick = navArchive;
    }
}

const backButton = document.getElementById("backButton");
backButton.addEventListener("click", () => router.back())