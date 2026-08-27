/**
 * extract_original_files.js
 * Scans transcript_full.jsonl to reconstruct all original files as they existed
 * before the 3 modifications (i.e. at step 800).
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function extractFiles() {
  const rl = readline.createInterface({
    input: fs.createReadStream('C:/Users/vaana/.gemini/antigravity-ide/brain/dfc2197a-faeb-4a2f-9ff1-bc14f78b1400/.system_generated/logs/transcript_full.jsonl')
  });

  const fileLinesMap = {};

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      if (data.step_index >= 825) continue; // Only state BEFORE the 3 modifications

      if (data.type === 'VIEW_FILE' && data.content) {
        let filePath = null;
        const headerMatch = data.content.match(/File Path: `file:\/\/\/(.*?)`/);
        if (headerMatch) {
          filePath = headerMatch[1].replace(/\\/g, '/').toLowerCase();
        }
        if (filePath) {
          if (!fileLinesMap[filePath]) fileLinesMap[filePath] = {};
          const lines = data.content.split('\n');
          let isCollecting = false;
          for (const l of lines) {
            if (l.startsWith('Showing lines ')) {
              isCollecting = true;
              continue;
            }
            if (isCollecting) {
              if (l.startsWith('The above content')) break;
              const lm = l.match(/^(\d+):\s(.*)$/);
              if (lm) {
                const lineNum = parseInt(lm[1], 10);
                const lineText = lm[2];
                fileLinesMap[filePath][lineNum] = lineText;
              }
            }
          }
        }
      }
    } catch (e) {}
  }

  console.log('--- Reconstructed File Line Coverage Before Step 825 ---');
  for (let f in fileLinesMap) {
    const lineNums = Object.keys(fileLinesMap[f]).map(n => parseInt(n, 10)).sort((a, b) => a - b);
    const minLine = lineNums[0];
    const maxLine = lineNums[lineNums.length - 1];
    console.log(`${f}: ${lineNums.length} lines (range ${minLine} - ${maxLine})`);
  }
}

extractFiles();
