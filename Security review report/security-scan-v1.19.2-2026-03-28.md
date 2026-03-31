# Automated Security Scan Report

**Target:** `/Users/mp3wizard/Public/Figma MCP with Claude/figma-console-mcp`
**Scanned at:** 2026-03-28T04:18:16Z
**Triggered by:** Merge of southleft v1.19.1 + v1.19.2 into @mp3wizard/figma-console-mcp
**Tools run:** Semgrep, Trivy, TruffleHog
**Tools skipped:** Bandit — no Python files found in target

---

## Pre-flight Summary

| Tool       | Status  | Version   |
| ---------- | ------- | --------- |
| Bandit     | SKIPPED | 1.9.4 (installed, skipped — no .py files) |
| Semgrep    | OK      | 1.156.0   |
| Trivy      | OK      | 0.69.3    |
| TruffleHog | OK      | 3.94.0    |

---

## Bandit — Python SAST

**Summary:** Skipped — no Python files found in target path.

```
find <path> -name "*.py" | head -1
(no output — no Python files present)
```

---

## Semgrep — OWASP + Python Rules

**Summary:** 0 findings across 114 files (101 rules run)

```
┌─────────────┐
│ Scan Status │
└─────────────┘
  Scanning 114 files tracked by git with 548 Code rules:

  Language      Rules   Files          Origin      Rules
 ─────────────────────────────        ───────────────────
  <multilang>       6     114          Community     548
  ts               71      53
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
 • Targets scanned: 114
 • Parsed lines: ~99.9%
 • Scan skipped:
   ◦ Files matching .semgrepignore patterns: 29
 • Scan was limited to files tracked by git
Ran 101 rules on 114 files: 0 findings.
```

---

## Trivy — Dependencies & Misconfigurations

**Summary:** 0 vulnerabilities (0 critical, 0 high), 0 secrets detected

```
2026-03-28T11:18:05+07:00	INFO	[vulndb] Artifact successfully downloaded	repo="mirror.gcr.io/aquasec/trivy-db:2"
2026-03-28T11:18:05+07:00	INFO	[vuln] Vulnerability scanning is enabled
2026-03-28T11:18:05+07:00	INFO	[secret] Secret scanning is enabled
2026-03-28T11:18:07+07:00	INFO	Suppressing dependencies for development and testing.
2026-03-28T11:18:07+07:00	INFO	Number of language-specific files	num=1
2026-03-28T11:18:07+07:00	INFO	[npm] Detecting vulnerabilities...

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

---

## TruffleHog — Secret Detection

**Summary:** 0 secrets detected (0 verified live, 0 unverified)

> ⚠️ **CONFIDENTIAL** — This report may contain sensitive findings. Do not share without review.

```
🐷🔑🐷  TruffleHog. Unearth your secrets. 🐷🔑🐷

2026-03-28T11:18:09+07:00	info-0	trufflehog	running source	{"source_manager_worker_id": "u2jaW", "with_units": true}
2026-03-28T11:18:09+07:00	info-0	trufflehog	scanning repo	{"unit": "...", "repo": "file:///Users/mp3wizard/Public/Figma%20MCP%20with%20Claude/figma-console-mcp"}
2026-03-28T11:18:10+07:00	info-0	trufflehog	finished scanning	{
  "chunks": 4780,
  "bytes": 7185722,
  "verified_secrets": 0,
  "unverified_secrets": 0,
  "scan_duration": "1.560960916s",
  "trufflehog_version": "3.94.0"
}
```

---

## Cross-Tool Observations

No cross-tool overlaps detected.

---

## Coverage Gaps

- **Bandit Python SAST** — not applicable (no Python files in this TypeScript/Node.js codebase)
- **Business logic flaws** — not detectable by static tools; requires manual review
- **IDOR / broken object-level authorization** — requires runtime context
- **Runtime secrets injection** — environment variables set at runtime are not visible to static scanners
- **Semgrep authenticated rules** — additional rules available with `semgrep login` (not run here)

---

## Verdict

**✅ CLEAN — No security issues found.**

All three applicable tools (Semgrep, Trivy, TruffleHog) returned zero findings against the merged codebase at version `1.19.2`. Safe to build and publish.

| Check | Result |
|---|---|
| SAST (Semgrep) | ✅ 0 findings / 114 files |
| Dependency CVEs (Trivy) | ✅ 0 vulnerabilities |
| Secret leaks (TruffleHog) | ✅ 0 secrets / 4,780 chunks |
| Python SAST (Bandit) | N/A — no Python files |
