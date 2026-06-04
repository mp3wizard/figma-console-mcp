# Automated Security Scan Report
**Target:** `/Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp`
**Scanned at:** 2026-06-04T03:15:38Z
**Git HEAD:** 55e8b33 (pre-merge, upstream at c89fb0b)
**Standard:** OWASP APTS-aligned
**Pipeline Run:** figma-console-mcp daily sync — v1.30.0 upstream commits

---

## Scope Record

```
Scan target: /Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp
Git HEAD:    55e8b33
Include:     all supported
Exclude:     .gitignore honored by each tool
```

---

## Coverage Disclosure

| Tool | Status | Version | Notes |
|------|--------|---------|-------|
| Gitleaks | OK | 8.30.1 | 18 findings — all false positives |
| Semgrep OWASP | OK | 1.157.0 | 0 findings |
| Semgrep TypeScript | OK | 1.157.0 | 0 findings |
| Semgrep Secrets | OK | 1.157.0 | 0 findings |
| Trivy | OK | 0.69.3 | 28 dep vulns pre-fix → 0 post-fix; 1 .env secret (expected) |
| TruffleHog | OK | 3.94.2 | 0 verified, 0 unverified |
| CodeQL | SKIPPED | — | No .github/workflows/codeql.yml |
| mcps-audit | OK | 1.0.0 | 318 findings — all Figma bridge false positives |
| OSV-Scanner | OK | 2.3.5 | No issues found (685 packages) |
| security-audit | OK | bundled | 37 findings — user-config scope, out-of-project |
| skill-security-auditor | OK | bundled | thesvg SKILL.md: score 35/100 Medium |
| mcp-exfil-scan | OK | bundled | 11 findings — all global ~/.claude skills, not project |
| mcp-scan | OPT-IN | — | Not invoked |
| Bandit | N/A | 1.9.4 | No .py source files |

---

## Gitleaks — Secrets in Git History

**Summary: 18 findings — all confirmed false positives**

All 18 are `generic-api-key` rule triggered by:
- Figma component keys (40-char hex hashes) in docs/tools.md, docs/TOOLS.md — documentation examples
- File key `my83n4o9LOGs74oAoguFcGS` in troubleshooting docs — Altitude Design System public example
- Security review report (security-review-2026-04-02.md) — prior FP catalogue

No real secrets detected.

---

## Semgrep — SAST (OWASP + TypeScript + Secrets)

**Summary: 0 findings across all three rule packs**

- OWASP Top 10: 77 rules × 91 files → 0 findings
- TypeScript: 74 rules × 90 files → 0 findings
- Secrets: 42 rules × 161 files → 0 findings

---

## Trivy — Dependencies + Secrets

**Pre-fix: 28 vulns (9 HIGH, 18 MEDIUM). Post-fix: 0 vulns.**

### Fixes Applied

New overrides added to package.json:
- `"miniflare": ">=4.20260519.0"` — fixes HIGH via wrangler transitive chain
- `"express-rate-limit": ">=8.5.1"` — fixes MODERATE via @modelcontextprotocol/sdk

devDependencies bumped:
- `"wrangler": "^4.75.0"` (was `^4.42.0`) — direct devDep, range 4.36.0-4.74.0 was HIGH

Pre-existing overrides confirmed effective: handlebars, basic-ftp, fast-uri, lodash, path-to-regexp, picomatch, undici, ip-address, brace-expansion, hono, @hono/node-server, postcss, qs, ws

**Post-fix npm audit: 0 vulnerabilities** ✅

### .env Secret (CRITICAL — Expected)

`.env:1 — NPM_TOKEN=[REDACTED]`

Local credentials file, gitignored, used by the publish pipeline. Not a security issue.

---

## TruffleHog — Live-Verified Secrets

**0 verified secrets, 0 unverified secrets** across 6668 chunks (8.9 MB) ✅

---

## mcps-audit — OWASP MCP Top 10

**318 findings — all false positives for this architecture**

All CRITICAL/HIGH findings originate from `figma-desktop-bridge/code.js`. This file is the Figma plugin bridge and intentionally executes JavaScript inside Figma's sandboxed plugin environment. The dynamic code execution is how Figma plugins work — the sandbox is Figma's own security boundary, not Node.js.

OWASP flags (MCP-01, MCP-03, MCP-04) are expected for this architecture. Risk score 100/100 is inflated.

---

## OSV-Scanner — Software Composition Analysis

**No issues found across 685 packages** ✅

---

## security-audit — Claude Config

**37 findings — all out-of-scope or scanner false positives**

Findings from global ~/.claude/settings.json (cc-beeper localhost hooks, broad hook matchers — legitimate) and scanner scripts containing detection-pattern keywords. None relate to figma-console-mcp source code.

---

## skill-security-auditor — thesvg SKILL.md

**Score: 35/100 — Medium Risk**

10 URLs to thesvg.org/cdn.jsdelivr.net (the official icon registry), 1 file operation, 0 credential access, 0 dangerous patterns. APPROVE WITH CAUTION.

---

## mcp-exfil-scan — Exfiltration Analysis

**11 findings — all from global ~/.claude skills, none from project**

Scanner picked up global ~/.claude skills (security-scanner, skill-security-auditor, atlas-cloud) via the .agents/skills/ discovery path. No project-level exfiltration vectors found.

---

## Cross-Tool Observations

1. **Gitleaks + TruffleHog both confirm**: no real secrets. 18 Gitleaks FPs are documentation examples.
2. **Trivy + npm audit post-fix both show 0**: override framework effective; 3 new entries needed.
3. **mcps-audit + mcp-exfil both elevated**: consistent — Figma plugin bridge pattern triggers both; known FP.
4. **security-audit + mcp-exfil scope bleed**: both scanned global ~/.claude beyond project scope.

---

## Coverage Gaps

- Business logic and IDOR not covered (static analysis only)
- Figma plugin WebSocket bridge runtime behavior not tested
- mcp-scan not run (requires opt-in)
- CodeQL not available (no GH Actions in fork)

---

## Security Gate

**SECURITY_GATE = `pass`** ✅

| Dimension | Result |
|-----------|--------|
| Secrets (Gitleaks/TruffleHog) | 0 real secrets |
| SAST (Semgrep OWASP) | 0 findings |
| npm vulnerabilities (post-fix) | 0 |
| OSV database | 0 issues |
| .env local secret | Expected (gitignored) |

---

## APTS Audit Log

- **Log:** `/tmp/css-scan-20260604T022535Z.jsonl`
- **Tool runs recorded:** 12
- **Standard:** OWASP APTS § Auditability
