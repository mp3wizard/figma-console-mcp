# Security Review — 2026-03-19

**Version reviewed:** v1.14.0 (fresh clone from southleft/figma-console-mcp)
**Reviewer:** Claude security-analysis agent + mp3wizard
**Scanned at:** 2026-03-19T13:50:00+07:00
**Status:** ✅ All findings resolved

---

# Automated Security Scan Report

**Target:** `/Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp`
**Scanned at:** 2026-03-19T13:50:13+07:00
**Tools run:** Trivy, TruffleHog, Semgrep (re-run successfully on 2026-03-19)
**Tools skipped:** Bandit (no Python files)

---

## Pre-flight Summary

| Tool       | Status  | Version |
|------------|---------|---------|
| Bandit     | SKIPPED | 1.8.6 — no Python files in target |
| Semgrep    | ✅ OK   | 1.136.0 (pysemgrep via pip) — 0 findings |
| Trivy      | ✅ OK   | 0.69.3 — 0 findings |
| TruffleHog | ✅ OK   | 3.93.8 — 0 secrets |

---

## Bandit — Python SAST

**Summary:** Skipped — no `.py` files found in target codebase (TypeScript/JavaScript project)

```
No Python files found. Bandit scan skipped.
```

---

## Semgrep — TypeScript + OWASP Top 10 + Secrets

**Summary:** ✅ 0 findings across all 3 rulesets

_Tool re-run successfully on 2026-03-19 using pysemgrep 1.136.0 (installed via pip after resolving Gatekeeper/attrs dependency issue)._

```
Ruleset: p/typescript
  Rules run: 74 | Files scanned: 50 | Findings: 0

Ruleset: p/owasp-top-ten
  Rules run: 100 | Files scanned: 103 | Findings: 0

Ruleset: p/secrets
  Rules run: 42 | Files scanned: 103 | Findings: 0
```

All severity levels (ERROR, WARNING) checked. No injection, XSS, hardcoded secrets, or OWASP Top 10 violations found.

---

## Trivy — Dependencies & Misconfigurations

**Summary:** 0 vulnerabilities, 0 secrets — clean

```
Report Summary

┌───────────────────┬──────┬─────────────────┬─────────┐
│      Target       │ Type │ Vulnerabilities │ Secrets │
├───────────────────┼──────┼─────────────────┼─────────┤
│ package-lock.json │ npm  │        0        │    -    │
└───────────────────┴──────┴─────────────────┴─────────┘
Legend:
- '-': Not scanned
- '0': Clean (no security findings detected)
```

_Note: Trivy DB downloaded successfully via mirror.gcr.io after docker-credential-desktop workaround._

---

## TruffleHog — Secret Detection

**Summary:** 0 secrets detected (0 verified, 0 unverified)

> ⚠️ **CONFIDENTIAL** — This report may contain sensitive findings. Do not share without review.

```
🐷🔑🐷  TruffleHog. Unearth your secrets. 🐷🔑🐷

scanning repo: file:///Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp
finished scanning {
  "chunks": 291,
  "bytes": 2432270,
  "verified_secrets": 0,
  "unverified_secrets": 0,
  "scan_duration": "1.588649458s",
  "trufflehog_version": "3.93.8"
}
```

---

## Cross-Tool Observations

No cross-tool overlaps detected. Trivy and TruffleHog both returned clean.

---

## Coverage Gaps

- **Business logic flaws** — not detectable by static tools
- **IDOR / broken object-level authorization** — requires runtime context
- **Runtime behavior** — static review only; dynamic testing recommended for WebSocket and OAuth flows

---

# Phase 1: Codebase Reconnaissance

| Area | Findings |
|------|---------|
| **Stack** | TypeScript, Node.js 18+, Zod, ws (WebSocket), Cloudflare Workers |
| **Entry points** | `src/local.ts` (local/NPX), `src/index.ts` (Cloudflare) |
| **Auth** | Figma PAT (`FIGMA_ACCESS_TOKEN`), OAuth2 PKCE (cloud mode) |
| **External APIs** | Figma REST API, Cloudflare KV/Durable Objects |
| **Data sensitive paths** | FIGMA_ACCESS_TOKEN in env, OAuth tokens in KV store |
| **Config files** | `wrangler.jsonc` (Cloudflare), `tsconfig*.json`, `.env` not present |
| **IaC** | Cloudflare Workers via wrangler — no Docker/K8s |

---

# Phase 2: Manual Vulnerability Analysis

## SEC-001 — Stack Trace Exposed in Plugin Response

| Field | Value |
|-------|-------|
| **ID** | SEC-001 |
| **Category** | Security Misconfiguration / Information Disclosure |
| **Severity** | 🟠 Medium |
| **Location** | `src/core/figma-desktop-connector.ts:505` |
| **CWE** | CWE-209: Generation of Error Message Containing Sensitive Information |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:** `error.stack` was returned inside a plugin code string executed in Figma's sandbox. Stack traces expose internal file paths and module structure.

**Exploit Scenario:** A malicious Figma plugin or intercepted WebSocket message could trigger an error and read the stack trace to map internal paths, aiding further exploitation.

**Fix applied:**
```typescript
// Before
return { success: false, error: error.message, stack: error.stack };
// After
return { success: false, error: error.message };
```

---

## SEC-002 — No Input Validation on `libraryFileKey`

| Field | Value |
|-------|-------|
| **ID** | SEC-002 |
| **Category** | Injection Flaws / Input Validation |
| **Severity** | 🟠 Medium |
| **Location** | `src/local.ts:3236` and `src/local.ts:3874` |
| **CWE** | CWE-20: Improper Input Validation |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:** `libraryFileKey` accepted any string via Zod schema without format restriction. Value is passed directly to Figma REST API calls. Unexpected characters could cause unintended API behavior.

**Fix applied:**
```typescript
// Before
libraryFileKey: z.string().optional()
// After
libraryFileKey: z.string().regex(/^[a-zA-Z0-9]+$/, "libraryFileKey must be alphanumeric only").optional()
```

---

## SEC-003 — Dependency Vulnerabilities (undici)

| Field | Value |
|-------|-------|
| **ID** | SEC-003 |
| **Category** | Dependency Vulnerabilities |
| **Severity** | 🔴 High |
| **Location** | `package-lock.json` — `undici` 7.x (transitive via wrangler → miniflare) |
| **CVEs** | GHSA-f269-vfmq-vjvj, GHSA-2mjp-6q6p-2qxm, GHSA-vrm6-8vpv-qv8q, GHSA-v9p9-hfj2-hcw8, GHSA-4992-7rv2-5pvq, GHSA-phc3-fgpg-7m6h |
| **Detection** | Manual (`npm audit`) |
| **Status** | ✅ Fixed |

**Fix applied:** `npm audit fix` — updated 7 packages, 0 vulnerabilities remaining.

---

## SEC-004 — Stack Trace in Console Monitor (Accepted Risk)

| Field | Value |
|-------|-------|
| **ID** | SEC-004 |
| **Category** | Logging & Monitoring |
| **Severity** | 🟡 Low |
| **Location** | `src/core/console-monitor.ts:117–118` |
| **CWE** | CWE-209 |
| **Detection** | Manual |
| **Status** | ✅ Accepted — intentional |

**Description:** `error.stack` used to format `callFrames` in the debug console capture pipeline. This is by design — the monitor's purpose is surfacing stack traces. No external transmission occurs.

---

# Section A: Executive Summary

**Overall Risk Posture:** 🟡 **Moderate** (prior to fixes) → ✅ **Minimal** (after fixes)

All 3 actionable findings have been remediated. The codebase handles authentication correctly via environment variables and OAuth PKCE. No hardcoded secrets detected. No injection flaws in critical paths.

**Key Statistics:**
- Total findings: 4 (3 fixed, 1 accepted)
- High: 1 (SEC-003 — dependency CVEs, fixed)
- Medium: 2 (SEC-001, SEC-002 — fixed)
- Low: 1 (SEC-004 — accepted)
- Tool-detected: 0 (Trivy/TruffleHog clean)
- Manual-only: 4

**Immediate Actions Required:** None — all findings resolved.

---

# Remediation Priority List

| ID | Severity | Finding | Effort | Status |
|----|----------|---------|--------|--------|
| SEC-003 | 🔴 High | undici CVEs | Quick (`npm audit fix`) | ✅ Done |
| SEC-001 | 🟠 Medium | error.stack in plugin response | Quick (remove 1 line) | ✅ Done |
| SEC-002 | 🟠 Medium | libraryFileKey no regex | Quick (add `.regex()`) | ✅ Done |
| SEC-004 | 🟡 Low | error.stack in console monitor | N/A — accepted | ✅ Accepted |
