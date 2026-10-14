# Contributing to MailCheckr for Node.js

Bug reports, documentation improvements, tests, and code contributions are welcome.

## Report an issue

Search existing issues first. For a bug, include the package and Node.js versions, expected and actual behavior, and a small reproduction. Remove API keys, webhook secrets, and real customer data from examples. For a larger feature or API change, open an issue to discuss the proposed behavior before investing in an implementation.

For suspected security vulnerabilities, follow [SECURITY.md](SECURITY.md). Do not include exploit details or secrets in a public issue.

## Set up locally

Use Node.js 18 or newer. Clone the repository, then run:

```sh
npm test
```

The package has no runtime dependencies. Tests use Node.js's built-in test runner and mocked `fetch`; they should not need a MailCheckr account, a live API key, or network access.

## Make a change

1. Create a branch and keep the change focused.
2. Update tests for changed behavior. Cover both completed and pending verification responses when relevant, and use exact raw request bytes for webhook tests.
3. Update `README.md` and `src/index.d.ts` when the public API changes. Keep CommonJS and ES module exports aligned.
4. Run `npm test` and `npm pack --dry-run` before submitting a pull request.
5. Explain what changed, why, and how you tested it in the pull request.

Never commit API keys, webhook signing secrets, or real customer email addresses. Preserve the API's idempotency and result-state semantics; pending or unknown results must not be treated as deliverable.

Contributions are licensed under the repository's [MIT License](LICENSE).
