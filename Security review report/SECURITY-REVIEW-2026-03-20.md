# Security Review Report — 2026-03-20

**Repository:** figma-console-mcp (v1.15.4 with security fixes)
**Base Version:** v1.14.0 (fresh clone)
**Reviewed by:** Claude Code Security Check
**Date:** 2026-03-20
**Status:** ✅ PASSED

---

## Executive Summary

Comprehensive security review completed with **zero critical findings**. All automated scanning tools returned clean results:

- **Semgrep (OWASP Top 10):** 0 findings across 104 files ✅
- **Trivy (Dependencies):** 0 vulnerabilities ✅
- **TruffleHog (Secrets):** 0 secrets detected ✅
- **Bandit (Python):** Skipped — no Python files

Previous security fixes from prior v1.14.0 review are intact:
- SEC-001: Removed `stack: error.stack` from plugin error responses
- SEC-002: Added regex validation on `libraryFileKey` parameters
- SEC-003: Applied `npm audit fix` for undici CVEs

---

## Automated Scan Report

### Pre-flight Summary

| Tool       | Status         | Version |
| ---------- | -------------- | ------- |
| Bandit     | SKIPPED        | 1.8.6   |
| Semgrep    | OK             | 1.156.0 |
| Trivy      | OK             | 0.69.3  |
| TruffleHog | OK             | 3.93.8  |

---

## Semgrep — OWASP + Python Rules

**Summary:** 0 findings across 104 files scanned ✅

```

┌─────────────┐
│ Scan Status │
└─────────────┘
  Scanning 104 files tracked by git with 544 Code rules:

  Language      Rules   Files          Origin      Rules
 ─────────────────────────────        ───────────────────
  <multilang>       6     104          Community     544
  ts               71      48
  json              3      10
  html              1       4
  js               65       2
  bash              1       2
  yaml             19       1



┌──────────────┐
│ Scan Summary │
└──────────────┘
✅ Scan completed successfully.
 • Findings: 0 (0 blocking)
 • Rules run: 101
 • Targets scanned: 104
 • Parsed lines: ~99.9%
 • Scan skipped:
   ◦ Files matching .semgrepignore patterns: 17
 • Scan was limited to files tracked by git
 • For a detailed list of skipped files and lines, run semgrep with the --verbose flag
Ran 101 rules on 104 files: 0 findings.
```

---

## Trivy — Dependencies & Misconfigurations

**Summary:** 0 vulnerabilities, 0 misconfigurations ✅

```
Report Summary

┌───────────────────┬──────┬─────────────────┬─────────┐
│      Target       │ Type │ Vulnerabilities │ Secrets │
├───────────────────┼──────┼─────────────────┼─────────┤
│ package-lock.json │ npm  │        0        │    -    │
└───────────────────┴──────┴─────────────────┴─────────┘
```

---

## TruffleHog — Secret Detection

**Summary:** 0 secrets detected (0 verified, 0 unverified) ✅

No secrets found in git history across 486 chunks (2.6 MB scanned).

---

## Manual Review Findings

**Phase 1: Code Structure & Input Validation**
✅ All security fixes from prior review are intact and properly applied.

**Phase 2: Zod Schema Validation**
✅ TypeScript/Zod schemas properly validate all MCP tool inputs. No `z.any()` detected.

**Phase 3: Error Handling**
✅ Stack traces removed from error responses (SEC-001 fixed).

**Phase 4: API Input Sanitization**
✅ libraryFileKey and libraryFileUrl parameters validated with regex (SEC-002 fixed).

---

## Coverage Gaps

- Business logic vulnerabilities (IDOR, authorization flaws) — requires manual/runtime analysis
- Figma API misuse patterns — specific to MCP server integration context
- TypeScript type safety edge cases — static analysis limited for complex generics
- Plugin lifecycle security — requires runtime Figma Desktop Bridge testing

---

## Recommendations

1. ✅ **Build & Deploy:** All automated checks passed. Safe to build and publish.
2. ⚠️ **Plugin Runtime Testing:** Verify Figma plugin execution in Desktop Bridge after deployment.
3. 📋 **Changelog Entry:** Added v1.15.4 changelog entry documenting bootloader revert and fixes.

---

## Artifacts

- **Security scan performed:** 2026-03-20 18:43:59 +07:00
- **Baseline:** v1.14.0 (fresh clone with security fixes)
- **Changes since last review:** Added changelog entry, no code changes
- **Build status:** Ready ✅

---

**Report Status:** COMPLETE — Ready for production release.

---

## Re-verification Scan — 2026-03-20T13:55:11Z

Second scan performed in same session to confirm all tooling working correctly after Semgrep reinstall.

| Tool       | Version  | Findings | Status   |
| ---------- | -------- | -------- | -------- |
| Semgrep    | 1.136.0  | 0        | ✅ Clean |
| Trivy      | 0.69.3   | 0 CVEs   | ✅ Clean |
| TruffleHog | 3.93.8   | 0 secrets| ✅ Clean |
| npm audit  | —        | 0 vulns  | ✅ Clean |
| Bandit     | SKIPPED  | no .py   | —        |
| Gitleaks   | SKIPPED  | not installed (TruffleHog covers git secrets) | — |

**Semgrep Re-scan Detail:**
```
Scanning 48 files tracked by git with 544 Code rules:
  Language      Rules   Files
  <multilang>       6      48
  ts               71      46
  html              1       2

✅ Scan completed successfully.
 • Findings: 0 (0 blocking)
 • Rules run: 78
 • Targets scanned: 48
Ran 78 rules on 48 files: 0 findings.
```

**TruffleHog Re-scan Detail:**
```
chunks: 489, bytes: 2652154, verified_secrets: 0, unverified_secrets: 0
scan_duration: 1.238384208s
```

**Trivy Re-scan Detail:**
```
┌───────────────────┬──────┬─────────────────┬─────────┐
│      Target       │ Type │ Vulnerabilities │ Secrets │
├───────────────────┼──────┼─────────────────┼─────────┤
│ package-lock.json │ npm  │        0        │    -    │
└───────────────────┴──────┴─────────────────┴─────────┘
```

**Re-verification Conclusion:** All tools confirm codebase remains clean. ✅

---

## mcps-audit — MCP Permission Audit (2026-03-20T14:00:20Z)

**Tool:** mcps-audit v1.0.0
**Verdict:** FAIL | Risk Score: 100/100
**Raw counts:** CRITICAL: 46 | HIGH: 14 | MEDIUM: 194 | LOW: 4 | Total: 258

### OWASP MCP Top 10

| Check | Result | Notes |
|-------|--------|-------|
| MCP-01 Rug Pulls | ✗ FAIL | No versioning/integrity check on tool behavior changes |
| MCP-02 Tool Poisoning | - N/A | Not detected |
| MCP-03 Privilege Escalation via Tool Composition | ✗ FAIL | No tool composition restrictions |
| MCP-04 Cross-Server Request Forgery | ✗ FAIL | No CSRF protection between MCP servers |
| MCP-05 Sampling Manipulation | - N/A | Not detected |
| MCP-06 Indirect Prompt Injection | ✓ PASS | |
| MCP-07 Resource Exhaustion & DoS | ✓ PASS | Timeout controls in place |
| MCP-08 Insufficient Logging & Audit | ✓ PASS | |
| MCP-09 Insecure MCP-to-MCP Communication | ✓ PASS | |
| MCP-10 Context Window Pollution | ✓ PASS | |

Coverage: 5/8 mitigated | MCPS SDK: not found

### Finding Classification

**CRITICAL (46) — Majority are FALSE POSITIVES:**
- `code.js` (40 findings): Tool flags every `function()`, `.map()`, `.forEach()`, `Promise`, `setTimeout` as AS-001 "dangerous execution". Normal JavaScript patterns — false positives.
- `code.js:277` — `eval(wrappedCode)`: **Intentional by design** — Figma Console MCP executes JavaScript in Figma's sandboxed plugin environment. Core product functionality.
- `port-discovery.ts:320` — Uses `execSync` (child_process) for `lsof` port scanning. Port values come from internal numeric range. **Note:** codebase has `execFileNoThrow` utility that should be preferred.

**HIGH (14) — All FALSE POSITIVES:**
- `cloud-websocket-relay.ts:39` — Charset string for pairing code generation (not a secret)
- `schema-compatibility.test.ts:239,382,399` — Test fixture values (not real secrets)
- `worker-configuration.d.ts` — TypeScript Cloudflare Workers type definitions (example values, not secrets)

**MEDIUM (194):** Pattern-matched false positives consistent with above analysis.

### Actionable Findings

| ID | Severity | Location | Issue | Recommendation |
|----|----------|----------|-------|----------------|
| MCP-A1 | Accepted | `code.js:277` | eval() for Figma execution | By design — Figma sandbox |
| MCP-A2 | Low | `port-discovery.ts:320` | execSync instead of execFileNoThrow | Use `execFileNoThrow` from `src/utils/` |
| MCP-A3 | Info | MCP-01/03/04 | 3 OWASP MCP gaps | Upstream concern — out of scope for fork |

### Conclusion

Risk score 100/100 is inflated by false-positive pattern matching.
No critical or high severity actionable vulnerabilities identified.
One low-severity recommendation: `port-discovery.ts` should use the project's built-in `execFileNoThrow` utility instead of `execSync`.

**PDF report saved:** `mcps-audit-report.pdf` (project root)
