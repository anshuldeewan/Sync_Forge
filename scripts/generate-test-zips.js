const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

async function createZips() {
  const extractZip = new JSZip();
  extractZip.file('root-extract.txt', 'Hello root!');
  extractZip.folder('nested-folder').file('nested-file.js', 'console.log("hello");');
  const extractBuffer = await extractZip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(__dirname, '..', 'e2e', 'test-extract.zip'), extractBuffer);

  const singleZip = new JSZip();
  singleZip.file('single-zip-file.txt', 'This should not be extracted');
  const singleBuffer = await singleZip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(__dirname, '..', 'e2e', 'test-single.zip'), singleBuffer);
  console.log('ZIPs created.');
}

createZips().catch(console.error);
