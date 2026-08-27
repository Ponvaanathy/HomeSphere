/**
 * restore_all_previous_ui.js
 * Restores the complete HomeSphere frontend and all components to the exact version
 * that existed BEFORE the last 3 modifications.
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function restoreFullOriginal() {
  const rl = readline.createInterface({
    input: fs.createReadStream('C:/Users/vaana/.gemini/antigravity-ide/brain/dfc2197a-faeb-4a2f-9ff1-bc14f78b1400/.system_generated/logs/transcript_full.jsonl')
  });

  const filesMap = {};

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      if (data.step_index >= 898) continue; // strictly before destructive redesigns

      if (data.type === 'VIEW_FILE' && data.content) {
        let filePath = null;
        const headerMatch = data.content.match(/File Path: `file:\/\/\/(.*?)`/);
        if (headerMatch) {
          filePath = headerMatch[1].replace(/\\/g, '/');
        }
        if (filePath) {
          const normPath = filePath.toLowerCase();
          if (!filesMap[normPath]) filesMap[normPath] = { actualPath: filePath, lines: {} };
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
                filesMap[normPath].lines[lineNum] = lineText;
              }
            }
          }
        }
      }
    } catch (e) {}
  }

  // Restore each target file from the exact captured lines
  for (const normPath in filesMap) {
    const target = filesMap[normPath];
    const lineNums = Object.keys(target.lines).map(n => parseInt(n, 10)).sort((a, b) => a - b);
    if (lineNums.length > 0 && normPath.startsWith('c:/homesphere/') && !normPath.includes('/backend/')) {
      const maxLine = lineNums[lineNums.length - 1];
      const outputLines = [];
      for (let i = 1; i <= maxLine; i++) {
        outputLines.push(target.lines[i] !== undefined ? target.lines[i] : '');
      }
      const finalContent = outputLines.join('\n');
      try {
        fs.writeFileSync(target.actualPath, finalContent, 'utf8');
        console.log(`✔ Restored: ${target.actualPath} (${outputLines.length} lines)`);
      } catch (err) {
        console.error(`Error restoring ${target.actualPath}:`, err.message);
      }
    }
  }
}

restoreFullOriginal();
