// GitHub Pages serves the site under /lead-dashboard/, not at the domain root.
// Absolute paths ("/css/...", page.goto('/')) would leave that path, so they are not allowed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = (p) => readFileSync(p, 'utf8');
const files = (dir, ext) => readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => join(dir, f));

test('paths: UI tests never navigate to the domain root (goto("/..."))', () => {
  for (const file of files('tests/ui', '.js')) {
    const bad = read(file).split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /goto\(\s*['"`]\//.test(l));
    assert.deepEqual(bad, [], `${file}: use page.goto('./')`);
  }
});

test('paths: the site uses only relative paths (HTML, CSS, JS)', () => {
  const checks = [
    ['index.html', /\b(?:href|src)\s*=\s*["']\/(?!\/)/],
    ...files('css', '.css').map((f) => [f, /url\(\s*["']?\/(?!\/)/]),
    ...files('js', '.js').map((f) => [f, /(?:from|import\()\s*["']\/|fetch\(\s*["']\//]),
  ];
  for (const [file, re] of checks) {
    const bad = read(file).split('\n').map((l, i) => [i + 1, l.trim()]).filter(([, l]) => re.test(l));
    assert.deepEqual(bad, [], `${file} has an absolute path`);
  }
});
