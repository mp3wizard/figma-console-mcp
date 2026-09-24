# Security Review — 2026-09-24

**Target:** origin/main @ 30f974f (upstream v1.40.5, scanned via detached worktree)
**Gate:** `SECURITY_GATE=fail` — merge NOT performed (unattended run, Step 4 requires confirmation)

## Incoming range
1 commit: `30f974f chore: Release v1.40.5 — clean dependency audit` (moves @cloudflare/puppeteer + agents to devDependencies, replaces npm-publish.yml with publish.yml, prunes old security reports, adds tests/published-dependencies.test.ts). No breaking changes.

## Findings
| Tool | Result |
|------|--------|
| gitleaks | 18 `generic-api-key` hits — all in docs/*.md, tests/library-tools.test.ts, old security report (example Figma keys; likely false positives, not verified) |
| trufflehog | 0 verified / 0 unverified secrets |
| npm audit (prod, `--omit=dev`) | 7 vulns (1 low, 3 moderate, **3 high**) — `undici` 7.0.0–7.28.0 (GHSA-8xcm-r25x-g524, 4cwx-7wf7-3272, m8rv-5g2x-5cg5, jr45-8vmc-qm54, v3r7-h72x-cjcm); fix: undici >=7.29.0 |
| npm audit (all) | 24 total: 15 high, 4 moderate, 5 low (also dev `ws` 8.18.0 → 8.21.0, `qs`) |
| osv-scanner / trivy | Same undici/ws/qs CVEs (CVE-2026-13697 high etc.) |
| semgrep | INCOMPLETE — timed out (>250s), no result |
| bandit, codeql, mcps-audit, skill/exfil audits | not run (no Python; unattended time budget) |

## Remediation (not applied)
Add `"overrides": { "undici": ">=7.29.0" }` (plus `ws >=8.21.0`, `qs >=6.16.0` for dev) in package.json, `npm install`, re-audit to 0.
Note: upstream's own v1.40.5 claims "clean audit" but the lockfile still resolves undici 7.28.0 — high prod vulns remain.

## Other notes
- Local main already has commit `cc3d125 chore: bump version to 1.40.5`, colliding with upstream v1.40.5 release; merge likely conflicts in package.json/CHANGELOG. Upstream also deletes `.github/workflows/npm-publish.yml` (the workflow this pipeline's Step 6 relies on) in favor of `publish.yml`.

## Resolution (same day)
- Merged origin/main (`--no-commit`) into local main. Kept local package name `@mp3wizard/figma-console-mcp` and all 26 local `overrides` (incl. `undici >=7.29.0 <8`, `ws >=8.20.1`, `qs >=6.16.0`); took upstream's devDependency move for `@cloudflare/puppeteer`/`agents` and `!dist/cloudflare` exclusion. CHANGELOG: kept both histories.
- Lockfile regenerated from local lock + `npm install`: resolves undici 7.29.1, ws 8.21.0, qs 6.16.0.
- `npm audit`: 0 vulnerabilities (all and `--omit=dev`). Build (`build:local`) OK; `npm test` 61 suites / 1629 tests pass incl. new `published-dependencies.test.ts`.
- gitleaks (working tree): 15 hits are Figma component/file keys in docs/tests/reports (public identifiers, false positive). 1 hit is a real npm token in `.env` — gitignored, never in git history, not in `npm pack` output. Recommend rotating it if exposed elsewhere; CI now uses Trusted Publishing, so the token may no longer be needed.
- semgrep still not completed (timeout) — coverage gap remains.
- SECURITY_GATE: pass (0 dependency vulns). Merged as 561e941; bumped to v1.40.6 (ae03e2c) and published via CI run 35970516635.
