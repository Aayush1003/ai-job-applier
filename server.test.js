const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createServer } = require('./server');

let server;
let baseUrl;

before(async () => {
  server = createServer({ apiKey: '' });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('serves the app and reports API key status without revealing the key', async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);

  const response = await fetch(`${baseUrl}/api/status`);
  assert.deepEqual(await response.json(), { configured: false });
});

test('rejects an OpenAI key submitted from another origin', async () => {
  const response = await fetch(`${baseUrl}/api/config`, {
    method: 'POST',
    headers: {
      Origin: 'http://attacker.invalid',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apiKey: 'sk-test-key-that-is-long-enough-123' }),
  });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /origin is not allowed/);
});

test('keeps the key in server memory, uses it for draft generation, and clears it', async () => {
  const secret = 'sk-test-key-that-is-long-enough-123';
  let upstreamRequest;
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  server = createServer({
    fetchImpl: async (url, options) => {
      upstreamRequest = { url, options };
      return new Response(JSON.stringify({
        output: [{ content: [{ type: 'output_text', text: 'Dear hiring team,\nI am excited to apply.' }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const configured = await fetch(`${baseUrl}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: secret }),
  });
  assert.equal(configured.status, 200);
  const configuredBody = await configured.json();
  assert.deepEqual(configuredBody, { configured: true });
  assert.equal(JSON.stringify(configuredBody).includes(secret), false);

  const generated = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicantName: 'Alex Example',
      title: 'Product Designer',
      company: 'Example Co',
      summary: 'Product designer with five years of experience.',
      skills: 'research, prototyping',
      highlights: '',
      description: 'Design onboarding.',
      email: 'not-sent@example.com',
    }),
  });
  assert.equal(generated.status, 200);
  assert.equal((await generated.json()).draft, 'Dear hiring team,\nI am excited to apply.');
  assert.equal(upstreamRequest.url, 'https://api.openai.com/v1/responses');
  assert.equal(upstreamRequest.options.headers.Authorization, `Bearer ${secret}`);
  const openAiBody = JSON.parse(upstreamRequest.options.body);
  assert.equal(openAiBody.model, 'gpt-4.1-mini');
  assert.equal(openAiBody.store, false);
  assert.equal(JSON.parse(openAiBody.input).email, undefined);

  const cleared = await fetch(`${baseUrl}/api/config`, { method: 'DELETE' });
  assert.deepEqual(await cleared.json(), { configured: false });
  const status = await fetch(`${baseUrl}/api/status`);
  assert.deepEqual(await status.json(), { configured: false });
});

test('requires an API key and validates required job details', async () => {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Designer', company: 'Example Co' }),
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /API key/);

  const invalidKey = await fetch(`${baseUrl}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: 'not-an-openai-key' }),
  });
  assert.equal(invalidKey.status, 400);
});
