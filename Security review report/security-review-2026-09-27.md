# Security review — 2026-09-27

Target: upstream origin/main @ 584b387 (Release v1.40.6 — extended collections + component-doc fidelity round 3).

## Scan
| Tool | Result |
|------|--------|
| semgrep (owasp-top-ten, typescript, secrets; src/) | 0 findings, 107 files |
| gitleaks (history, 613 commits) | 0 with repo .gitleaksignore |
| osv-scanner / npm audit (upstream lockfile) | 24 vulns: 15 high, 4 moderate, 5 low |

Not run: trivy, trufflehog, CodeQL, MCP/skill audits (source diff is server-only TS).

## Fixes applied
- Direct deps: wrangler ^4.142.0, @cloudflare/puppeteer ^1.4.0, ws ^8.22.0.
- Overrides for vulnerable transitives: undici, sharp, js-yaml, nanoid, postcss, @puppeteer/browsers 3.x (drops extract-zip), fast-uri, ip-address, browserslist, hono, @hono/node-server, qs, baseline-browser-mapping, ai@6 / @ai-sdk/provider-utils, body-parser.
- After merge into the fork (fork overrides kept, wrangler bumped): npm audit 0 vulnerabilities.
- Verified: build:local, build:cloudflare, build:apps, wrangler deploy --dry-run pass; 1669/1669 tests pass.

SECURITY_GATE = pass. Merged to main (f6c632b) and released as 1.40.7.
