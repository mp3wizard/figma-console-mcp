# Automated Security Scan Report

**Target:** `/Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp`
**Scanned at:** 2026-03-31T08:41:00+07:00
**Tools run:** Gitleaks, Trivy, TruffleHog
**Tools skipped:** Bandit (no Python files), Semgrep (OOM/killed), CodeQL (no workflow configured)

---

## Pre-flight Summary

| Tool       | Status  | Version / Note                             |
| ---------- | ------- | ------------------------------------------ |
| Gitleaks   | OK      | 8.30.1                                     |
| Bandit     | SKIPPED | No Python files found                      |
| Semgrep    | ERROR   | Killed (OOM/SIGKILL) during scan           |
| Trivy      | OK      | 0.69.3                                     |
| TruffleHog | OK      | 3.94.1                                     |
| CodeQL     | N/A     | No .github/workflows/codeql.yml configured |
| mcps-audit | SKIPPED | No MCP config files found                  |

---

## Gitleaks — Secret Pre-check

**Summary:** 7 findings across 3 files — all appear to be **documentation example/placeholder values**, not real credentials.

> ⚠️ **CONFIDENTIAL** — Secret values redacted below.

```
Finding:     componentKey: "[REDACTED]"  // Component key f...
RuleID:      generic-api-key
File:        docs/tools.md
Lines:       1160, 1184
Commit:      ae19af8aa7e9452aa83a4a5bf25773708c33d762
Author:      Terrance Pitre
Date:        2026-03-18

Finding:     componentKey: "[REDACTED]"
RuleID:      generic-api-key
File:        docs/TOOLS.md
Lines:       874, 898
Commit:      415ba542916162fcf4e94681f59d3da4309a1afb
Author:      Terrance Pitre
Date:        2026-01-20

Finding:     "fileKey": "[REDACTED]"   // Altitude Design System example
RuleID:      generic-api-key
File:        docs/TROUBLESHOOTING-MISSING-DESCRIPTIONS.md
Line:        186
Commit:      27970329266b16e4148b123fd63ebb472c03f101
Author:      TJ Pitre
Date:        2025-11-08

Finding:     const fileKey = '[REDACTED]'; // Altitude Design...
RuleID:      generic-api-key
File:        docs/DOM_BASED_VARIABLE_EXTRACTION_FEASIBILITY.md
Line:        808
Commits:     d7a649e12862842afeb6290e4f87245798cb6d96 (2025-11-07)
             b05ad1f833b28507dcc9ec4ebd72dd48e46535a6 (2025-10-07)

393 commits scanned. ~6.97 MB in 2.1s
leaks found: 7
```

**Assessment:** All 7 findings are documentation example values (`abc123def456` placeholder and a Figma file key used in troubleshooting docs). TruffleHog confirmed 0 live-verified secrets in git history.

---

## Bandit — Python SAST

**Summary:** Skipped — no Python files found in target directory.

---

## Semgrep — OWASP + Python Rules

**Summary:** Tool exited with error (SIGKILL / OOM — exit code 137). No findings produced.

**Coverage gap:** OWASP Top 10 TypeScript/JS rules not evaluated. Manual review recommended for injection, XSS, and insecure deserialization patterns.

---

## Trivy — Dependencies & Misconfigurations

**Summary:** 4 vulnerabilities (0 critical, 2 high, 2 medium) in `package-lock.json`; 1 critical secret finding in `.env` (false positive — gitignored token file).

```
package-lock.json (npm)
=======================
Total: 4 (UNKNOWN: 0, LOW: 0, MEDIUM: 2, HIGH: 2, CRITICAL: 0)

Library         | CVE              | Severity | Status | Installed | Fixed     | Description
----------------|------------------|----------|--------|-----------|-----------|------------------------------------------
path-to-regexp  | CVE-2026-4926    | HIGH     | fixed  | 8.3.0     | 8.4.0     | ReDoS via crafted regular expressions
path-to-regexp  | CVE-2026-4923    | MEDIUM   | fixed  | 8.3.0     | 8.4.0     | Multiple wildcards + params ReDoS
picomatch       | CVE-2026-33671   | HIGH     | fixed  | 4.0.3     | 4.0.4     | ReDoS via crafted extglob patterns
picomatch       | CVE-2026-33672   | MEDIUM   | fixed  | 4.0.3     | 4.0.4     | Data integrity compromise via method injection

.env (secrets)
==============
Total: 1 (CRITICAL: 1)
Finding: NPM access token — .env:1
NOTE: .env is gitignored and NOT tracked in git history. FALSE POSITIVE.
```

**Dependency chain analysis:**
- `path-to-regexp@8.3.0`: transitive via `@modelcontextprotocol/sdk → express → router` (production)
- `path-to-regexp@6.3.0`: transitive via `wrangler` (build tool, Cloudflare mode)
- `picomatch@4.0.3`: transitive via `vite` (devDependency — not shipped in published package)

---

## TruffleHog — Secret Detection

**Summary:** 0 secrets detected (0 verified live, 0 unverified). Clean.

```
scanning repo: file:///Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp
chunks: 4900, bytes: 7,228,675
verified_secrets: 0
unverified_secrets: 0
scan_duration: 2.5s
```

---

## CodeQL — Semantic SAST (GitHub Actions)

**Summary:** Not configured — no `.github/workflows/` directory found.

**Recommendation:** Add `actions/codeql-action` workflow for deep semantic SAST on future PRs.

---

## mcps-audit — MCP Permission Audit

**Summary:** No MCP config files detected. Skipped.

---

## Cross-Tool Observations

- No cross-tool overlaps detected. Gitleaks and Trivy both flagged the `.env` file, but both are false positives (gitignored, not in history, not a real secret leak).

---

## Coverage Gaps

- **Semgrep OWASP rules**: OOM killed — JS/TS injection, XSS, prototype pollution not fully evaluated
- **CodeQL**: Not configured — deep semantic SAST (taint tracking, control flow) not available
- **Business logic flaws**: Not detectable by static tools
- **IDOR / broken object-level authorization**: Requires runtime context
- **Container/image scanning**: N/A (no Dockerfile)
