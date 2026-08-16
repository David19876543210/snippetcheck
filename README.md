# snippetcheck

A pnpm workspace with two packages:

- **[`packages/cli`](packages/cli/README.md)** — the `snippetcheck` CLI. Finds
  broken TypeScript code samples in documentation by type-checking them against
  the real published package. See its README for the full pitch, usage, flags,
  and a real example run against a live docs site.
- **`apps/web`** — the landing page at [snippetcheck.dev](https://snippetcheck.dev),
  which collects report requests: hand over a docs URL and an email, get back a real
  report run by hand against your published docs.

## Development

```sh
pnpm install
pnpm build
pnpm test
```

Per-package scripts:

```sh
pnpm dev:cli   # run the CLI against local source with tsx
pnpm dev:web   # run the Next.js dev server
```

## Repo layout

```
packages/
  cli/     published to npm as `snippetcheck`
apps/
  web/     deployed to Vercel
```

## License

MIT
