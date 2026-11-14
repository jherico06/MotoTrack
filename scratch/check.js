const fs = require('fs');
const d = fs.readFileSync('downloaded_drawio.tmp', 'utf8');
const main = d.split('</diagram>')[0];
const matches = main.match(/value="([^"]*)"/g) || [];
const cleaned = matches.map(m => m.replace(/&lt;[^&]*&gt;/g, '').replace(/value="|"/g, '').trim()).filter(Boolean);
console.log('Main diagram text values count:', cleaned.length);
console.log('Values:', cleaned);
