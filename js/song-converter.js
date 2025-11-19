const fs = require('fs');
const path = require('path');

// Convert text lyrics file to YAML format
function convertToYaml(textContent) {
  const lines = textContent.trim().split('\n');
  let i = 0;
  
  // Extract song name and author
  const name = lines[i++].trim();
  const author = lines[i++].trim();
  
  // Skip empty lines
  while (i < lines.length && !lines[i].trim()) i++;
  
  // Extract arrangement
  const arrangementLine = lines[i++].trim();
  const arrangement = arrangementLine.split(',').map(s => s.trim());
  
  // Skip empty lines
  while (i < lines.length && !lines[i].trim()) i++;
  
  // Parse elements
  const elements = {};
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      i++;
      continue;
    }
    
    // Check if this is an element header (ends with numbers or is a known type)
    const elementMatch = line.match(/^(Verse|Chorus|Bridge|Pre\s?Chorus|Tag|Outro|Intro|Interlude)\s*(\d+)?$/i);
    
    if (elementMatch) {
      // Create a key from the element type
      const type = elementMatch[1].toLowerCase().replace(/\s/g, '');
      const num = elementMatch[2] || '';
      const key = type + num;
      
      elements[key] = [];
      i++;
      
      // Collect lyrics until next element or end
      while (i < lines.length) {
        const lyricLine = lines[i].trim();
        
        // Check if next element is starting
        if (lyricLine.match(/^(Verse|Chorus|Bridge|Pre\s?Chorus|Tag|Outro|Intro|Interlude)\s*(\d+)?$/i)) {
          break;
        }
        
        // Add lyric line (even if empty for spacing)
        if (lyricLine || elements[key].length > 0) {
          elements[key].push(lyricLine);
        }
        
        i++;
      }
      
      // Remove trailing empty lines
      while (elements[key].length > 0 && !elements[key][elements[key].length - 1]) {
        elements[key].pop();
      }
    } else {
      i++;
    }
  }
  
  // Build YAML
  let yaml = `name: ${name}\n`;
  yaml += `author: ${author}\n\n`;
  yaml += `arrangement: [${arrangement.join(', ')}]\n\n`;
  yaml += `elements:\n`;
  
  for (const [key, lyrics] of Object.entries(elements)) {
    yaml += `  ${key}:\n`;
    for (const lyric of lyrics) {
      yaml += `    - ${lyric}\n`;
    }
  }
  
  return yaml;
}

// Main execution
const fileNames = process.argv.slice(2);

if (fileNames.length === 0) {
  console.log('Usage: node converter.js <file1.txt> <file2.txt> ...');
  console.log('Creates corresponding .yaml files in the same directory');
  process.exit(1);
}

fileNames.forEach(fileName => {
  try {
    const inputPath = path.resolve("songs/" + fileName);
    const outputPath = inputPath.replace(/\.[^.]+$/, '.yaml');
    
    if (!fs.existsSync(inputPath)) {
      console.error(`File not found: ${fileName}`);
      return;
    }
    
    const textContent = fs.readFileSync(inputPath, 'utf-8');
    const yaml = convertToYaml(textContent);
    
    fs.writeFileSync(outputPath, yaml);
    console.log(`✓ Converted: ${fileName} → ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`✗ Error processing ${fileName}:`, error.message);
  }
});