const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../../property-details.html');
const jsPath = path.join(__dirname, '../../js/property-details.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

// Match document.getElementById('...') and safe setters setText('...'), setHTML('...'), setWidth('...'), setSrc('...'), setVal('...')
const regex = /(?:document\.getElementById|setText|setHTML|setWidth|setSrc|setVal)\(['"]([^'"]+)['"]\)/g;
const matches = [];
let m;
while ((m = regex.exec(js)) !== null) {
  matches.push(m[1]);
}

const uniqueIds = [...new Set(matches)];
console.log(`Found ${uniqueIds.length} element IDs accessed in property-details.js.`);

const missing = uniqueIds.filter(id => {
  // Ignore dynamic elements like lightbox, toast, etc. created dynamically
  if (['imageLightbox', 'lightboxImg', 'toast-container'].includes(id)) return false;
  return !html.includes(`id="${id}"`) && !html.includes(`id='${id}'`);
});

if (missing.length > 0) {
  console.error('❌ Missing element IDs in property-details.html:', missing);
  process.exit(1);
} else {
  console.log('✅ ALL DOM ELEMENT IDS ARE FULLY PRESENT IN property-details.html!');
}
