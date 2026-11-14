const fs = require('fs');
const d = fs.readFileSync('downloaded_drawio.tmp', 'utf8');
const diagRegex = /<diagram\s+name="([^"]+)"\s+id="([^"]+)">([\s\S]*?)<\/diagram>/g;
let m;
while ((m = diagRegex.exec(d)) !== null) {
  const name = m[1];
  const content = m[3];
  const textMatches = content.match(/value="([^"]*)"/g) || [];
  const textSample = textMatches.map(t => t.replace(/&lt;[^&]*&gt;/g, '').replace(/value="|"/g, '').trim()).filter(Boolean).slice(0, 15);
  console.log(`\n=== PAGE: ${name} === (total elements: ${textMatches.length})`);
  console.log('Sample texts:', textSample.join(' | '));
}
