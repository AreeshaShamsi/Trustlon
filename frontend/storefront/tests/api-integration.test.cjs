const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  vm.runInNewContext(code, { exports, URL, process, ...globals });
  return exports;
}

test('Next.js env precedence selects localhost for dev and Vercel for production', () => {
  for (const [dev, expected] of [
    [true, 'http://localhost:4000/api/v1'],
    [false, 'https://trustlonbackend.vercel.app/api/v1'],
  ]) {
    const env = { ...process.env };
    delete env.NEXT_PUBLIC_API_URL;
    delete env.__NEXT_PROCESSED_ENV;
    delete env.NODE_ENV;
    const result = execFileSync(
      process.execPath,
      [
        '-e',
        `require('@next/env').loadEnvConfig(process.cwd(), ${dev}); process.stdout.write(process.env.NEXT_PUBLIC_API_URL)`,
      ],
      { cwd: path.join(__dirname, '..'), env, encoding: 'utf8' },
    );
    assert.equal(result, expected);
  }
});

test('upstream normalizes trailing slash and rejects malformed or duplicated prefixes', () => {
  const env = { NEXT_PUBLIC_API_URL: 'https://example.test/api/v1/' };
  const { backendUrl } = load('api-url.ts', { process: { env } });
  assert.equal(backendUrl('/products?q=a%20b'), 'https://example.test/api/v1/products?q=a%20b');
  for (const value of [
    '',
    'https://example.test',
    'https://example.test/api/v1/api/v1',
    'https://user:secret@example.test/api/v1',
  ]) {
    env.NEXT_PUBLIC_API_URL = value;
    assert.throws(() => backendUrl('/products'));
  }
});

test('proxy transport preserves refresh, credentials, JSON, headers and multipart bodies', async () => {
  const requests = [];
  const urls = load('api-url.ts');
  const http = load('http.ts', {
    require: () => urls,
    fetch: async (url, init) => {
      requests.push({ url, ...init });
      return requests.length === 1
        ? new Response('{}', { status: 401 })
        : new Response('{}', { status: 200 });
    },
  });
  http.setAccessToken('old');
  http.setRefreshHandler(async () => 'renewed');
  await http.apiFetch('/me?view=full', {
    auth: true,
    method: 'PATCH',
    body: { name: 'Test' },
    headers: { 'X-Test': 'preserved' },
  });
  assert.equal(requests[1].url, '/api/v1/me?view=full');
  assert.equal(requests[1].credentials, 'include');
  assert.equal(requests[1].headers.Authorization, 'Bearer renewed');
  assert.equal(requests[1].headers['X-Test'], 'preserved');
  assert.equal(requests[1].method, 'PATCH');
  assert.equal(requests[1].body, '{"name":"Test"}');
  const form = new FormData();
  form.append('file', new Blob(['test']), 'test.txt');
  await http.apiUpload('/returns/photos', form);
  assert.equal(requests[2].body, form);
  assert.equal(requests[2].method, 'POST');
  assert.equal(requests[2].headers['Content-Type'], undefined);
  assert.equal(requests[2].credentials, 'include');
});
