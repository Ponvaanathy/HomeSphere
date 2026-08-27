/**
 * restore_exact_target_version.js
 * Restores all frontend files and components to the exact version
 * that existed BEFORE the last 3 modifications (prior to step 825).
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function restoreExactTarget() {
  const rl = readline.createInterface({
    input: fs.createReadStream('C:/Users/vaana/.gemini/antigravity-ide/brain/dfc2197a-faeb-4a2f-9ff1-bc14f78b1400/.system_generated/logs/transcript_full.jsonl')
  });

  const fileLinesMap = {};

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      // Up to step 897 (before the first destructive write_to_file at step 898)
      if (data.step_index >= 898) continue;

      if (data.type === 'VIEW_FILE' && data.content) {
        let filePath = null;
        const headerMatch = data.content.match(/File Path: `file:\/\/\/(.*?)`/);
        if (headerMatch) {
          filePath = headerMatch[1].replace(/\\/g, '/');
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

  // Restore target frontend files
  const filesToRestore = [
    'c:/HomeSphere/index.html',
    'c:/HomeSphere/login.html',
    'c:/HomeSphere/dashboard.html',
    'c:/HomeSphere/properties.html',
    'c:/HomeSphere/property-details.html',
    'c:/HomeSphere/advisor.html',
    'c:/HomeSphere/compare.html',
    'c:/HomeSphere/saved.html',
    'c:/HomeSphere/transactions.html',
    'c:/HomeSphere/messages.html',
    'c:/HomeSphere/list-property.html',
    'c:/HomeSphere/js/login.js',
    'c:/HomeSphere/js/dashboard.js',
    'c:/HomeSphere/js/advisor.js',
    'c:/HomeSphere/js/compare.js',
    'c:/HomeSphere/js/saved.js',
    'c:/HomeSphere/js/transactions.js',
    'c:/HomeSphere/js/messages.js',
    'c:/HomeSphere/js/property-details.js',
    'c:/HomeSphere/js/list-property.js',
    'c:/HomeSphere/css/list-property.css',
    'c:/HomeSphere/css/style.css'
  ];

  for (const f of filesToRestore) {
    const key = Object.keys(fileLinesMap).find(k => k.toLowerCase() === f.toLowerCase());
    if (key) {
      const lineNums = Object.keys(fileLinesMap[key]).map(n => parseInt(n, 10)).sort((a, b) => a - b);
      if (lineNums.length > 0) {
        const maxLine = lineNums[lineNums.length - 1];
        const contentLines = [];
        for (let i = 1; i <= maxLine; i++) {
          contentLines.push(fileLinesMap[key][i] !== undefined ? fileLinesMap[key][i] : '');
        }
        const fileContent = contentLines.join('\n');
        fs.writeFileSync(f, fileContent, 'utf8');
        console.log(`✔ Restored ${f} (${lineNums.length} lines)`);
      }
    } else {
      console.warn(`⚠ Could not find view history for ${f}`);
    }
  }
}

restoreExactTarget();
