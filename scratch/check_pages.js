const fs = require('fs');
const d = fs.readFileSync('downloaded_drawio.tmp', 'utf8');
const diagRegex = /<diagram\s+name="([^"]+)"\s+id="([^"]+)">/g;
let m;
while ((m = diagRegex.exec(d)) !== null) {
  console.log(`Page: ${m[1]} (id: ${m[2]})`);
}
