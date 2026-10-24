const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../node_modules/react-native-css-interop/dist/css-to-rn/parseDeclaration.js');

if (!fs.existsSync(targetPath)) {
  process.exit(0);
}

let content = fs.readFileSync(targetPath, 'utf8');
let modified = false;

// 1. Fix fallthrough from case "box-shadow" into case "aspect-ratio"
const buggyBoxShadow = 'case "box-shadow": {\n            parseBoxShadow(declaration.value, parseOptions);\n        }';
const fixedBoxShadow = 'case "box-shadow": {\n            return parseBoxShadow(declaration.value, parseOptions);\n        }';

if (content.includes(buggyBoxShadow)) {
  content = content.replace(buggyBoxShadow, fixedBoxShadow);
  modified = true;
}

// 2. Safe parseAspectRatio check
const buggyParseAspect = `function parseAspectRatio(aspectRatio) {
    if (aspectRatio.auto) {
        return "auto";
    }
    else {
        if (aspectRatio.ratio[0] === aspectRatio.ratio[1]) {`;

const safeParseAspect = `function parseAspectRatio(aspectRatio) {
    if (!aspectRatio) {
        return undefined;
    }
    if (aspectRatio.auto) {
        return "auto";
    }
    else if (aspectRatio.ratio && Array.isArray(aspectRatio.ratio)) {
        if (aspectRatio.ratio[0] === aspectRatio.ratio[1]) {`;

if (content.includes(buggyParseAspect)) {
  content = content.replace(buggyParseAspect, safeParseAspect);
  modified = true;
}

if (modified) {
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('[patch-css-interop] Successfully patched react-native-css-interop/parseDeclaration.js');
} else {
  console.log('[patch-css-interop] react-native-css-interop is already patched or up-to-date.');
}
