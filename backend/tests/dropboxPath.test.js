const test = require('node:test');
const assert = require('node:assert/strict');

const { isLegacyDropboxPath } = require('../src/utils/dropboxPath');

test('new FinFlow paths are not treated as legacy', () => {
  assert.strictEqual(isLegacyDropboxPath('/FinFlow/Agent/Customer'), false);
  assert.strictEqual(isLegacyDropboxPath('/FinFlow/Agent/Sub/Folder'), false);
});

test('legacy Dropbox paths are detected', () => {
  assert.strictEqual(isLegacyDropboxPath('/finflow/agent/customer'), true);
  assert.strictEqual(isLegacyDropboxPath('/Apps/FinFlow/finflow/agent/customer'), true);
});

