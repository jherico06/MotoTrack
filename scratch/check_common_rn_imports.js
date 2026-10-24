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

const rnIdentifiers = [
  'Dimensions',
  'StyleSheet',
  'SafeAreaView',
  'TouchableOpacity',
  'TouchableWithoutFeedback',
  'ScrollView',
  'FlatList',
  'ActivityIndicator',
  'Alert',
  'TextInput',
  'Image',
  'Modal',
  'Animated',
  'KeyboardAvoidingView',
  'BackHandler',
  'Linking',
];

const allFiles = getFiles('./src');
const issues = [];

for (const file of allFiles) {
  const code = fs.readFileSync(file, 'utf8');
  
  for (const ident of rnIdentifiers) {
    const regex = new RegExp(`\\b${ident}\\b`);
    if (regex.test(code)) {
      // Check if imported or defined
      const hasImport = new RegExp(`import\\s+[^;]*?\\b${ident}\\b[^;]*?from`).test(code);
      const hasRequire = new RegExp(`require\\([^)]*\\).*?\\b${ident}\\b`).test(code) || new RegExp(`\\b${ident}\\b.*?=\\s*require\\(`).test(code);
      const hasDecl = new RegExp(`(const|let|var|function|class)\\s+${ident}\\b`).test(code);
      const isParam = new RegExp(`\\([^)]*?\\b${ident}\\b[^)]*?\\)\\s*=>`).test(code) || new RegExp(`function[^(]*?\\([^)]*?\\b${ident}\\b`).test(code);

      if (!hasImport && !hasRequire && !hasDecl && !isParam) {
        // filter out comments
        const lines = code.split('\n');
        const offending = [];
        lines.forEach((l, idx) => {
          const t = l.trim();
          if (!t.startsWith('//') && !t.startsWith('*') && regex.test(t)) {
            // make sure it's not a property access like obj.Image
            if (!new RegExp(`\\.\\s*${ident}\\b`).test(t)) {
              offending.push({ line: idx + 1, code: t });
            }
          }
        });
        if (offending.length > 0) {
          issues.push({ file, ident, offending });
        }
      }
    }
  }
}

console.log('ISSUES COUNT:', issues.length);
for (const iss of issues) {
  console.log(`\nFile: ${iss.file} (Missing: ${iss.ident})`);
  for (const o of iss.offending.slice(0, 3)) {
    console.log(`   L${o.line}: ${o.code}`);
  }
}
