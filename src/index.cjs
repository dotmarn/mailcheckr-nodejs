'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');

class MailCheckrError extends Error {
  constructor(status, response) {
    super(typeof response?.message === 'string' ? response.message :
      typeof response?.code === 'string' ? response.code : 'MailCheckr request failed.');
    this.name = 'MailCheckrError';
    this.status = status;
    this.response = response;
  }
}

class VerificationResult {
  constructor(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
      typeof data.id !== 'string' || !data.id || typeof data.state !== 'string' || !data.state) {
      throw new TypeError('A verification result requires an ID and state.');
    }
    this.data = data;
  }

  id() { return this.data.id; }
  state() { return this.data.state; }
  status() { return typeof this.data.status === 'string' ? this.data.status : null; }
  isCompleted() { return this.state() === 'completed'; }
  isPending() { return ['queued', 'processing', 'retry_scheduled'].includes(this.state()); }
  isFailed() { return this.state() === 'failed'; }
  isDeliverable() { return this.isCompleted() && this.status() === 'deliverable'; }
  isUndeliverable() { return this.isCompleted() && this.status() === 'undeliverable'; }
  isRisky() { return this.isCompleted() && this.status() === 'risky'; }
  isUnknown() { return this.isCompleted() && this.status() === 'unknown'; }
  toJSON() { return this.data; }
}

class MailCheckrClient {
  constructor({ apiKey = process.env.MAILCHECKR_API_KEY, baseUrl = 'https://mailcheckr.app/api/v1', timeout = 30000, fetch: fetchImpl = globalThis.fetch } = {}) {
    if (typeof baseUrl !== 'string' || !/^https?:\/\//i.test(baseUrl)) throw new TypeError('baseUrl must be an HTTP(S) URL.');
    if (!Number.isFinite(timeout) || timeout <= 0) throw new TypeError('timeout must be a positive number of milliseconds.');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetch must be a function.');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeout = timeout;
    this.fetch = fetchImpl;
  }

  verify(email, idempotencyKey) {
    if (typeof email !== 'string' || !email.trim() || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      throw new TypeError('Email and idempotency key are required.');
    }
    return this.request('POST', 'verifications', { email }, idempotencyKey);
  }

  find(id) {
    if (typeof id !== 'string' || !id || id.includes('/') || id.includes('?') || id.includes('#')) {
      throw new TypeError('A valid verification ID is required.');
    }
    return this.request('GET', `verifications/${encodeURIComponent(id)}`);
  }

  async request(method, path, body, idempotencyKey) {
    if (typeof this.apiKey !== 'string' || !this.apiKey) throw new Error('Configure MAILCHECKR_API_KEY before making requests.');
    const headers = { Accept: 'application/json', Authorization: `Bearer ${this.apiKey}` };
    if (body) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const response = await this.fetch(`${this.baseUrl}/${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });
    let json;
    try { json = await response.json(); } catch { json = null; }
    if (!response.ok) throw new MailCheckrError(response.status, json && typeof json === 'object' && !Array.isArray(json) ? json : {});
    if (!json || typeof json !== 'object' || !json.data || typeof json.data !== 'object' || Array.isArray(json.data)) {
      throw new Error('MailCheckr returned an unexpected response.');
    }
    return new VerificationResult(json.data);
  }
}

class WebhookVerifier {
  constructor(secret = process.env.MAILCHECKR_WEBHOOK_SECRET, { tolerance = 300 } = {}) {
    if (!Number.isFinite(tolerance) || tolerance < 0) throw new TypeError('tolerance must be a nonnegative number of seconds.');
    this.secret = secret;
    this.tolerance = tolerance;
  }

  verifyPayload(body, timestamp, signature) {
    if (typeof this.secret !== 'string' || !this.secret ||
      !(typeof body === 'string' || Buffer.isBuffer(body)) ||
      typeof timestamp !== 'string' || !/^\d+$/.test(timestamp) ||
      typeof signature !== 'string' || !/^v1=[a-f0-9]{64}$/i.test(signature)) return false;
    const seconds = Number(timestamp);
    if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > this.tolerance) return false;
    const expected = createHmac('sha256', this.secret).update(timestamp + '.').update(body).digest();
    const actual = Buffer.from(signature.slice(3), 'hex');
    return timingSafeEqual(expected, actual);
  }

  verify(body, headers) {
    const get = (name) => typeof headers?.get === 'function' ? headers.get(name) :
      Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
    return this.verifyPayload(body, get('X-MailCheckr-Timestamp'), get('X-MailCheckr-Signature'));
  }
}

module.exports = { MailCheckrClient, VerificationResult, MailCheckrError, WebhookVerifier };
