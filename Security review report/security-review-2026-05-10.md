# Automated Security Scan Report
**Target:** `/Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp`  
**Scanned at:** 2026-05-10T22:31:00+07:00  
**Git HEAD:** 267fc6b (local, pre-merge with origin/main @ aa69c36 — v1.23.0)  
**Standard:** OWASP APTS-aligned (Scope Enforcement · Auditability · Manipulation Resistance · Reporting)

---

## Scope Record

```
Scan target: /Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp
Git HEAD:    267fc6b
Include:     all supported
Exclude:     .gitignore honored by each tool
```

---

## Coverage Disclosure (APTS § Reporting)

| Tool | Ran? | Version | Files covered | Notes |
|------|------|---------|---------------|-------|
| Gitleaks | ✅ OK | 8.30.1 | 444 commits scanned | |
| Bandit | ⏭ SKIPPED | 1.9.4 | — | No .py files in project |
| Semgrep (OWASP) | ✅ OK | latest | 55 files | 0 findings |
| Semgrep (TypeScript) | ✅ OK | latest | 54 files | 0 findings |
| Semgrep (Secrets) | ✅ OK | latest | 129 files | 0 findings |
| Trivy | ✅ OK | 0.69.3 | package-lock.json + .env | 8 vulns (all fixed via overrides) |
| TruffleHog | ✅ OK | 3.94.2 | Full git history | 0 verified secrets |
| CodeQL | ⏭ N/A | — | — | No github.com remote match |
| mcps-audit | ⏭ SKIPPED | — | — | No MCP manifest files in project root |
| OSV-Scanner | ✅ OK | 2.3.5 | package-lock.json (758 pkgs) | 8 vulns (all fixed via overrides) |
| mcp-scan | ⏭ OPT-IN | — | — | Not opted in (sends data to invariantlabs.ai) |
| security-audit (config-audit.py) | ✅ OK | bundled | Global ~/.claude + project | 33 findings (see below) |
| skill-audit | ✅ OK | bundled | 0 SKILL.md in project | No skill files in project |
| mcp-exfil-scan | ✅ OK | bundled | Project + global skills | 11 findings (scope note below) |

---

## Gitleaks — Secrets in Git History

**Summary:** 13 findings, all `generic-api-key` rule, all in **documentation files** — no source code secrets.

| File | Lines | Value (redacted) | Assessment |
|------|-------|-----------------|------------|
| `Security review report/security-review-2026-04-02.md` | 28,38,41,46,49,54 | `abc123def456`, `[REDACTED]` | Placeholder examples in past security report |
| `docs/tools.md` | 1160, 1184 | `abc123def456` | Example values in tool documentation |
| `docs/TOOLS.md` | 874, 898 | `abc123def456` | Example values in tool documentation |
| `docs/TROUBLESHOOTING-MISSING-DESCRIPTIONS.md` | 186 | `[REDACTED]` | Example value in troubleshooting doc |
| `docs/DOM_BASED_VARIABLE_EXTRACTION_FEASIBILITY.md` | 808 (×2) | `[REDACTED]` | Example value in feasibility doc |

**Verdict:** All findings are false positives — placeholder/example values in markdown documentation files, not real credentials in code. TruffleHog (with live API verification) found **0 verified secrets**, confirming these are not active credentials.

**Recommendation:** Add a `.gitleaksignore` or baseline file to suppress known doc false positives in future runs.

---

## Semgrep — OWASP / TypeScript / Secrets

**Summary:** 0 findings across all three rulesets on 55 TypeScript/JavaScript files.  
1 file skipped (>300KB size limit): package-lock.json (expected, not source code).

---

## Trivy — Dependency Vulnerabilities + Secrets

### npm Vulnerabilities (pre-fix)

| Library | CVE | Severity | Installed | Fixed |
|---------|-----|----------|-----------|-------|
| fast-uri | CVE-2026-6321 | HIGH | 3.1.0 | 3.1.1 |
| fast-uri | CVE-2026-6322 | HIGH | 3.1.0 | 3.1.2 |
| hono | CVE-2026-44455 | MEDIUM | 4.12.15 | 4.12.16 |
| hono | CVE-2026-44456 | MEDIUM | 4.12.15 | 4.12.16 |
| hono | CVE-2026-44457 | MEDIUM | 4.12.15 | 4.12.18 |
| hono | CVE-2026-44458 | MEDIUM | 4.12.15 | 4.12.18 |
| hono | CVE-2026-44459 | LOW | 4.12.15 | 4.12.18 |
| ip-address | CVE-2026-42338 | MEDIUM | 10.1.0 | 10.1.1 |

### Secrets Finding

**`.env:1` — npm access token (CRITICAL):** Trivy detected an npm access token in `.env`. This file is **gitignored** (confirmed: `.env` in `.gitignore` line 97) and not tracked in git history. This is the project's local development env file — not a leak risk. No action required.

### Fix Applied

Added three `overrides` entries to `package.json`:
```json
"fast-uri": ">=3.1.2",
"ip-address": ">=10.1.1",
"hono": ">=4.12.18"   ← (was >=4.12.14, bumped to cover all hono CVEs)
```

After `npm install`: `npm audit` → **0 vulnerabilities** ✅

---

## TruffleHog — Live Secret Verification

**Summary:** 5,643 chunks / 8.1 MB scanned. **0 verified secrets. 0 unverified secrets.**

---

## OSV-Scanner — SCA

**Pre-fix:** 8 vulnerabilities (0 Critical, 2 High, 5 Medium, 1 Low) across fast-uri, hono, ip-address.  
**Post-fix:** All 8 fixed via package.json overrides (see Trivy section above).

---

## security-audit (config-audit.py) — Claude Config

**Summary:** 33 findings across global `~/.claude/settings.json` and installed skills/plugins.

> ⚠️ **Scope note:** These findings are in the **user's global Claude configuration**, not in `figma-console-mcp` source code. They are reported for completeness per APTS Reporting requirements.

### CRITICAL findings (5) — All False Positives in Security Tool Code

All 5 CRITICAL flags were triggered by the **security scanner's own scripts** (`mcp-exfil-scan.sh`, `skill-audit.sh`, `config-audit.py`, `skill-security-auditor/SKILL.md`, `security-scanner/SKILL.md`) because they contain patterns like base64 encoding, SSH directory references, and ncat connections **as detection patterns** — i.e., these are the scanner checking for these patterns, not performing them.

**Verdict:** False positives — security tooling correctly flagged its own detection code.

### HIGH findings (10) — Global settings.json hooks

cc-beeper hooks (`curl http://localhost:${PORT}/hook`) firing on PostToolUse, Notification, Stop, StopFailure, PermissionRequest, PreToolUse, UserPromptSubmit — these are the user's local notification hooks posting to `localhost`, not an external endpoint. These are pre-existing known user configuration items, not new findings from v1.23.0.

Two additional HIGH findings in `plugin-dev` example scripts (`validate-bash.sh`) flagging `mkfs` and `dd` detection patterns — these are example hook scripts that contain these strings as **blocked command patterns** to reject. False positives.

### MEDIUM findings (14) — Global config noise

Broad matcher `""` warnings (cc-beeper hooks), `skipDangerousModePermissionPrompt: true`, and skill source attribution warnings for playwright-cli, notebooklm-cli. Pre-existing user config items, unrelated to v1.23.0.

### Findings directly attributable to figma-console-mcp: **0**

---

## mcp-exfil-scan — MCP Exfiltration

**Summary:** 11 findings (CRITICAL: 2, HIGH: 5, MEDIUM: 4). Risk score: 100/100.

> ⚠️ **Scope note:** All 11 findings are in **global `~/.claude/skills/`** files (impeccable, security-audit, skill-security-auditor, atlas-cloud, playwright-cli, pyright, vtsls) — **none are in figma-console-mcp source**. The scanner traversed the global skills directory when invoked from this path.

### Findings in figma-console-mcp source: **0**
### MCP outbound data flow: **0 suspicious findings** ✅

---

## Cross-Tool Observations

1. **Dependency vulnerabilities (fast-uri, hono, ip-address):** Confirmed by both Trivy and OSV-Scanner. **All fixed** via `package.json` overrides. npm audit verifies 0 remaining.

2. **Gitleaks false positives in docs:** 13 findings all in markdown documentation, none verified by TruffleHog. Pattern: `abc123def456` placeholder strings in tool usage examples. Recommend `.gitleaksignore` baseline.

3. **`.env` token:** Trivy CRITICAL flag on local `.env` file. Confirmed gitignored, not in history, not a real leak. Low operational risk.

4. **config-audit / mcp-exfil-scan:** All findings are in global Claude user config, not in figma-console-mcp. Zero project-source findings from either tool.

---

## Coverage Gaps

- Business logic flaws, IDOR, runtime behavior not covered by static analysis.
- `mcp-scan` (invariantlabs.ai) not run — requires opt-in.
- CodeQL not run — no github.com remote configured for CI.

---

## Security Gate Assessment

| Category | Status | Details |
|----------|--------|---------|
| npm vulnerabilities | ✅ PASS | 0 after overrides fix |
| Secrets in code | ✅ PASS | TruffleHog: 0 verified |
| Gitleaks | ⚠️ INFO | 13 findings, all doc false positives |
| SAST (Semgrep) | ✅ PASS | 0 findings |
| Project source issues | ✅ PASS | 0 findings from any tool |

**SECURITY_GATE = `pass`** ✅

---

### APTS Audit Log

- **Log:** `/tmp/css-scan-20260510T152836Z.jsonl`
- **Tool runs recorded:** 14
- **Standard:** OWASP APTS § Auditability
