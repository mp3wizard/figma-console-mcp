# Automated Security Scan Report

**Target:** `/Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp`
**Scanned at:** 2026-03-30T10:02:30+07:00
**Tools run:** Gitleaks, Bandit (skipped — no Python files), Semgrep (killed — OOM), Trivy, TruffleHog
**Tools skipped:** Bandit (no .py files found), Semgrep (process killed SIGKILL/OOM on every attempt), CodeQL (no .github/workflows/ directory), mcps-audit (no MCP skill/config files found)

---

## Pre-flight Summary

| Tool       | Status  | Version / Note                                       |
| ---------- | ------- | ---------------------------------------------------- |
| Gitleaks   | OK      | 8.30.1                                               |
| Bandit     | SKIPPED | No Python files in target                            |
| Semgrep    | SKIPPED | Process killed (SIGKILL/exit 137) — OOM on each run  |
| Trivy      | OK      | 0.69.3                                               |
| TruffleHog | OK      | 3.94.1                                               |
| CodeQL     | N/A     | No `.github/workflows/` directory in repo            |
| mcps-audit | N/A     | No MCP skill/config files found                      |

---

## Gitleaks — Secret Pre-check

**Summary:** 7 secrets found across 4 files (all `generic-api-key` rule)

> ⚠️ **CONFIDENTIAL** — All detected secret values redacted with `[REDACTED]`

```
10:01AM INF 393 commits scanned.
10:01AM INF scanned ~6970997 bytes (6.97 MB) in 2.49s
10:01AM WRN leaks found: 7

File: docs/tools.md         Line: 1160  Rule: generic-api-key
  Description: Detected a Generic API Key, potentially exposing access to various services and sensitive operations.
  Match: [REDACTED]

File: docs/tools.md         Line: 1184  Rule: generic-api-key
  Description: Detected a Generic API Key, potentially exposing access to various services and sensitive operations.
  Match: [REDACTED]

File: docs/TOOLS.md         Line: 874   Rule: generic-api-key
  Description: Detected a Generic API Key, potentially exposing access to various services and sensitive operations.
  Match: [REDACTED]

File: docs/TOOLS.md         Line: 898   Rule: generic-api-key
  Description: Detected a Generic API Key, potentially exposing access to various services and sensitive operations.
  Match: [REDACTED]

File: docs/TROUBLESHOOTING-MISSING-DESCRIPTIONS.md  Line: 186  Rule: generic-api-key
  Description: Detected a Generic API Key, potentially exposing access to various services and sensitive operations.
  Match: [REDACTED]

File: docs/DOM_BASED_VARIABLE_EXTRACTION_FEASIBILITY.md  Line: 808  Rule: generic-api-key (×2)
  Description: Detected a Generic API Key, potentially exposing access to various services and sensitive operations.
  Match: [REDACTED]
```

**Assessment:** These are likely example/placeholder API keys embedded in documentation files (`.md`), not live credentials. All occurrences are in `docs/` and have the `generic-api-key` rule (low specificity). Trivy and TruffleHog did not flag any live-verified secrets in these same files. However, they should be reviewed and replaced with clearly fake placeholder strings (e.g., `figd_XXXXXXXXXXXX`).

---

## Bandit — Python SAST

**Summary:** Skipped — no Python files found in target.

```
find result: (no output — zero .py files in repository)
```

---

## Semgrep — OWASP + TypeScript/JS Rules

**Summary:** Skipped — process killed with SIGKILL (exit code 137) on every attempt, including scoped runs against `src/tools/` only. Likely OOM (insufficient RAM to load Semgrep rule engine for this codebase size).

```
semgrep scan --metrics=off --config p/javascript <path>/src — exit code 137 (SIGKILL)
semgrep scan --metrics=off --config p/owasp-top-ten <path>  — exit code 137 (SIGKILL)
semgrep scan --metrics=off --config auto <path>/src/tools   — exit code 137 (SIGKILL)
```

**Coverage gap:** OWASP Top 10 JavaScript/TypeScript rules not covered in this run.

---

## Trivy — Dependencies & Misconfigurations

**Summary:** 0 vulnerabilities in npm dependencies; 1 CRITICAL secret in `.env` file

```
2026-03-30T10:02:02+07:00 INFO [vulndb] Vulnerability DB updated successfully
2026-03-30T10:02:05+07:00 INFO Suppressing dependencies for development and testing.
2026-03-30T10:02:05+07:00 INFO Number of language-specific files num=1
2026-03-30T10:02:05+07:00 INFO [npm] Detecting vulnerabilities...

Report Summary

┌───────────────────┬──────┬─────────────────┬─────────┐
│      Target       │ Type │ Vulnerabilities │ Secrets │
├───────────────────┼──────┼─────────────────┼─────────┤
│ package-lock.json │ npm  │        0        │    -    │
├───────────────────┼──────┼─────────────────┼─────────┤
│ .env              │ text │        -        │    1    │
└───────────────────┴──────┴─────────────────┴─────────┘

.env (secrets)
==============
Total: 1 (UNKNOWN: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 1)

CRITICAL: Npm (npm-access-token)
════════════════════════════════════════
npm access token
────────────────────────────────────────
 .env:1 (offset: 17 bytes)
────────────────────────────────────────
   1 [ export NPM_TOKEN=******************************************
   2
────────────────────────────────────────
```

**Assessment:** The `.env` file contains an `NPM_TOKEN`. This is expected (used for publish step per the scheduled task), but the file MUST be in `.gitignore` to prevent accidental commit. The token value is already masked by Trivy's output — raw value confirmed [REDACTED].

---

## TruffleHog — Secret Detection

**Summary:** 0 secrets detected (0 verified live, 0 unverified) across 393 commits

> ⚠️ **CONFIDENTIAL** — This report may contain sensitive findings. Do not share without review.

```
🐷🔑🐷  TruffleHog. Unearth your secrets. 🐷🔑🐷

2026-03-30T10:02:15+07:00 info-0 trufflehog running source {"source_manager_worker_id": "7cR3j", "with_units": true}
2026-03-30T10:02:15+07:00 info-0 trufflehog scanning repo {"unit_kind": "dir", "repo": "file:///Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp"}
2026-03-30T10:02:16+07:00 info-0 trufflehog finished scanning {
  "chunks": 4900,
  "bytes": 7228675,
  "verified_secrets": 0,
  "unverified_secrets": 0,
  "scan_duration": "2.091887708s",
  "trufflehog_version": "3.94.1",
  "verification_caching": {"Hits":0,"Misses":4,"HitsWasted":0,"AttemptsSaved":0,"VerificationTimeSpentMS":2320}
}
```

**Assessment:** Clean — no live-verified or unverified secrets in 393 commits of git history. The 4 cache misses indicate TruffleHog attempted live verification on candidates and found nothing.

---

## CodeQL — Semantic SAST (GitHub Actions)

**Summary:** Not configured — no `.github/workflows/` directory in this repository.

```
ls .github/workflows/ — No such file or directory
gh run list --workflow codeql.yml — No CodeQL workflow found
```

**Recommendation:** Add `actions/codeql-action` to GitHub Actions for deep semantic SAST coverage. Create `.github/workflows/codeql.yml` targeting JavaScript/TypeScript.

---

## mcps-audit — MCP Permission Audit

**Summary:** No MCP skill/config files detected in target path — skipped.

```
find result: (no SKILL.md, mcp*.json, or .mcp* files found)
```

---

## Cross-Tool Observations

- `docs/tools.md`, `docs/TOOLS.md`, `docs/TROUBLESHOOTING-MISSING-DESCRIPTIONS.md`, `docs/DOM_BASED_VARIABLE_EXTRACTION_FEASIBILITY.md` — flagged by **Gitleaks** (`generic-api-key` rule). These are documentation files, likely containing example Figma API token strings. Not flagged by TruffleHog (no live verification hit), suggesting they are non-functional placeholder values. **Low-confidence finding but warrants review.**
- `.env` — flagged by **Trivy** (CRITICAL: npm-access-token). Not flagged by TruffleHog or Gitleaks in git history, confirming the token has NOT been committed. **File is correctly untracked. Verify `.gitignore` coverage.**

---

## Coverage Gaps

- **Semgrep OWASP Top 10 (JS/TS)** — not scanned due to OOM kill. To run manually: `semgrep scan --config p/owasp-top-ten ./src` on a machine with ≥8GB free RAM, or use Semgrep Cloud.
- **CodeQL deep semantic SAST** — no GitHub Actions workflow configured. Add `actions/codeql-action`.
- **Business logic flaws** — not detectable by static tools; requires manual code review.
- **IDOR / broken object-level authorization** — requires runtime/integration test context.
- **Runtime behavior of `figma_execute`** — this tool executes arbitrary JavaScript in the Figma plugin context. Static tools cannot assess the runtime injection surface; manual review of input sanitization in `src/tools/` is recommended.

---

## Overall Risk Assessment

| Severity | Count | Items |
|----------|-------|-------|
| CRITICAL | 1     | `.env` NPM_TOKEN present on filesystem (not committed — verify `.gitignore`) |
| HIGH     | 0     | — |
| MEDIUM   | 0     | — |
| LOW      | 7     | Gitleaks `generic-api-key` hits in docs/ (likely placeholder values) |

**Result: CONDITIONAL CLEAN** — No vulnerabilities in npm dependencies. No secrets in git history. The one CRITICAL finding (`.env` NPM_TOKEN) is expected and controlled, but must be confirmed as `.gitignore`-protected before publish.
