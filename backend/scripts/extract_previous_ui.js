/**
 * extract_previous_ui.js
 * Extracts the exact previous UI files before step 898 from transcript_full.jsonl
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function extract() {
  const rl = readline.createInterface({
    input: fs.createReadStream('C:/Users/vaana/.gemini/antigravity-ide/brain/dfc2197a-faeb-4a2f-9ff1-bc14f78b1400/.system_generated/logs/transcript_full.jsonl')
  });

  const views = {};

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      if (data.type === 'VIEW_FILE' && data.step_index < 898 && data.content) {
        const lines = data.content.split('\n');
        let filePath = null;
        let fileContentLines = [];
        let isCollecting = false;

        for (const l of lines) {
          if (l.startsWith('File Path: `file:///')) {
            const m = l.match(/File Path: `file:\/\/\/(.*?)`/);
            if (m) filePath = m[1].replace(/\\/g, '/').toLowerCase();
          }
          if (l.startsWith('Showing lines ')) {
            isCollecting = true;
            continue;
          }
          if (isCollecting) {
            if (l.startsWith('The above content') || l.startsWith('The above content does NOT show')) {
              break;
            }
            const match = l.match(/^(\d+):\s(.*)$/);
            if (match) {
              const lineNum = parseInt(match[1], 10);
              const lineText = match[2];
              fileContentLines.push({ num: lineNum, text: lineText });
            }
          }
        }

        if (filePath && fileContentLines.length > 0) {
          if (!views[filePath]) views[filePath] = [];
          views[filePath].push({ step: data.step_index, lines: fileContentLines });
        }
      }
    } catch (e) {}
  }

  console.log('Available extracted files:');
  for (let f in views) {
    console.log(f + ': ' + views[f].length + ' views');
    // sort by step desc
    views[f].sort((a, b) => b.step - a.step);
  }

  return views;
}

extract();
