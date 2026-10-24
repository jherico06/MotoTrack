const fs = require('fs');
const path = require('path');

function searchDir(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== '.agents') {
        searchDir(fullPath, results);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (/\bPlatform\b/.test(content)) {
        const lines = content.split('\n');
        const hasImport = lines.some(l => 
          /import\s+[^;]*?\bPlatform\b[^;]*?from\s+['"]react-native['"]/.test(l) ||
          /const\s+[^;]*?\bPlatform\b[^;]*?=\s*require\(['"]react-native['"]\)/.test(l)
        );
        if (!hasImport) {
          const uses = lines
            .map((line, idx) => ({ line: idx + 1, content: line.trim() }))
            .filter(item => /\bPlatform\b/.test(item.content) && !item.content.startsWith('//') && !item.content.startsWith('*'));
          if (uses.length > 0) {
            results.push({ file: fullPath, uses });
          }
        }
      }
    }
  }
  return results;
}

const missing = searchDir('./src');
console.log('Found ' + missing.length + ' files with missing Platform:');
for (const item of missing) {
  console.log('\nFile: ' + item.file);
  for (const u of item.uses) {
    console.log('  L' + u.line + ': ' + u.content);
  }
}
