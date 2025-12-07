class HymnalPrinter {
    constructor() {
        this.pageWidth = 279.4; // Letter landscape width in mm
        this.pageHeight = 215.9; // Letter landscape height in mm
        this.margin = 14;
        this.topMargin = 10;
        this.columnGap = 40;
        this.columnWidth = (this.pageWidth - (2 * this.margin) - this.columnGap) / 2;
        this.lineHeight = 4.25;
        this.labelWidth = 20;
        this.fontSize = {
            title: 11,
            author: 9,
            sectionLabel: 8.75,
            lyrics: 8.75 
        };
        this.allSongs = []; // Store all songs for TOC
        this.date;
        this.qrCodeSize = 45; // QR code size in mm - bigger now
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
        for (let i = 0; i < bookletSheets.length; i++) {
            const sheet = bookletSheets[i];
            
            // Add front of sheet
            if (i > 0) doc.addPage();
            
            // Add fold/staple lines - staple lines only on first sheet front
            if (i === 0) {
                this.renderStapleAndFoldLines(doc);
            } else {
                this.renderFoldLine(doc);
            }
            
            this.renderBookletPage(doc, sheet.front.left, sheet.front.right);
            
            // Add back of sheet
            doc.addPage();
            this.renderFoldLine(doc); // Only fold line on backs
            this.renderBookletPage(doc, sheet.back.left, sheet.back.right);
        }

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
        while (pages.length % 4 !== 3) {
            pages.push({
                type: 'blank',
                content: []
            });
        }

        // Page 2 is the back cover with QR codes and credits
        pages.push({
            type: 'backcover',
            content: []
        });

        const n = pages.length;
        const sheets = [];
        const numSheets = n / 4;
        
        // Create booklet sheet arrangement
        for (let i = 0; i < numSheets; i++) {
            const sheet = {
                front: {
                    left: pages[n - 1 - i * 2],      
                    right: pages[i * 2]               
                },
                back: {
                    left: pages[i * 2 + 1],           
                    right: pages[n - 2 - i * 2]       
                }
            };
            sheets.push(sheet);
        }

        return sheets;
    }

    renderFoldLine(doc) {
        const centerX = this.pageWidth / 2;
        
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.setLineDash([2, 2]);

        // Center fold line (vertical)
        doc.line(centerX, this.margin, centerX, this.pageHeight - this.margin);
        
        // Reset line dash
        doc.setLineDash([]);
    }

    renderStapleAndFoldLines(doc) {
        const centerX = this.pageWidth / 2;
        const stapleOffset = 7; // Distance from center line
        const stapleY1 = this.pageHeight * 0.15; // Upper position
        const stapleY2 = this.pageHeight * 0.85; // Lower position
        const stapleLength = 8; // Length of staple guide lines

        // First render the fold line
        this.renderFoldLine(doc);

        // Then add staple lines (vertical lines parallel to spine)
        doc.setLineWidth(0.4);
        doc.setDrawColor(150, 150, 150);
        doc.setLineDash([]);

        // Left staple line
        const leftStapleX = centerX - stapleOffset;
        doc.line(leftStapleX, stapleY1 - stapleLength/2, leftStapleX, stapleY1 + stapleLength/2);
        doc.line(leftStapleX, stapleY2 - stapleLength/2, leftStapleX, stapleY2 + stapleLength/2);

        // Right staple line
        const rightStapleX = centerX + stapleOffset;
        doc.line(rightStapleX, stapleY1 - stapleLength/2, rightStapleX, stapleY1 + stapleLength/2);
        doc.line(rightStapleX, stapleY2 - stapleLength/2, rightStapleX, stapleY2 + stapleLength/2);
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
        }
        else if(page.type === 'backcover')
        {
            this.renderBackCoverPage(doc, xStart);
        }
        else if (page.type === 'content') {
            page.content.forEach(item => {
                if (item.type === 'song') {
                    this.renderPreparedSong(doc, item.data, xStart, item.y);
                }
            });
        }
    }

    async renderBackCoverPage(doc, xStart) {
        const centerX = xStart + (this.columnWidth / 2);
        let y = 30;

        // QR Codes section
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Other Stuff', centerX, y, { align: 'center' });
        y += 12;

        // Stack QR codes vertically, centered
        const qrX = centerX - this.qrCodeSize / 2;

        // Email list QR code
        const emailUrl = 'https://docs.google.com/forms/d/1TqZYus-cnbzcF9ICdVFqH9LwDEVTybSX9xBkZ6tV19c';
        const emailQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&data=${encodeURIComponent(emailUrl)}`;
        
        try {
            doc.addImage(emailQrUrl, 'PNG', qrX, y, this.qrCodeSize, this.qrCodeSize);
        } catch (e) {
            console.error('Error loading email QR code:', e);
            // Draw placeholder
            doc.setDrawColor(200, 200, 200);
            doc.rect(qrX, y, this.qrCodeSize, this.qrCodeSize);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('QR Code', centerX, y + this.qrCodeSize/2, { align: 'center' });
        }

        y += this.qrCodeSize + 6;

        // Email label
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text('Join Mailing List', centerX, y, { align: 'center' });
        y += 10;

        // Website QR code
        const websiteUrl = 'https://joshuapelican.github.io/sing-for-joy';
        const websiteQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&data=${encodeURIComponent(websiteUrl)}`;
        
        try {
            doc.addImage(websiteQrUrl, 'PNG', qrX, y, this.qrCodeSize, this.qrCodeSize);
        } catch (e) {
            console.error('Error loading website QR code:', e);
            // Draw placeholder
            doc.setDrawColor(200, 200, 200);
            doc.rect(qrX, y, this.qrCodeSize, this.qrCodeSize);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('QR Code', centerX, y + this.qrCodeSize/2, { align: 'center' });
        }

        y += this.qrCodeSize + 6;

        // Website label
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text('Digital Lyrics', centerX, y, { align: 'center' });

        // Credits section at bottom
        y = this.pageHeight - 45;
        
        /*
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text('"...let them ever sing for joy."', centerX, y, { align: 'center' });
        y += 4;
        doc.text('- Psalm 5:11', centerX, y, { align: 'center' });
        y += 10;
        */

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Thanks', centerX, y, { align: 'center' });
        y += 6;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(60, 60, 60);
        
        creditList.forEach(credit => {
            doc.text(`${credit.name} - ${credit.role}`, centerX, y, { align: 'center' });
            y += 4;
        });
        y -= 4;
    }

    renderTitlePage(doc, xStart) {
        const centerX = xStart + (this.columnWidth / 2);
        let y = 25;

        // Title
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
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
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const tocX = xStart + 20;
        const maxTocItems = Math.min(this.allSongs.length, 25); // Limit items to fit on page
        
        for (let i = 0; i < maxTocItems; i++) {
            const song = this.allSongs[i];
            // Song number and name
            const tocLine = `${song.number}. ${song.name}`;
            
            // Check if we need to wrap the text
            const maxWidth = this.columnWidth - 40;
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
                'interlude': 'Interlude',
                'refrain': 'Refrain'
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

    createPrintPageContent() {
        return `
            <div class="song-header">
                <h2 class="song-title">Generate PDF Booklet</h2>
                <p class="song-author">Print settings and instructions</p>
                <div class="line"></div>
            </div>
            
            <div class="print-instructions">
                <h3>Print Settings</h3>
                <ul>
                    <li>Select "Landscape" orientation</li>
                    <li>Enable "Print on both sides"</li>
                    <li>Choose "Flip on short edge"</li>
                    <li>Print at 100% scale (no fit to page)</li>
                </ul>
                <h3>After Printing</h3>
                <ul>
                    <li>Fold the each booklet stack in half along the center line</li>
                    <li>Staple along the spine at the marked positions</li>
                </ul>
            </div>

            <button id="generatePdfBtn" class="song-item"">
                <span id="btnText">Generate PDF</span>
                <span id="btnSpinner" class="spinner" style="display: none;"></span>
            </button>

            <div id="printStatus" class="print-status"></div>
        `;
    }

    async handleGeneratePDF() {
        const btn = document.getElementById('generatePdfBtn');
        const btnText = document.getElementById('btnText');
        const btnSpinner = document.getElementById('btnSpinner');
        const status = document.getElementById('printStatus');

        // Show loading state
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';
        status.textContent = 'Generating PDF...';
        status.className = 'print-status';
        status.style.display = 'block';

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
            status.style.color = "var(--success)";
            
            //setTimeout(() => navHome(), 2000);
        } catch (error) {
            console.error('Error generating PDF:', error);
            status.textContent = 'Error generating PDF. Please try again.';
            status.style.color = 'var(--error)';
        }

        // Reset button
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
    }
}

// Initialize printer instance
const hymnalPrinter = new HymnalPrinter();