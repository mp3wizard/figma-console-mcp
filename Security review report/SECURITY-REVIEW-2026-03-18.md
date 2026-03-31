# Security Review Report — Figma Console MCP

**Target:** `figma-console-mcp`
**Version Reviewed:** 1.14.0
**Review Date:** 2026-03-18
**Reviewer:** Automated Security Analysis (Claude security-analysis agent)
**Review Type:** Static Code Analysis + Dependency Audit
**Scope:** New and modified files since 2026-03-16 review (v1.13.1 → v1.14.0)

---

## Executive Summary

**Overall Risk Posture: MEDIUM** (before fixes) → **LOW** (after fixes)

The v1.14.0 release introduces cross-file library component access via the Figma REST API (`figma_get_library_components`, enhanced `figma_search_components`), a new OAuth scope (`library_content:read`), and minor changes to the cloud relay and API client. The security posture is generally well-maintained from the 2026-03-16 baseline. One new **High** finding was discovered: a reflected error message in an HTML response that could enable XSS under specific conditions (SEC-NEW-001). This was fixed directly during the review. The three dependency vulnerabilities from the previous review remain open (wrangler/undici chain) as they are dev-tool-only and have no runtime impact.

### Key Statistics

| Severity | Found (New) | Fixed in This Review | Requires Manual Action |
|----------|-------------|---------------------|----------------------|
| High | 1 | 1 | 0 |
| Medium | 0 | — | 0 |
| Low | 2 | 0 | 2 |
| Informational | 3 | — | 3 |
| **Total (new)** | **6** | **1** | **5** |

### Automated Tool Coverage

| Tool | Status | Notes |
|------|--------|-------|
| npm audit | Run | 3 HIGH vulns in `wrangler/miniflare/undici` (dev-only chain, unchanged from prior review) |
| grep secrets scan | Run | No hardcoded credentials found |
| Manual code review | Complete | All new/modified files reviewed |

---

## Comparison with Previous Review (2026-03-16)

### What Changed in v1.14.0

| File | Change |
|------|--------|
| `src/local.ts` | ~482 lines added: `figma_get_library_components` tool + library search path in `figma_search_components` |
| `tests/library-components.test.ts` | New test file — 890 lines of unit tests for the new library feature |
| `src/core/cloud-websocket-relay.ts` | Minor: uses `Math.min/max` clamping on `timeoutMs`, no security-relevant changes |
| `src/core/figma-api.ts` | Added `getComponents()` and `getComponentSets()` methods — both use the existing authenticated `request()` helper |
| `src/index.ts` | New OAuth scope `library_content:read` added to all Figma OAuth authorization requests; stateless `/mcp` path now also uses `relay:${bearerToken}` KV key for relay session persistence |

### What Was Fixed Since Last Review

All 13 findings from the 2026-03-16 review remain fixed — no regressions were detected.

### What's New / Regressed

| Finding | Status |
|---------|--------|
| SEC-NEW-001 (XSS in OAuth error catch block) | **New — Fixed during this review** |
| SEC-NEW-002 (Unescaped HTML in OAuth "invalid state" page) | **New — Low severity, manual action required** |
| SEC-DEP-001 (undici High CVEs) | **Unchanged from prior review — dev dependency only** |

---

## New Findings

---

### SEC-NEW-001 — Reflected Error Message XSS in OAuth Catch Block

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Injection — Reflected Cross-Site Scripting (CWE-79) |
| **Location** | `src/index.ts` — `/oauth/callback` error catch block (was line ~2049) |
| **Detection** | Manual code review |
| **Status** | **Fixed during this review** |

**Description:**
The catch block that handles failures during the OAuth authorization-code-to-token exchange reflected `error.message` (or `String(error)`) directly into an HTML response body without HTML-escaping and without a Content-Security-Policy header. The `error` object is built from the Figma token endpoint response body (`errorText`) which is partially attacker-influenced: an adversary who can manipulate Figma's token response (or substitute a malicious token endpoint via DNS/BGP poisoning) could inject script tags that execute in the browser under the application origin.

While the exploit requires a privileged network position, the risk was still classified as High because the fix is trivial and the failure mode (XSS under the application origin, which holds OAuth state) is severe.

**Affected Code (before fix):**
```typescript
// src/index.ts ~line 2046
} catch (error) {
    logger.error({ error, sessionId }, "OAuth callback failed");
    return new Response(
        `<html><body>
            <h1>Authentication Error</h1>
            <p>Failed to complete authentication: ${error instanceof Error ? error.message : String(error)}</p>
            ...
        </body></html>`,
        { status: 500, headers: { "Content-Type": "text/html" } }
    );
}
```

**Fix Applied (src/index.ts):**
- Removed `error.message` / `String(error)` from the HTML template
- Added `Content-Security-Policy: default-src 'none'` header
- Added `charset=utf-8` to Content-Type

```typescript
} catch (error) {
    logger.error({ error, sessionId }, "OAuth callback failed");
    // Do NOT reflect error.message into HTML — upstream token exchange errors
    // may contain attacker-influenced content (e.g., from a crafted auth code).
    return new Response(
        `<html><head><meta charset="utf-8"></head><body>
            <h1>Authentication Error</h1>
            <p>Failed to complete authentication. Please try again or contact support.</p>
        </body></html>`,
        { status: 500, headers: { "Content-Type": "text/html; charset=utf-8",
                                   "Content-Security-Policy": "default-src 'none'" } }
    );
}
```

**CWE:** CWE-79 (Improper Neutralization of Input During Web Page Generation)

---

### SEC-NEW-002 — Missing HTML Escape + CSP on "Invalid State" OAuth Page

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Injection — Reflected XSS (Defense-in-Depth) (CWE-79) |
| **Location** | `src/index.ts` line ~1816 — `/oauth/callback` invalid-state page |
| **Detection** | Manual code review |
| **Status** | Not fixed — Low severity, no user-controlled input reflected here |

**Description:**
The "invalid or expired request" page served when a state token is not found in KV does not include a `Content-Security-Policy` header or `charset=utf-8`. This page does not currently reflect user input, so there is no active XSS vector. However, for consistency with defense-in-depth and to comply with the pattern established in SEC-001 (fixed in the prior review), the page should have the same hardening.

**Location:**
```typescript
// src/index.ts ~line 1816
return new Response(
    `<html><body>
        <h1>Invalid or Expired Request</h1>
        <p>The authentication request has expired or is invalid.</p>
        ...
    </body></html>`,
    { status: 400, headers: { "Content-Type": "text/html" } }   // Missing CSP, charset
);
```

**Remediation:** Add `"Content-Security-Policy": "default-src 'none'"` and `charset=utf-8` to the headers, matching the pattern used in other error responses.

**CWE:** CWE-79 (defense in depth)

---

### SEC-NEW-003 — Library File Key Accepted Without Validation (IDOR / Unauthorized Data Access)

| Field | Value |
|-------|-------|
| **Severity** | Informational |
| **Category** | Broken Access Control — IDOR (CWE-639) |
| **Location** | `src/local.ts` — `figma_get_library_components` tool and `figma_search_components` library path |
| **Detection** | Manual code review |
| **Status** | By-design — informational only |

**Description:**
The new `figma_get_library_components` tool accepts a `libraryFileKey` (or extracts one from a `libraryFileUrl`) and passes it directly to the Figma REST API (`GET /v1/files/{fileKey}/components`). There is no server-side allow-list or validation of which file keys a user may query.

The Figma REST API itself enforces access control — it returns a 403 if the authenticated token does not have access to the requested file. Since the MCP server passes the user's own OAuth token, access is correctly gated by Figma's own authorization. A user can only query files they have permission to access within Figma.

However, in local mode (`src/local.ts`), the `FIGMA_ACCESS_TOKEN` is a single shared Personal Access Token configured by the system administrator. If that PAT has broad team access, any MCP client that connects can use `figma_get_library_components` to enumerate any file accessible to that PAT. This is an expected trust boundary for local single-user deployments, but multi-user shared deployments should be aware.

**Risk:** In single-user local mode — no additional risk. In multi-user cloud mode — Figma's own access control enforces the boundary. Documented for awareness.

**Remediation (Optional):** For multi-tenant local deployments, consider maintaining an allow-list of permissible library file keys in a config file.

**CWE:** CWE-639

---

### SEC-NEW-004 — OAuth Scope Expansion: `library_content:read` Added Without Scope Downgrade Path

| Field | Value |
|-------|-------|
| **Severity** | Informational |
| **Category** | Security Misconfiguration — Excessive Scope (CWE-272) |
| **Location** | `src/index.ts` — `/authorize`, `/oauth/authorize`, OAuth metadata endpoints |
| **Detection** | Manual code review |
| **Status** | Informational |

**Description:**
v1.14.0 adds the `library_content:read` scope to all Figma OAuth authorization requests. Existing authenticated users who previously granted `file_content:read` and `file_variables:read` will be required to re-authorize when their token expires to include the new scope. There is no mechanism to request a reduced scope set.

This is a standard limitation of the Figma OAuth flow, but the following concerns apply:

1. Existing sessions (tokens stored in KV prior to v1.14.0) will not include `library_content:read`. If the application tries to call `/files/{key}/components` with such a token, Figma will return a 403. The application gracefully handles these errors (wraps in `.catch()`), but users may see confusing "library not accessible" errors until they re-authenticate.

2. The scope string appears in three different formats across the codebase (`file_content:read,file_variables:read,library_content:read` with commas in authorization URL construction, `file_content:read file_variables:read library_content:read` with spaces in token responses). This inconsistency should be verified against Figma's API documentation — if Figma's parser is strict, the wrong separator could silently drop scopes.

**Remediation:**
- Standardize the scope separator (space-delimited in RFC 6749 responses, comma-delimited may be Figma-specific in auth requests — verify this).
- Add a note in the README that users may need to re-authenticate after upgrading to v1.14.0.

**CWE:** CWE-272

---

### SEC-NEW-005 — Dependency Vulnerabilities in `undici` (via `wrangler`) — Unchanged

| Field | Value |
|-------|-------|
| **Severity** | High (CVSS scores from advisories) / Low (effective runtime risk) |
| **Category** | Dependency Vulnerability (CWE-1395) |
| **Location** | `package-lock.json` — `node_modules/undici` version `7.18.2` |
| **Detection** | `npm audit` |
| **Status** | Unchanged from 2026-03-16 review — dev dependency only |

**Description:**
Three advisories affect `undici` 7.18.2 (the version installed), all fixed in 7.24.0:

| Advisory | Severity | Title |
|----------|----------|-------|
| GHSA-f269-vfmq-vjvj | High | Malicious WebSocket 64-bit length overflows parser, crashes client |
| GHSA-vrm6-8vpv-qv8q | High | Unbounded memory consumption in WebSocket permessage-deflate decompression |
| GHSA-v9p9-hfj2-hcw8 | High | Unhandled exception in WebSocket client due to invalid server_max_window_bits |
| GHSA-2mjp-6q6p-2qxm | Moderate | HTTP Request/Response Smuggling |
| GHSA-4992-7rv2-5pvq | Moderate | CRLF Injection via `upgrade` option |
| GHSA-phc3-fgpg-7m6h | Moderate | Unbounded memory consumption in DeduplicationHandler (DoS) |

`undici` is a transitive dependency of `wrangler` (the Cloudflare dev CLI) and `miniflare` (the local Cloudflare emulator). These tools are `devDependencies` and are not included in the production runtime that runs on Cloudflare Workers. The production runtime uses native Cloudflare Workers `fetch()`. There is **no runtime exposure**.

**Remediation:**
- Run `npm update wrangler` to pick up wrangler 4.x with undici 7.24.0+. Currently pinned at `^4.35.0`.
- This is a dev environment risk only; no production patch is needed.

**CWE:** CWE-1395

---

### SEC-NEW-006 — `figma_execute` Allows Arbitrary Code Execution in Figma Plugin Context

| Field | Value |
|-------|-------|
| **Severity** | Informational (by design) |
| **Category** | Injection — Remote Code Execution (CWE-94) |
| **Location** | `src/local.ts` — `figma_execute` tool; `src/core/figma-desktop-connector.ts` line 108 |
| **Detection** | Manual code review |
| **Status** | Informational — by design, unchanged from prior review |

**Description:**
The `figma_execute` tool (and several higher-level tools that compose it) pass AI-generated JavaScript code strings to `worker.evaluate()` inside the Figma Desktop process. The code string is wrapped in `(${code})` and evaluated in the Figma plugin sandbox with full access to the `figma` global API.

This is the core design of the tool and is not a new vulnerability. The trust boundary is: the MCP server trusts the AI/LLM that generates the code, and the LLM trusts the human who instructs it. The Figma plugin sandbox provides the primary containment boundary.

No new code paths introduced in v1.14.0 change this model — `figma_get_library_components` uses the REST API (not `figma_execute`) for discovery, and `figma_instantiate_component` uses `figma.importComponentByKeyAsync()` via `figma_execute`.

**Remediation:** Informational only. Document in the README that `figma_execute` is a privileged tool and should not be exposed to untrusted callers.

**CWE:** CWE-94

---

## Findings Summary Table

| ID | Severity | Category | File | Status |
|----|----------|----------|------|--------|
| SEC-NEW-001 | **High** | XSS — Error reflection in HTML | `src/index.ts` | Fixed in this review |
| SEC-NEW-002 | Low | Missing CSP on OAuth error page | `src/index.ts` | ✅ Fixed |
| SEC-NEW-003 | Info | IDOR — Library file key access | `src/local.ts` | By design / documented |
| SEC-NEW-004 | Info | OAuth scope expansion | `src/index.ts` | Needs doc update |
| SEC-NEW-005 | High/Low | undici CVEs (dev dependency) | `package-lock.json` | ✅ Fixed — 0 vulnerabilities |
| SEC-NEW-006 | Info | Arbitrary code execution in Figma | `src/local.ts`, `figma-desktop-connector.ts` | By design |

---

## Immediate Action Items

1. **[DONE] Fix SEC-NEW-001** — Applied during this review. No further action needed.

2. **[DONE] SEC-NEW-002 fixed** — Added `Content-Security-Policy: default-src 'none'` and `charset=utf-8` to the "Invalid or Expired Request" HTML page in `src/index.ts` line ~1824.

3. **[DONE] wrangler updated** — Ran `npm update wrangler`. `npm audit` now reports **0 vulnerabilities**.

4. **[TODO] Verify OAuth scope separator** — Confirm with Figma API docs whether the scope string in the `GET /oauth` authorization URL uses comma-separated (`file_content:read,file_variables:read,library_content:read`) or space-separated values. Standardize across all endpoints in `src/index.ts`.

5. **[TODO] Notify users to re-authenticate** — Add a note to the CHANGELOG/README that users upgrading from ≤1.13.1 to 1.14.0 may need to re-authorize their OAuth connection to gain `library_content:read` scope access.

---

## Files Reviewed

| File | Type | Notes |
|------|------|-------|
| `src/local.ts` | New additions | ~482 new lines for library component feature — reviewed in full |
| `tests/library-components.test.ts` | New file | Test file — no security findings |
| `src/core/cloud-websocket-relay.ts` | Modified | Minor timeout clamping change — no security impact |
| `src/core/figma-api.ts` | Modified | New `getComponents()` / `getComponentSets()` methods — no new security issues |
| `src/index.ts` | Modified | OAuth scope addition + new relay KV path — one XSS finding (fixed) |
| `package-lock.json` | Scanned | npm audit — undici vulnerabilities noted |

---

*Report generated by automated static analysis on 2026-03-18. Review covered all files modified since the 2026-03-16 baseline review of version 1.13.1.*
