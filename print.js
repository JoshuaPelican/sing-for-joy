class HymnalPrinter {
    constructor() {
        this.pageWidth = 279.4; // Letter landscape width in mm
        this.pageHeight = 215.9; // Letter landscape height in mm
        this.margin = 14;
        this.topMargin = 10; // Smaller top margin
        this.columnGap = 40;
        this.columnWidth = (this.pageWidth - (2 * this.margin) - this.columnGap) / 2;
        this.lineHeight = 4.25; // Reduced from 5
        this.labelWidth = 20; // Reduced from 25
        this.fontSize = {
            title: 11, // Reduced from 12
            author: 8,  // Reduced from 9
            sectionLabel: 8.5, // Reduced from 8
            lyrics: 8.5  // Reduced from 10
        };
        this.allSongs = []; // Store all songs for TOC
        this.date;
    }

    async generatePDF(songIDs) {
        // Load jsPDF if not already loaded
        if (typeof jsPDF === 'undefined') {
            await this.loadJsPDF();
        }

        // First, create all content pages in normal reading order
        const contentPages = await this.createContentPages(songIDs);
        
        // Then arrange them for booklet printing
        const bookletSheets = this.arrangeForBooklet(contentPages);
        
        // Create the final PDF with booklet arrangement
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'letter'
        });

        // Add sheets in booklet order
        bookletSheets.forEach((sheet, index) => {
            // Add front of sheet
            if (index > 0) doc.addPage();
            this.renderBookletPage(doc, sheet.front.left, sheet.front.right);
            
            // Add back of sheet
            doc.addPage();
            this.renderBookletPage(doc, sheet.back.left, sheet.back.right);
        });

        return doc;
    }

    async createContentPages(songIDs) {
        const pages = [];
        let currentPageContent = [];
        let currentY = this.topMargin;
        let songNumber = 1;
        
        // Reset and prepare all songs data for TOC
        this.allSongs = [];
        for (const songID of songIDs) {
            const song = await tryGetSong(songID);
            if (!song.error) {
                this.allSongs.push({
                    number: songNumber++,
                    name: song.name,
                    id: songID
                });
            }
        }
        
        // Page 1 is the title page with TOC
        pages.push({
            type: 'title',
            content: []
        });
        
        // Page 2 is blank (back of title page)
        pages.push({
            type: 'blank',
            content: []
        });

        // Add songs to pages starting from page 3
        songNumber = 1;
        for (const songID of songIDs) {
            const song = await tryGetSong(songID);
            if (song.error) continue;

            const songContent = this.prepareSongContent(song, songNumber);
            const requiredHeight = this.calculateContentHeight(songContent);
            
            // Check if we need a new page
            if (currentY + requiredHeight > this.pageHeight - this.margin) {
                if (currentPageContent.length > 0) {
                    pages.push({
                        type: 'content',
                        content: currentPageContent
                    });
                    currentPageContent = [];
                    currentY = this.topMargin;
                }
            }

            // Add song to current page
            currentPageContent.push({
                type: 'song',
                data: songContent,
                y: currentY
            });
            
            currentY += requiredHeight + 6;
            songNumber++;
        }

        // Add final page if it has content
        if (currentPageContent.length > 0) {
            pages.push({
                type: 'content',
                content: currentPageContent
            });
        }

        return pages;
    }

    arrangeForBooklet(pages) {
        // Ensure pages count is divisible by 4
        while (pages.length % 4 !== 0) {
            pages.push({
                type: 'blank',
                content: []
            });
        }

        const n = pages.length;
        const sheets = [];
        const numSheets = n / 4;
        
        // Create booklet sheet arrangement
        // For 8 pages: 
        // Sheet 1: Front (8,1), Back (2,7)
        // Sheet 2: Front (6,3), Back (4,5)
        
        for (let i = 0; i < numSheets; i++) {
            const sheet = {
                front: {
                    left: pages[n - 1 - i * 2],      // 8, 6, ...
                    right: pages[i * 2]                // 1, 3, ...
                },
                back: {
                    left: pages[i * 2 + 1],            // 2, 4, ...
                    right: pages[n - 2 - i * 2]        // 7, 5, ...
                }
            };
            sheets.push(sheet);
        }

        return sheets;
    }

    renderBookletPage(doc, leftPage, rightPage) {
        // Render left side of the page
        if (leftPage) {
            this.renderPage(doc, leftPage, 'left');
        }
        
        // Render right side of the page
        if (rightPage) {
            this.renderPage(doc, rightPage, 'right');
        }
    }

    renderPage(doc, page, side) {
        const xStart = side === 'left' 
            ? this.margin 
            : this.margin + this.columnWidth + this.columnGap;

        if (page.type === 'title') {
            this.renderTitlePage(doc, xStart);
        } else if (page.type === 'content') {
            page.content.forEach(item => {
                if (item.type === 'song') {
                    this.renderPreparedSong(doc, item.data, xStart, item.y);
                }
            });
        }
        // If page.type === 'blank', we don't render anything
    }

    renderTitlePage(doc, xStart) {
        const centerX = xStart + (this.columnWidth / 2);
        let y = 25;

        // Title
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('Sing For Joy', centerX, y, { align: 'center' });
        y += 10;

        // Date
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150); 
        doc.setFont('helvetica', 'normal');
        const date = new Date(this.date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        doc.text(date, centerX, y, { align: 'center' });
        y += 12;

        // Subtitle
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0); 
        doc.setFont('helvetica', 'bold');
        doc.text('Song List', centerX, y, { align: 'center' });
        y += 8;

        // Song list
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const tocX = xStart + 20;
        const maxTocItems = Math.min(this.allSongs.length, 25); // Limit items to fit on page
        
        for (let i = 0; i < maxTocItems; i++) {
            const song = this.allSongs[i];
            // Song number and name
            const tocLine = `${song.number}. ${song.name}`;
            
            // Check if we need to wrap the text
            const maxWidth = this.columnWidth - 20;
            const lines = this.splitTextToFitWidth(doc, tocLine, maxWidth, 9);
            
            lines.forEach(line => {
                doc.text(line, tocX, y);
                y += 4.5;
            });
        }

        // If there are more songs, add ellipsis
        if (this.allSongs.length > maxTocItems) {
            doc.setFont('helvetica', 'italic');
            doc.text('...', centerX, y + 2, { align: 'center' });
        }

        // Bottom quote
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100); 
        doc.setFont('helvetica', 'italic');
        doc.text('"...let them ever sing for joy." - Psalm 5:11', centerX, this.pageHeight - 15, { align: 'center' });
    }

    prepareSongContent(song, songNumber) {
        const content = {
            title: `${songNumber}. ${song.name}`,
            author: song.author,
            sections: []
        };

        const printedElements = new Set();

        song.arrangement.forEach(elementKey => {
            const lyrics = song.elements[elementKey];
            if (!lyrics) return;

            const isRepeat = printedElements.has(elementKey);
            
            if (isRepeat) {
                content.sections.push({
                    type: 'repeat',
                    label: 'REPEAT',
                    text: `(${elementKey.replace(/(\D+)(\d+)/, '$1 $2')})`
                });
            } else {
                printedElements.add(elementKey);
                content.sections.push({
                    type: 'full',
                    label: this.formatElementLabel(elementKey),
                    lyrics: lyrics
                });
            }
        });

        return content;
    }

    calculateContentHeight(content) {
        let height = 0;
        
        // Title, author, and divider line
        height += this.fontSize.title * 0.4 + 1.5;
        height += this.fontSize.author * 0.4 + 3;
        height += 2; // Space for divider line
        
        // Sections
        content.sections.forEach(section => {
            if (section.type === 'repeat') {
                height += this.lineHeight;
            } else {
                section.lyrics.forEach(line => {
                    if (!line) {
                        height += 1.5;
                    } else {
                        const lines = Math.ceil(line.length / 50); // Rough estimate
                        height += lines * this.lineHeight;
                    }
                });
            }
            height += 1.5; // Section spacing
        });
        
        return height;
    }

    renderPreparedSong(doc, content, x, startY) {
        let y = startY;
        const lyricsX = x + this.labelWidth + 2;
        const lyricsWidth = this.columnWidth - this.labelWidth - 3;

        // Title
        doc.setFontSize(this.fontSize.title);
        doc.setTextColor(0, 0, 0); 
        doc.setFont('helvetica', 'bold');
        const titleLines = this.splitTextToFitWidth(doc, content.title, this.columnWidth, this.fontSize.title);
        titleLines.forEach(line => {
            doc.text(line, x, y);
            y += this.lineHeight;
        });
        
        // Author
        doc.setFontSize(this.fontSize.author);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'italic');
        doc.text(content.author, x, y);
        y += this.lineHeight + 1;

        // Divider line right below author
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.line(x, y, x + this.columnWidth, y);
        y += 7;

        // Sections
        content.sections.forEach(section => {
            if (section.type === 'repeat') {
                doc.setFontSize(this.fontSize.sectionLabel);
                doc.setTextColor(150, 150, 150); 
                doc.setFont('helvetica', 'normal');
                doc.text(section.label, x, y);
                
                doc.setFontSize(this.fontSize.lyrics);
                doc.setTextColor(0, 0, 0); 
                doc.setFont('helvetica', 'italic');
                doc.text(section.text, lyricsX, y);
                y += this.lineHeight;
            } else {
                let firstLine = true;
                section.lyrics.forEach(line => {
                    if (!line) {
                        y += 1.5;
                    } else {
                        const lines = this.splitTextToFitWidth(doc, line, lyricsWidth, this.fontSize.lyrics);
                        lines.forEach((splitLine, lineIndex) => {
                            if (firstLine && lineIndex === 0) {
                                doc.setFontSize(this.fontSize.sectionLabel);
                                doc.setTextColor(150, 150, 150); 
                                doc.setFont('helvetica', 'normal');
                                doc.text(section.label, x, y);
                                firstLine = false;
                            }
                            
                            doc.setFontSize(this.fontSize.lyrics);
                            doc.setTextColor(0, 0, 0); 
                            doc.setFont('helvetica', 'normal');
                            doc.text(splitLine, lyricsX, y);
                            y += this.lineHeight;
                        });
                    }
                });
            }
            
            y += 2.5; // Section spacing
        });
    }

    formatElementLabel(elementKey) {
        const formatted = elementKey.replace(/(\D+)(\d*)/, (match, type, num) => {
            const typeMap = {
                'verse': 'Verse',
                'chorus': 'Chorus',
                'bridge': 'Bridge',
                'prechorus': 'Pre-Chorus',
                'tag': 'Tag',
                'outro': 'Outro',
                'intro': 'Intro',
                'interlude': 'Interlude'
            };
            
            const label = typeMap[type.toLowerCase()] || type;
            return num ? `${label} ${num}` : label;
        });
        
        return formatted;
    }

    splitTextToFitWidth(doc, text, maxWidth, fontSize) {
        if (!text) return [''];
        
        doc.setFontSize(fontSize);
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = doc.getTextWidth(testLine);

            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.length ? lines : [''];
    }

    async loadJsPDF() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                window.jsPDF = window.jspdf.jsPDF;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    showPrintDialog() {
        // Remove existing dialog if present
        const existingDialog = document.getElementById('printDialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        // Create dialog HTML
        const dialogHTML = `
            <div id="printDialog" class="print-dialog-overlay">
                <div class="print-dialog">
                    <h2>Generate Sing For Joy PDF</h2>
                    <p class="dialog-description">
                        This will create a PDF formatted booklet of the current song list in booklet form.
                    </p>
                    
                    <div class="print-options">
                        <h3 style="margin: 0">Print Settings</h3>
                        <div class="print-tip">
                            <ul>
                                <li>Select "Landscape" orientation</li>
                                <li>Enable "Print on both sides"</li>
                                <li>Choose "Flip on short edge"</li>
                                <li>Print at 100% scale (no fit to page)</li>
                                <li>After printing, fold the stack in half and staple on the fold</li>
                            </ul>
                        </div>
                    </div>

                    <div class="dialog-buttons">
                        <button id="generatePdfBtn" class="btn-primary">
                            <span id="btnText">Generate PDF</span>
                            <span id="btnSpinner" class="spinner" style="display: none;"></span>
                        </button>
                        <button id="cancelPrintBtn" class="btn-secondary">Cancel</button>
                    </div>

                    <div id="printStatus" class="print-status"></div>
                </div>
            </div>
        `;

        // Add dialog to page
        document.body.insertAdjacentHTML('beforeend', dialogHTML);

        // Add event listeners
        document.getElementById('generatePdfBtn').addEventListener('click', () => this.handleGeneratePDF());
        document.getElementById('cancelPrintBtn').addEventListener('click', () => this.closeDialog());
        
        // Close on overlay click
        document.getElementById('printDialog').addEventListener('click', (e) => {
            if (e.target.id === 'printDialog') {
                this.closeDialog();
            }
        });
    }

    async handleGeneratePDF() {
        const btn = document.getElementById('generatePdfBtn');
        const btnText = document.getElementById('btnText');
        const btnSpinner = document.getElementById('btnSpinner');
        const status = document.getElementById('printStatus');

        // Show loading state
        btn.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';
        status.textContent = 'Generating PDF...';
        status.className = 'print-status loading';

        try {
            // Get latest songs
            if (!songFiles || !songFiles[0]) {
                throw new Error('No songs available');
            }

            const latestSongs = songFiles[0].songs;
            this.date = songFiles[0].date;
            
            // Generate PDF
            const pdf = await this.generatePDF(latestSongs);
            
            // Download PDF
            const fileName = `sing-for-joy-booklet-${this.date}.pdf`;
            pdf.save(fileName);

            // Show success
            status.textContent = 'PDF generated successfully!';
            status.className = 'print-status success';
            
            setTimeout(() => this.closeDialog(), 2000);
        } catch (error) {
            console.error('Error generating PDF:', error);
            status.textContent = 'Error generating PDF. Please try again.';
            status.className = 'print-status error';
            
            // Reset button
            btn.disabled = false;
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        }
    }

    closeDialog() {
        const dialog = document.getElementById('printDialog');
        if (dialog) {
            dialog.remove();
        }
    }
}

// Initialize printer instance
const hymnalPrinter = new HymnalPrinter();

// Display print dialog when navigating to /print
async function displayPrint() {
    hymnalPrinter.showPrintDialog();
}