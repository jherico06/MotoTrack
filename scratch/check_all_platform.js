const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== '.git' && item.name !== '.agents') {
        getFiles(full, files);
      }
    } else if (item.isFile() && (item.name.endsWith('.js') || item.name.endsWith('.jsx'))) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = getFiles('./src');
const badFiles = [];

for (const file of allFiles) {
  const code = fs.readFileSync(file, 'utf8');
  // Check if Platform is used as an identifier (e.g. Platform.OS, Platform.select)
  if (/\bPlatform\b/.test(code)) {
    // Check if declared or imported
    const hasRNImport = /from\s+['"]react-native['"]/.test(code) && /import\s+[^;]*?\bPlatform\b[^;]*?from\s+['"]react-native['"]/.test(code);
    const hasRequire = /require\(['"]react-native['"]\)/.test(code) && /\bPlatform\b/.test(code);
    const hasParamOrVar = /const\s+Platform\b/.test(code) || /let\s+Platform\b/.test(code) || /function[^(]*\([^)]*\bPlatform\b/.test(code);
    
    if (!hasRNImport && !hasRequire && !hasParamOrVar) {
      // Find actual code lines using Platform (excluding comments and strings)
      const lines = code.split('\n');
      const offending = [];
      lines.forEach((l, idx) => {
        const trimmed = l.trim();
        if (
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('*') &&
          /\bPlatform\.(OS|select)\b/.test(trimmed)
        ) {
          offending.push({ line: idx + 1, code: trimmed });
        }
      });
      if (offending.length > 0) {
        badFiles.push({ file, offending });
      }
    }
  }
}

console.log('BAD FILES COUNT: ' + badFiles.length);
for (const b of badFiles) {
  console.log('FILE:', b.file);
  for (const o of b.offending) {
    console.log('   L' + o.line + ': ' + o.code);
  }
}
