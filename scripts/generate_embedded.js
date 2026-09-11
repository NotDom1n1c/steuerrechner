// scripts/generate_embedded.js
// Erzeugt /data/embedded.js: bindet alle JSON-Daten als window.STEUER_DATA ein.
// Erlaubt das Oeffnen von index.html ueber file:// ohne lokalen Server.
// Nach jeder Tarif-Aenderung erneut ausfuehren: `node scripts/generate_embedded.js`

'use strict';

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const out = path.join(dataDir, 'embedded.js');

const bund = JSON.parse(fs.readFileSync(path.join(dataDir, 'bundessteuer_2026.json'), 'utf8'));
const kantone = {};
fs.readdirSync(dataDir).forEach(function (f) {
  const m = /^kanton_([a-z]{2})\.json$/.exec(f);
  if (!m) return;
  const code = m[1].toUpperCase();
  kantone[code] = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
});

const banner = '// AUTO-GENERIERT von scripts/generate_embedded.js. Bitte nicht von Hand bearbeiten.\n' +
  '// Bietet Daten als window.STEUER_DATA, falls fetch() (file://) blockiert ist.\n';

const content = banner +
  'window.STEUER_DATA = {\n' +
  '  bund: ' + JSON.stringify(bund) + ',\n' +
  '  kantone: ' + JSON.stringify(kantone) + '\n' +
  '};\n';

fs.writeFileSync(out, content, 'utf8');
console.log('OK: ' + path.basename(out) + ' (' + content.length + ' bytes, ' + Object.keys(kantone).length + ' Kantone)');
