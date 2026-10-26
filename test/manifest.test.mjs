import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('package manifest describes one DSH bundle with a client half', () => {
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(pkg.dsh.client.platform, 'web');
  assert.equal(pkg.dsh.client.immediately, true);
  assert.equal(pkg.exports['./client'], './client.js');
  assert.ok(pkg.files.includes('client.js'));
  assert.ok(pkg.files.includes('index.js'));
});

test('patch inserts this package under a stable row id', () => {
  const patch = read('cordis.patch.yml');
  assert.match(patch, /- insert:/);
  assert.match(patch, /- id: notification-chime/);
  assert.ok(patch.includes(`name: '${pkg.name}'`), 'the patch names the package exactly');
});

test('the client artifact boots under the package name', () => {
  const client = read('client.js');
  assert.match(client, /window\.__ModuleLoader__\.load\(/);
  assert.ok(client.includes(`id: '${pkg.name}'`), 'the module id equals the package name');
});

test('both locales carry plugin-manager metadata', () => {
  for (const locale of ['en', 'zh']) {
    const document = JSON.parse(read(`locale/${locale}.json`));
    assert.ok(document.meta.title.length > 0);
    assert.ok(document.meta.description.length > 0);
  }
});

test('the icon is a small valid SVG', () => {
  const icon = read('icon.svg');
  assert.ok(icon.startsWith('<svg'), 'the icon is SVG');
  assert.ok(statSync(new URL('../icon.svg', import.meta.url)).size <= 256 * 1024);
});
