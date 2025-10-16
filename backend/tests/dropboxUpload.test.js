const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const { sanitizeFileName, buildUploadPath } = require('../src/utils/dropboxUpload');

const CUSTOMER_FOLDER = '/FinFlow/customers/cust0003-sayali-sunil-pandirakar';

test('buildUploadPath retains the original filename when valid', () => {
  const originalName = 'cibil_sayali_sunil_pandirakar.pdf';
  const uploadPath = buildUploadPath(CUSTOMER_FOLDER, originalName);
  assert.strictEqual(uploadPath, `${CUSTOMER_FOLDER}/${originalName}`);
});

test('sanitizeFileName replaces only illegal path characters', () => {
  const originalName = 'report:final?.pdf';
  const sanitized = sanitizeFileName(originalName);
  assert.strictEqual(sanitized, 'report_final_.pdf');
});

test('document routes avoid Dropbox shared link helpers', () => {
  const documentRoutesPath = path.join(__dirname, '../src/routes/documentRoutes.js');
  const contents = fs.readFileSync(documentRoutesPath, 'utf8');
  assert.ok(!contents.includes('ensureSharedLink'), 'ensureSharedLink helper should be removed');
  assert.ok(
    !/sharingCreateSharedLink/i.test(contents),
    'Dropbox sharing link creation API should not be referenced'
  );
});
