# Automated Security Scan Report
**Target:** `/Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp`
**Scanned at:** 2026-04-02T09:29:00+07:00
**Tools run:** Gitleaks, Trivy, TruffleHog, npm audit
**Tools skipped:** Bandit (no .py files), Semgrep (OOM killed during scan), CodeQL (no .github/workflows/), mcps-audit (no MCP skill/tool files found)

---

## Pre-flight Summary

| Tool | Status | Version / Note |
|------|--------|----------------|
| Gitleaks   | OK      | 8.30.1 |
| Bandit     | SKIPPED | No .py files in target |
| Semgrep    | SKIPPED | OOM / killed (exit 137) |
| Trivy      | OK      | 0.69.3 |
| TruffleHog | OK      | 3.94.1 |
| CodeQL     | N/A     | No .github/workflows/ directory |
| mcps-audit | N/A     | No MCP skill/tool files found |

---

## Gitleaks — Secret Detection in Git History

**Summary:** 7 findings — all false positives (placeholder/example values in documentation)

```
Finding:     componentKey: "abc123def456"  // Component key f...
Secret:      abc123def456
RuleID:      generic-api-key
Entropy:     3.584963
File:        docs/tools.md
Line:        1160
Commit:      ae19af8aa7e9452aa83a4a5bf25773708c33d762
Author:      Terrance Pitre
Date:        2026-03-18

Finding:     componentKey: "abc123def456"
File:        docs/tools.md, Line: 1184  (same commit)

Finding:     componentKey: "abc123def456"  // Component key f...
File:        docs/TOOLS.md, Line: 874
Commit:      415ba542916162fcf4e94681f59d3da4309a1afb
Date:        2026-01-20

Finding:     componentKey: "abc123def456"
File:        docs/TOOLS.md, Line: 898  (same commit)

Finding:     "fileKey": "my83n4o9LOGs74oAoguFcGS"
File:        docs/TROUBLESHOOTING-MISSING-DESCRIPTIONS.md, Line: 186
Commit:      27970329266b16e4148b123fd63ebb472c03f101
Date:        2025-11-08

Finding:     const fileKey = 'my83n4o9LOGs74oAoguFcGS'; // Altitude Design...
File:        docs/DOM_BASED_VARIABLE_EXTRACTION_FEASIBILITY.md, Line: 808
Commits:     d7a649e12862842afeb6290e4f87245798cb6d96, b05ad1f833b28507dcc9ec4ebd72dd48e46935a6
```

**Assessment:** All 7 findings are in documentation files.
- `abc123def456` — generic placeholder in tool usage examples
- `my83n4o9LOGs74oAoguFcGS` — appears to be a public Figma file key ("Altitude Design") used as a documentation example. Figma file keys are public identifiers, not secrets.

**Action required:** None. These are false positives.

---

## Trivy — Dependency Vulnerabilities & Secrets

**Summary:** 2 npm vulnerabilities (1 HIGH, 1 MEDIUM) — FIXED via override. 1 CRITICAL secret in local .env (gitignored, not in repo).

```
package-lock.json (npm)
=======================
Total: 2 (UNKNOWN: 0, LOW: 0, MEDIUM: 1, HIGH: 1, CRITICAL: 0)

Library  | Vulnerability   | Severity | Status | Installed | Fixed
---------|-----------------|----------|--------|-----------|-------
lodash   | CVE-2026-4800   | HIGH     | fixed  | 4.17.23   | 4.18.0
lodash   | CVE-2026-2950   | MEDIUM   | fixed  | 4.17.23   | 4.18.0

Dependency chain: figma-console-mcp → agents@0.7.1 → json-schema-to-typescript@15.0.4 → lodash@4.17.23

.env (secrets)
==============
CRITICAL: NPM access token found at .env:1 — GITIGNORED, not in repository
```

### Fix Applied

Added `"lodash": ">=4.18.0"` to `package.json` overrides.

Re-audit result: **0 vulnerabilities** ✅

```json
"overrides": {
  "lodash": ">=4.18.0"
}
```

---

## TruffleHog — Live-Verified Secrets in Git History

**Summary:** 0 verified secrets, 0 unverified secrets

```
2026-04-02T09:29:21+07:00  info  trufflehog  finished scanning
chunks: 5013, bytes: 7166153
verified_secrets: 0, unverified_secrets: 0
scan_duration: 2.592837s
```

No live-verified credentials found. ✅

---

## npm audit — Direct Vulnerability Check

**Pre-fix:**
```
lodash  <=4.17.23
Severity: high
lodash vulnerable to Code Injection via `_.template` imports key names
lodash vulnerable to Prototype Pollution via array path bypass in `_.unset` and `_.omit`
1 high severity vulnerability
```

**Post-fix:**
```
found 0 vulnerabilities ✅
```

---

## Cross-Tool Observations

- Both Trivy and npm audit identified the `lodash` HIGH vulnerability — high-confidence signal, now fixed.
- TruffleHog live-verification found 0 verified secrets, confirming Gitleaks findings are false positives.

---

## Coverage Gaps

| Category | Gap |
|----------|-----|
| SAST (TypeScript/JS) | Semgrep was killed (OOM). Manual code review of `src/core/websocket-server.ts`, `src/local.ts`, and `src/core/figma-api.ts` recommended for new connection health protocol code. |
| Runtime behavior | Not covered by static analysis |
| Business logic / IDOR | Not covered by any tool |
| CodeQL deep semantic | No GitHub Actions workflow in this repo fork |

---

## Final Gate Assessment

| Finding | Severity | Status |
|---------|----------|--------|
| lodash HIGH (CVE-2026-4800) | HIGH | ✅ FIXED via override |
| lodash MEDIUM (CVE-2026-2950) | MEDIUM | ✅ FIXED via override |
| Gitleaks — 7 generic-api-key | INFO | ✅ False positives (docs only) |
| .env NPM token | CRITICAL (local only) | ✅ Gitignored — not in repo |

**SECURITY_GATE: pass** — 0 unfixed vulnerabilities after applying lodash override.
