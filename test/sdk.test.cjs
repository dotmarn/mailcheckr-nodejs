'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { MailCheckrClient, MailCheckrError, VerificationResult, WebhookVerifier } = require('../src/index.cjs');

test('verify sends auth, JSON, and idempotency key; 202 stays pending', async () => {
  let call;
  const client = new MailCheckrClient({ apiKey: 'secret', fetch: async (...args) => {
    call = args;
    return new Response(JSON.stringify({ data: { id: 'abc', state: 'queued', status: null } }), { status: 202 });
  } });
  const result = await client.verify('a@example.com', 'key-1');
  assert.equal(call[0], 'https://mailcheckr.app/api/v1/verifications');
  assert.equal(call[1].headers.Authorization, 'Bearer secret');
  assert.equal(call[1].headers['Idempotency-Key'], 'key-1');
  assert.deepEqual(JSON.parse(call[1].body), { email: 'a@example.com' });
  assert.equal(result.isPending(), true);
  assert.equal(result.isDeliverable(), false);
});

test('find retrieves completed result', async () => {
  let url;
  const client = new MailCheckrClient({ apiKey: 'secret', baseUrl: 'https://example.com/api/v1/', fetch: async (requested) => {
    url = requested;
    return new Response(JSON.stringify({ data: { id: 'abc', state: 'completed', status: 'deliverable' } }));
  } });
  const result = await client.find('abc');
  assert.equal(url, 'https://example.com/api/v1/verifications/abc');
  assert.equal(result.isDeliverable(), true);
  assert.equal(result.isPending(), false);
});

test('errors preserve status and API body; malformed success is rejected', async () => {
  const failed = new MailCheckrClient({ apiKey: 'secret', fetch: async () => new Response(JSON.stringify({ message: 'Conflict' }), { status: 409 }) });
  await assert.rejects(failed.verify('a@example.com', 'key'), (error) => error instanceof MailCheckrError && error.status === 409 && error.response.message === 'Conflict');
  const malformed = new MailCheckrClient({ apiKey: 'secret', fetch: async () => new Response('{}') });
  await assert.rejects(malformed.find('abc'), /unexpected response/);
  assert.throws(() => new VerificationResult({ id: 'abc' }), /requires an ID and state/);
  assert.throws(() => malformed.find('../abc'), /valid verification ID/);
});

test('status helpers require completed state', () => {
  for (const status of ['deliverable', 'undeliverable', 'risky', 'unknown']) {
    const pending = new VerificationResult({ id: 'a', state: 'processing', status });
    assert.equal(pending[`is${status[0].toUpperCase()}${status.slice(1)}`](), false);
  }
  assert.equal(new VerificationResult({ id: 'a', state: 'failed' }).isFailed(), true);
});

test('webhook verifies raw bytes, timestamp, and case-insensitive headers', () => {
  const body = Buffer.from('{"id":"event_1"}');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = 'v1=' + createHmac('sha256', 'whsec').update(timestamp + '.').update(body).digest('hex');
  const verifier = new WebhookVerifier('whsec');
  assert.equal(verifier.verify(body, { 'x-mailcheckr-timestamp': timestamp, 'X-MailCheckr-Signature': signature }), true);
  assert.equal(verifier.verifyPayload(Buffer.from('{"id":"event_2"}'), timestamp, signature), false);
  assert.equal(verifier.verifyPayload(body, String(Number(timestamp) - 301), signature), false);
  assert.equal(verifier.verifyPayload(body, timestamp, 'v1=bad'), false);
  assert.equal(new WebhookVerifier('wrong').verifyPayload(body, timestamp, signature), false);
});

test('ES module exports are available', async () => {
  const esm = await import('../src/index.mjs');
  assert.equal(esm.MailCheckrClient, MailCheckrClient);
});
