# Automated Security Scan Report
**Target:** `/Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp`
**Scanned at:** 2026-04-09T09:25:00+07:00
**Tools run:** Gitleaks, Semgrep (OWASP/TypeScript/Secrets), Trivy, TruffleHog, OSV-Scanner, mcps-audit, config-audit, mcp-exfil-scan
**Tools skipped:** Bandit (no .py files), CodeQL (no workflow), mcp-scan (opt-in)

---

## Pre-flight Summary

| Tool | Status | Version / Note |
|------|--------|----------------|
| bandit | SKIPPED | No .py files in src/ |
| semgrep | OK | 1.157.0 |
| trivy | OK | 0.69.3 (safe) |
| trufflehog | OK | 3.94.2 |
| gitleaks | OK | 8.30.1 |
| osv-scanner | OK | 2.3.5 |
| gh (CodeQL) | N/A | No codeql.yml workflow |
| npx (mcps-audit) | OK | bundled |
| uvx (mcp-scan) | OPT-IN | Not invoked |
| config-audit.py | OK | bundled |
| mcp-exfil-scan.sh | OK | bundled |

---

## Gitleaks — Secrets in git history

**Summary:** 13 findings — all false positives (placeholder/example values in documentation)

All findings match `generic-api-key` rule on:
- `abc123def456` — placeholder component key in docs (entropy 3.58)
- `my83n4o9LOGs74oAoguFcGS` — Figma file key in docs examples

Affected files: security-review-2026-04-02.md, docs/tools.md, docs/TOOLS.md, docs/TROUBLESHOOTING-MISSING-DESCRIPTIONS.md, docs/DOM_BASED_VARIABLE_EXTRACTION_FEASIBILITY.md

**Assessment:** False positives. TruffleHog (live verification) found 0 verified secrets — confirms no live credentials in history.

**Note:** GitHub PAT detected in `.git/config` for mywizard remote URL. Local config only, not in repo. Consider SSH or credential helper.

---

## Semgrep — SAST

**Summary:** 0 findings (193 rules, 126 files total)

- OWASP Top 10: 0 findings
- TypeScript: 0 findings
- Secrets: 0 findings

---

## Trivy — Dependencies and Secrets

**Vulnerability (FIXED):**

| Library | Advisory | Severity | Installed | Fixed |
|---------|----------|----------|-----------|-------|
| basic-ftp | GHSA-chqc-8p9q-pq6q | HIGH | 5.2.0 | 5.2.1 |

Dependency chain: @cloudflare/puppeteer -> @puppeteer/browsers -> proxy-agent -> pac-proxy-agent -> get-uri -> basic-ftp

Fix applied: `"basic-ftp": ">=5.2.1"` added to `package.json` overrides. Re-audit: 0 vulnerabilities.

**Secret:** NPM access token in `.env:1` — local file, not committed to git, used by publish pipeline. No action required.

---

## TruffleHog — Live Secret Verification

**Summary:** 0 verified secrets, 0 unverified secrets (CLEAN)

Scanned 5,430 chunks, 7.88 MB, 422 commits.

---

## OSV-Scanner — SCA

**Summary:** 1 HIGH resolved

| Package | CVSS | Fixed | Source |
|---------|------|-------|--------|
| basic-ftp | 8.6 | 5.2.1 | package-lock.json |

Post-fix: 0 vulnerabilities.

---

## npm audit — Fix (3B)

Before: 1 high severity vulnerability (basic-ftp 5.2.0)
Fix: package.json overrides added "basic-ftp": ">=5.2.1"
After: 0 vulnerabilities

---

## mcps-audit

**Summary:** 296 findings, Risk 100/100 — pre-existing, by design

All flagged "dangerous execution" patterns are in `figma-desktop-bridge/code.js` — this file uses dynamic code execution intentionally as a Figma plugin bridge. Not new issues from today's commit.

---

## config-audit / mcp-exfil-scan

**Summary:** 15 / 9 findings — all false positives from security tooling itself

The security-scanner and skill-security-auditor skills legitimately access .env files and have network capabilities for security analysis. Pre-existing findings, not from today's commit.

---

## Cross-Tool Observations

- basic-ftp HIGH confirmed by Trivy + OSV-Scanner (CVSS 8.6) — fixed
- Gitleaks 13 findings vs TruffleHog 0 verified — all Gitleaks findings are false positives
- Semgrep 0 SAST issues in TypeScript source — clean codebase
- Dynamic code execution in figma-desktop-bridge is architectural, pre-existing, accepted risk

## Coverage Gaps

- Business logic, IDOR, runtime behavior not covered
- CodeQL not available
- mcp-scan not invoked (opt-in)

## Security Gate

**PASS** — 0 unfixed vulnerabilities after basic-ftp 5.2.0 -> 5.2.1 override applied
