# Automated Security Scan Report
**Target:** `/Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp`  
**Scanned at:** 2026-05-31T02:30:00Z  
**Git HEAD (pre-merge):** `a3c302f`  
**Standard:** OWASP APTS-aligned (Scope Enforcement, Auditability, Manipulation Resistance, Reporting)

---

## Scope Record

```
Scan target: /Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp
Git HEAD:    a3c302f
Include:     all supported
Exclude:     .gitignore honored by each tool
```

---

## Coverage Disclosure (APTS)

| Tool | Status | Version | Files covered | Notes |
|------|--------|---------|---------------|-------|
| Gitleaks | OK | 8.30.1 | 503 commits / 8.4 MB | 18 findings — all false positives |
| Bandit | N/A | 1.9.4 | — | No .py files in project |
| Semgrep OWASP | OK | 1.157.0 | 90 files | 0 findings |
| Semgrep TypeScript | OK | 1.157.0 | 89 files | 0 findings |
| Semgrep Secrets | OK | 1.157.0 | 154 files | 0 findings |
| Trivy | OK | 0.69.3 | package-lock.json + .env | 1 MEDIUM vuln (fixed); .env not in git |
| TruffleHog | OK | 3.94.2 | Full git history | 0 verified, 0 unverified secrets |
| CodeQL | SKIPPED | — | — | No .github/workflows/ with CodeQL |
| mcps-audit | OK | 1.0.0 | 141 files | 317 findings — dominated by anon-function false positives |
| OSV-Scanner | OK | 2.3.5 | 685 packages | 0 issues |
| mcp-scan | OPT-IN | — | — | Not run (sends data to invariantlabs.ai) |
| security-audit | OK | bundled | Global Claude config | 37 findings — all pre-existing config, not project source |
| skill-security-auditor | N/A | bundled | — | No SKILL.md in project |
| mcp-exfil-scan | OK | bundled | Global skills | 11 findings — all global user skills, not project |

---

## Gitleaks — Secrets in Git History

**Summary:** 18 findings, all false positives.

| Snippet | Locations | Assessment |
|---------|-----------|------------|
| `806826503bbd2ab15d0ff77d076a9406a5a83197` | docs/tools.md, tests/library-tools.test.ts | Git SHA hash used as test fixture — not an API key |
| `e69126d1478dc2584bb57b9bf813ce5dcec239fb` | tests/library-tools.test.ts | Git SHA hash — not an API key |
| `abc123def456` | docs/tools.md, docs/TOOLS.md, security-review-2026-04-02.md | Obvious placeholder value |
| `my83n4o9LOGs74oAoguFcGS` | security-review-2026-04-02.md, docs/TROUBLESHOOTING*.md | Public Figma file key for "Altitude Design" sample (documented in prior reviews as a public identifier, not a secret) |

TruffleHog independently confirmed 0 live/verified secrets across full git history.

---

## Semgrep — OWASP / TypeScript / Secrets

**Summary:** 0 findings across all three rule sets.

- OWASP (77 rules, 90 files): 0 findings
- TypeScript (74 rules, 89 files): 0 findings
- Secrets (42 rules, 154 files): 0 findings

---

## Trivy — Dependencies and Secrets

**Summary:** 1 MEDIUM dependency vulnerability (fixed); 1 CRITICAL in local .env (expected, not in git).

### Dependency Vulnerability — Fixed

| Library | CVE | Severity | Was | Now | Status |
|---------|-----|----------|-----|-----|--------|
| ws | CVE-2026-45736 | MEDIUM | 8.19.0 | 8.21.0 | FIXED |

Fix applied to `package.json`:
- `dependencies.ws`: `^8.19.0` changed to `>=8.20.1`
- `overrides.ws`: `>=8.20.1` added (covers transitive deps via @cloudflare/puppeteer and wrangler/miniflare)

Post-fix npm audit: **0 vulnerabilities**

### Secret in .env

NPM access token found in `.env:1` by Trivy (filesystem scan).
- `.env` is listed in `.gitignore`
- `git ls-files .env` returns empty — NOT tracked by git
- This is an expected local deploy credential. No action required.

---

## TruffleHog — Live Secret Verification

6,504 chunks scanned, 8.8 MB, **0 verified secrets, 0 unverified secrets**. Clean.

---

## OSV-Scanner — SCA

685 packages scanned. **No issues found.**

---

## mcps-audit — OWASP MCP Top 10

Risk Score: 100/100. Findings analysis:

317 total findings are dominated by AS-001 "dangerous execution" flags on every JavaScript anonymous function expression in `figma-desktop-bridge/code.js`. This is aggressive pattern matching that fires on all `function()` keywords.

The one true security-relevant finding is the `figma_execute` tool's code runner in `figma-desktop-bridge/code.js` line 252. This is intentional design — the tool wraps user-provided code in an async IIFE and runs it inside Figma's sandboxed plugin context. This is documented in prior security reviews as a known accepted risk for an MCP server whose core feature is programmatic Figma control.

OWASP MCP-01/MCP-03/MCP-04 failures are structural/architectural checks for the bridge pattern — pre-existing, not introduced in this release.

---

## security-audit (Claude Config)

37 findings across global Claude configuration. None in figma-console-mcp project source.

CRITICAL x5: False positives — security scanner scripts flagged for containing detection patterns they are designed to find. Scanner scanning itself.

HIGH x7 (cc-beeper hooks): `curl localhost:19222` — legitimate local notification daemon. Curl to localhost is not external exfiltration. Pre-existing.

HIGH x2 (validate-bash.sh): Documentation example file. Not executable.

MEDIUM x1 (`skipDangerousModePermissionPrompt: true`): Pre-existing user configuration.

---

## mcp-exfil-scan

11 findings across global user skills. None in figma-console-mcp project code.

All findings are in globally installed skills (impeccable, security-audit, security-scanner, skill-security-auditor, atlas-cloud, playwright-cli, pyright, vtsls). CRITICAL findings flag skill descriptions that contain the word "exfiltrate" in their detection documentation — false positives.

---

## Cross-Tool Observations

1. **ws CVE-2026-45736**: Trivy identified it; OSV-Scanner confirms 0 issues after fix. Both consistent on clean post-fix state.
2. **No secrets in git**: Gitleaks (18 false positives), TruffleHog (0 verified), Semgrep secrets (0), and Trivy (.env not tracked) — all consistent.
3. **Code execution in Figma bridge**: Only mcps-audit flagged the intentional Figma plugin code runner; Semgrep OWASP did not (file is outside TypeScript source). Pre-existing, documented, intentional.

---

## Coverage Gaps

- Business logic and authorization flow not covered by static analysis
- Runtime behavior of Figma plugin code runner not tested dynamically
- CodeQL semantic analysis not run (no GitHub Actions workflow)
- mcp-scan not run (opt-in only)

---

## Security Gate

| Finding | Severity | Resolution |
|---------|----------|------------|
| ws CVE-2026-45736 | MEDIUM | Fixed — upgraded to 8.21.0 |
| NPM_TOKEN in .env | CRITICAL (filesystem) | Not in git — expected local config |
| Gitleaks 18 findings | — | All false positives |
| Semgrep OWASP/TS/Secrets | — | 0 findings |
| OSV-Scanner | — | 0 findings |
| TruffleHog | — | 0 verified secrets |

**SECURITY_GATE: `pass`**

Post-fix npm audit: 0 vulnerabilities

---

### APTS Audit Log

- Log: `/tmp/css-scan-20260531T022501Z.jsonl`
- Tool runs recorded: 11
- Standard: OWASP APTS Auditability
