# MailCheckr for Node.js

Server-side Node.js client for the [MailCheckr API](https://mailcheckr.app/docs). Requires Node.js 18 or newer. Supports CommonJS and ES modules, with TypeScript declarations and no runtime dependencies.

## Install

```sh
npm install @deedotman/mailcheckr
```

Set `MAILCHECKR_API_KEY` on your server. Keep the API key out of browser code.

## Verify an email

```js
import { MailCheckrClient } from '@deedotman/mailcheckr';

const client = new MailCheckrClient();
const result = await client.verify('person@example.com', 'verify-user-123');

if (result.isPending()) {
  // Persist result.id() and poll later, or handle a webhook.
  const latest = await client.find(result.id());
  console.log(latest.state(), latest.status());
}

if (result.isDeliverable()) {
  // A completed verification marked this address deliverable.
}
```

Provide a stable idempotency key for each verification and reuse it when retrying the same email. A key reused with a different email receives HTTP 409. `verify()` accepts both HTTP 200 completed results and HTTP 202 pending results. Pending states are `queued`, `processing`, and `retry_scheduled`. Completed statuses are `deliverable`, `undeliverable`, `risky`, and `unknown`; only a completed `deliverable` result passes `isDeliverable()`.

You can configure the client with `{ apiKey, baseUrl, timeout, fetch }`. The default base URL is `https://mailcheckr.app/api/v1`; `timeout` is in milliseconds and defaults to 30000. API failures throw `MailCheckrError` with `status` and `response` properties. Network and timeout errors come from `fetch`.

CommonJS works too:

```js
const { MailCheckrClient } = require('@deedotman/mailcheckr');
```

## Verify webhooks

Use the exact raw request body, before JSON parsing. The verifier checks the HMAC SHA-256 signature and rejects timestamps outside the default five-minute window.

```js
import { WebhookVerifier } from '@deedotman/mailcheckr';

const verifier = new WebhookVerifier(process.env.MAILCHECKR_WEBHOOK_SECRET);
const rawBody = Buffer.from(await request.arrayBuffer());

if (!verifier.verify(rawBody, request.headers)) {
  return new Response('Invalid signature', { status: 401 });
}

const event = JSON.parse(rawBody.toString('utf8'));
// Persist and deduplicate event.id before applying effects.
```

`verifyPayload(rawBody, timestamp, signature)` is also available. A custom tolerance in seconds can be set with `new WebhookVerifier(secret, { tolerance: 300 })`.

## Development

```sh
npm test
```

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the setup and pull request guidelines.

Report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

MIT
