<p align="center">
  <img src="./public/icons/logo.svg" alt="InboxFly" width="320">
</p>

<p align="center"><strong>Self-hosted email forwarding manager for Cloudflare Email Routing.</strong></p>

InboxFly gives Cloudflare's free Email Routing the management layer it never had — routing rules that mirror Cloudflare's own UI, full mail copies with attachments, search, advanced filtering, and per-rule delivery stats. Everything runs inside **your own Cloudflare account** on the free tier: no servers, no third-party mail processing, no data leaving your control.

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/xusteve/inboxfly.email"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"></a>
</p>

> **Demo panel:** [panel.inboxfly.email](https://panel.inboxfly.email) · **Website:** [inboxfly.email](https://inboxfly.email)

---

## Why InboxFly?

Cloudflare Email Routing forwards mail for free, but offers no real management surface. InboxFly fills that gap:

- **CF-native rule engine** — exact addresses and domain wildcards with a catch-all fallback, evaluated first-match-wins, styled after Cloudflare's own rule page.
- **Full mail archive** — HTML body, raw MIME, and attachments stored in your own R2 bucket, searchable and downloadable anytime.
- **Advanced filtering** — sender blacklists, subject regex, size caps, attachment rules, and a bounce (SMTP reject) action Cloudflare doesn't natively provide.
- **Delivery stats** — forwarded / blocked / dropped / bounced / errors, per rule and per domain, with 14-day trends.
- **10 languages, 3 themes × light/dark** — follow-your-system theming with no-flash initialization.
- **Privacy by design** — tracking pixels blocked by default, sandboxed HTML rendering, PBKDF2-hashed credentials, CSRF protection, optional Cloudflare Turnstile on sign-in.
- **Zero trust in us** — mail flows through Cloudflare Email Routing directly into a Worker in *your* account. Revoke the API token and the pipeline keeps running.

## Features

| Capability | Detail |
|---|---|
| 📬 Real mail pipeline | Parse → rule match → filter → forward (in-event) → store (non-blocking) → stats. Fail-open: never silently drops mail. |
| 🧭 Routing rules | Exact + catch-all, per-rule action (forward / drop / bounce), reorderable, with per-rule volume |
| 📎 Full copies | HTML, raw `.eml`, attachments on R2 — 30-day auto-cleanup (configurable) |
| 🔍 Search & batch | Full-text search, multi-select delete |
| 🌐 Domain discovery | Sync all your Cloudflare zones (manual button + every-6h cron), one-click "Enable forwarding": MX-conflict check → enable Email Routing → add recommended DNS → point catch-all at the Worker |
| 🔁 Native rule import | Detect existing CF routing rules and import them as InboxFly rules (prevents mail bypassing the panel) |
| 🛡️ Security | PBKDF2 + HMAC sessions, CSRF, sandboxed HTML (server-side sanitize + iframe sandbox + CSP), login rate limiting, optional Turnstile |
| 🎨 UX | 10 languages · 3 themes × light/dark · sidebar/header layouts · PWA installable · mobile drawer nav |

## Quick start (local, 3 minutes)

```bash
npm install
npm run dev          # starts wrangler dev with local D1/R2/KV
```

Open **http://localhost:8788** and complete the 5-step first-run wizard:

1. **SETUP_TOKEN** — local default is `inboxfly-local-setup` (defined in `.dev.vars`).
2. **Admin credentials** — username + password (≥ 8 chars).
3. **Enable Email Routing** — skip locally (no real mail); you can inject test mail from the panel later.
4. **Destination address** — enter any mailbox and mark it verified.
5. **First rule** — the default template `*@<domain> → forward → verified destination`.

Then hit **"Simulate mail"** in the panel — it runs the exact production pipeline (match → filter → decide → store → stats), skipping only real delivery. Test the mail list, detail view, sandboxed HTML rendering, attachment download, stats, rule CRUD, themes, and more.

## Deploy to Cloudflare (production)

```bash
npx wrangler login
npx wrangler deploy
```

Then, once:

1. **Set the secret:** `npx wrangler secret put SETUP_TOKEN` — required by the first-run wizard, invalidated after setup completes.
2. **Create D1 tables (safety net):** `npx wrangler d1 execute inboxfly --remote --file schema.sql` — tables also auto-create on first visit.
3. **Enable Email Routing per domain:** Cloudflare Dashboard → your domain → Email → Email Routing → Enable (confirm MX switch) → Catch-all → *Send to a Worker* → select `inboxfly`.
4. **Verify a destination address:** Dashboard → Email Routing → Destination addresses → add and click the confirmation email (`forward()` only delivers to verified addresses).
5. **Open your Worker URL** and complete the wizard.

### Recommended: configure a CF API Token (optional, unlocks automation)

Save a token in **Settings → Domains** (or during the wizard) to enable:

- **Domain sync** — pull all your hosted zones and their Email Routing status (manual refresh button in the nav, plus an automatic sync every 6 hours via Cron Trigger).
- **One-click "Enable forwarding"** — MX conflict detection with explicit confirm, enables Email Routing, adds the recommended MX/SPF DNS, and points catch-all at the Worker.
- **Destination auto-verification** — add addresses via the CF API; status flips to verified when the recipient clicks the confirmation link.
- **Native rule import** — detect and migrate existing CF routing rules.

> ⚠️ **Token permissions (tested):** the Email Routing enable/status endpoints require **Zone → Zone Settings → Edit**, *not* "Email Routing Rules" — the latter only covers rule-list management. Create the token with both, or the panel's "Enable forwarding" will fail with `Authentication error`.

## Architecture

| Module | Path | Role |
|---|---|---|
| Email Worker | `src/email.js` | Real inbound pipeline: parse → rule match → filter → forward → store → stats; fail-open fallback |
| Pipeline core | `src/pipeline.js` | Rule engine (exact > catchall, first-match-wins), filters (blacklist / regex / size / whitelist / attachments), R2 key layout, stats upsert, local simulation |
| Management API | `src/index.js` | Hono: wizard / sessions (PBKDF2 + HMAC cookie + CSRF + KV rate-limit) / destinations / rules / mail / stats / config / CF API automation |
| HTML sanitizer | `src/sanitize.js` | Server-side stripping (dangerous tags, event attributes, `javascript:`), remote images blocked by default, `cid:` rewriting; client adds iframe sandbox + CSP |
| CF API client | `src/cfapi.js` | Zone discovery, Email Routing status/enable, recommended DNS, catch-all → Worker, native rules, destination addresses |
| Panel (SPA) | `public/` | Build-free SPA: 10 languages, 3 themes × light/dark, wizard, mail / rules / destinations / stats / settings |
| Schema | `schema.sql` + `src/schema.js` | Auto-created on first access — no manual DB step required |

## Known limitations

- **Email Routing exists only in Cloudflare's production environment.** Locally, use the "Simulate mail" button which runs the identical pipeline.
- **Destination verification can't be automated end-to-end** — the recipient must click Cloudflare's confirmation email once (any deployment).
- **Stats accuracy** — "forwarded" means Cloudflare accepted the forward; final mailbox placement (e.g. recipient's spam folder) isn't observable by any forwarding service.
- **Session secret** is stored in D1 `app_config` (a runtime-generated secret isn't possible at deploy time); rotating it signs out all sessions.
- **Service Worker caching** — static assets use stale-while-revalidate; refresh twice after deploying a new version to get the latest panel.

## License

[MIT](./LICENSE)

## Related

- Project documentation & design notes: `InboxFly-Open.md` (design spec) · `TESTING.md` (test plan)
- Website: [inboxfly.email](https://inboxfly.email) · Demo panel: [panel.inboxfly.email](https://panel.inboxfly.email)
- Contact: [support@inboxfly.email](mailto:support@inboxfly.email)
