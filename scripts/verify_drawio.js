const fs = require('fs');

const content = fs.readFileSync('MotoTrack_Flowcharts.drawio', 'utf8');
const diagRegex = /<diagram\s+name="([^"]+)"\s+id="([^"]+)">/g;
let m;
let i = 1;

console.log('=== VERIFYING PAGES IN MotoTrack_Flowcharts.drawio ===');
while ((m = diagRegex.exec(content)) !== null) {
  console.log(`${i++}. [${m[1]}] (id: ${m[2]})`);
}
