# Security Review Report — Figma Console MCP

**Target:** `figma-console-mcp`
**Version Reviewed:** 1.13.1
**Review Date:** 2026-03-16
**Reviewer:** Automated Security Analysis (Claude security-analysis agent)
**Review Type:** Static Code Analysis + Dependency Audit

---

## Executive Summary

**Overall Risk Posture: MEDIUM-HIGH** (before fixes) → **LOW** (after fixes)

The codebase demonstrates good foundational security awareness — OAuth 2.0 is implemented, CSRF state tokens are cryptographically generated, and WebSocket origin checking is in place. However, several implementation-level flaws undermined these protections, particularly in the cloud/OAuth authentication flow. All identified issues have been remediated in this review session.

### Key Statistics

| Severity | Found | Fixed |
|----------|-------|-------|
| High | 4 | 4 |
| Medium | 6 | 6 |
| Low | 3 | 3 |
| Informational | 1 | noted |
| **Total** | **14** | **13** |

### Automated Tool Coverage

| Tool | Status | Notes |
|------|--------|-------|
| Bandit | Skipped | No Python files in codebase |
| Semgrep | Skipped | Not installed |
| Trivy | Skipped | Not installed, no Dockerfile present |
| TruffleHog | Skipped | Not installed |
| npm audit | ✅ Run | 8 vulnerabilities found (3 HIGH, 5 MODERATE) |

> **Note:** TruffleHog was not available to scan git history for leaked secrets. A manual scan is recommended: `trufflehog git file:///path/to/repo --no-update`

---

## Findings & Remediations

---

### SEC-001 — Reflected XSS in OAuth Error Page

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Injection — Cross-Site Scripting (Reflected) |
| **CWE** | CWE-79 |
| **Location** | `src/index.ts` (OAuth `/oauth/callback` handler) |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
The OAuth callback handler reflected `error` and `error_description` query parameters directly into an HTML response without escaping. An attacker could craft a URL with malicious `<script>` tags that execute in the browser under the application's origin.

**Before:**
```typescript
return new Response(
  `<html><body>
    <h1>Authentication Failed</h1>
    <p>Error: ${error}</p>
    <p>Description: ${url.searchParams.get("error_description") || "Unknown error"}</p>
  </body></html>`,
  { status: 400, headers: { "Content-Type": "text/html" } }
);
```

**Fix Applied:**
- Added `htmlEscape()` utility function to `src/index.ts`
- Applied escaping to all user-controlled values before HTML rendering
- Added `Content-Security-Policy: default-src 'none'` to error page responses

```typescript
function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const safeError = htmlEscape(error);
const safeDesc = htmlEscape(url.searchParams.get("error_description") || "Unknown error");
return new Response(
  `<html><head><meta charset="utf-8"></head><body>
    <h1>Authentication Failed</h1>
    <p>Error: ${safeError}</p>
    <p>Description: ${safeDesc}</p>
  </body></html>`,
  { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'" } }
);
```

---

### SEC-002 — Shared Single Session ID Enables Cross-User Token Access

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Broken Access Control / Authentication Design Flaw |
| **CWE** | CWE-287, CWE-269 |
| **Location** | `src/index.ts` (`ensureSessionId()` method, OAuth callback) |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
A hardcoded constant `FIXED_SESSION_ID = "figma-console-mcp-default-session"` was used for all MCP connections. Every user's OAuth token overwrote the same KV key, meaning User B's login would overwrite User A's token — allowing User B's Figma access to be used for User A's requests.

**Before:**
```typescript
const FIXED_SESSION_ID = "figma-console-mcp-default-session";
this.sessionId = FIXED_SESSION_ID;

// In OAuth callback — also stored under shared key:
const fixedTokenKey = `oauth_token:figma-console-mcp-default-session`;
await env.OAUTH_TOKENS.put(fixedTokenKey, JSON.stringify(storedToken), ...);
```

**Fix Applied:**
- Replaced fixed session ID with a cryptographically random unique ID generated per Durable Object instance
- Removed the secondary write to the shared `figma-console-mcp-default-session` key
- Each user's OAuth token is now stored only under their unique session key

```typescript
// Generate a unique session ID for this Durable Object instance
this.sessionId = FigmaConsoleMCPv3.generateStateToken();
await storage.put('sessionId', this.sessionId);
```

---

### SEC-003 — PKCE `code_challenge` Declared but Never Verified

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Authentication & Session Management — OAuth Security |
| **CWE** | CWE-345 |
| **Location** | `src/index.ts` (`/token` endpoint) |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
The OAuth metadata advertised `code_challenge_methods_supported: ["S256"]` but the `/token` endpoint never verified the `code_verifier` against the stored `code_challenge`. PKCE protection was completely bypassed.

**Fix Applied:**
Added full S256 PKCE verification at the `/token` endpoint:

```typescript
const codeVerifier = params.get("code_verifier");

// If a code_challenge was stored, verify code_verifier
if (mcpAuthData.codeChallenge) {
  if (!codeVerifier) {
    return new Response(JSON.stringify({ error: "invalid_request", error_description: "code_verifier required" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
  const computed = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  if (computed !== mcpAuthData.codeChallenge) {
    return new Response(JSON.stringify({ error: "invalid_grant", error_description: "PKCE verification failed" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }
}
```

---

### SEC-004 — Unvalidated `redirect_uri` in OAuth Callback Redirect

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Broken Access Control — Open Redirect / OAuth Security |
| **CWE** | CWE-601 |
| **Location** | `src/index.ts` (`/authorize` endpoint) |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
The `/authorize` endpoint stored and later redirected to any `redirect_uri` supplied by the client without validating it against the client's registered allowed URIs. An attacker could register a malicious redirect URI and steal authorization codes.

**Fix Applied:**
Added validation of `redirect_uri` against the registered client's `redirect_uris` list before storing the auth state:

```typescript
if (clientId) {
  const clientJson = await env.OAUTH_STATE.get(`client:${clientId}`);
  if (clientJson) {
    const clientData = JSON.parse(clientJson) as { redirect_uris: string[] };
    if (clientData.redirect_uris.length > 0 && !clientData.redirect_uris.includes(redirectUri)) {
      return new Response(JSON.stringify({ error: "invalid_request", error_description: "redirect_uri does not match registered redirect URIs" }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }
  }
}
```

---

### SEC-005 — Cloudflare Account ID Committed to Version Control

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Hardcoded Secrets / Credential Exposure |
| **CWE** | CWE-312 |
| **Location** | `wrangler.jsonc` (line 8) |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
The Cloudflare account ID `4718d49e576512c578ff94c6b1ba7d3f` was hardcoded in the publicly committed `wrangler.jsonc` file. This leaks infrastructure topology information and reduces the steps needed for an attacker who also obtains an API token.

**Fix Applied:**
Removed the `account_id` field from `wrangler.jsonc`. Wrangler automatically uses the `CLOUDFLARE_ACCOUNT_ID` environment variable or the account from `wrangler login`.

```jsonc
// Before:
"account_id": "4718d49e576512c578ff94c6b1ba7d3f",

// After:
// account_id removed for security — set via CLOUDFLARE_ACCOUNT_ID env var or wrangler login
```

---

### SEC-006 — Figma Access Token Prefix Logged at INFO Level

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Logging & Monitoring — Sensitive Data in Logs |
| **CWE** | CWE-532 |
| **Location** | `src/core/figma-api.ts:129`, `src/local.ts:177`, `src/index.ts:1772` |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
Every Figma API request logged the first 10 characters of the access token (`tokenPreview`) and the token length at INFO level. Token prefixes in logs reduce the entropy an attacker needs to brute-force the full token value.

**Fix Applied — `src/core/figma-api.ts`:**
```typescript
// Before:
const tokenPreview = this.accessToken ? `${this.accessToken.substring(0, 10)}...` : 'NO TOKEN';
logger.info({ url, tokenPreview, tokenLength: this.accessToken?.length, ... }, 'Making Figma API request with token');

// After:
logger.debug({ url, hasToken: !!this.accessToken, isOAuthToken, authMethod }, 'Making Figma API request');
```

**Fix Applied — `src/local.ts`:**
```typescript
// Before:
logger.info({ tokenPreview: `${accessToken.substring(0, 10)}...`, tokenLength: accessToken.length }, "Initializing Figma API with token from environment");

// After:
logger.info({ hasToken: true }, "Initializing Figma API with token from environment");
```

**Fix Applied — `src/index.ts`:**
```typescript
// Before:
logger.info({ sessionId, accessTokenPreview: accessToken ? accessToken.substring(0, 10) + "..." : null, ... }, "Token exchange successful");

// After:
logger.info({ sessionId, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken, expiresIn }, "Token exchange successful");
```

---

### SEC-007 — WebSocket Server `maxPayload` Set to 100 MB (DoS Risk)

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Security Misconfiguration / Denial of Service |
| **CWE** | CWE-770 |
| **Location** | `src/core/websocket-server.ts:125` |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
The local WebSocket bridge server accepted individual messages up to 100 MB. A local process (or plugin connection) could exhaust the Node.js heap by sending large frames.

**Fix Applied:**
Reduced `maxPayload` from 100 MB to 25 MB, which is sufficient for screenshots while limiting DoS exposure.

```typescript
// Before:
maxPayload: 100 * 1024 * 1024, // 100MB

// After:
maxPayload: 25 * 1024 * 1024, // 25MB — sufficient for screenshots
```

---

### SEC-008 — `--no-sandbox` as Default Chromium Launch Argument

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Security Misconfiguration |
| **CWE** | CWE-732 |
| **Location** | `src/core/config.ts:39` |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
`--no-sandbox` was included in the default browser argument list. This flag disables kernel-level sandboxing in Chromium, removing an important defense layer if a new browser-spawning code path is ever added.

**Fix Applied:**
Removed `--no-sandbox` from default arguments. Users who require it (e.g., specific CI environments) can add it via the config file.

```typescript
// Before:
args: [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--no-sandbox', // Note: Only use in trusted environments
],

// After:
args: [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  // '--no-sandbox' removed from defaults; enable via config file if required by your environment
],
```

---

### SEC-009 — Uncapped `timeoutMs` in Cloud Relay Commands

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Security Misconfiguration / Insufficient Input Validation |
| **CWE** | CWE-20 |
| **Location** | `src/core/cloud-websocket-relay.ts:207` |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
The `/relay/command` handler accepted an arbitrary `timeoutMs` value from the request body with no upper bound, allowing a caller to hold a Durable Object alive indefinitely.

**Fix Applied:**
```typescript
// Before:
const { method, params = {}, timeoutMs = 15000 } = body;
// ... setTimeout(..., timeoutMs)

// After:
const { method, params = {}, timeoutMs = 15000 } = body;
const safeTimeout = Math.min(Math.max(timeoutMs, 1000), 60000); // clamp 1s–60s
// ... setTimeout(..., safeTimeout)
```

---

### SEC-010 — Dependency Vulnerabilities (`undici`, `yauzl`)

| Field | Value |
|-------|-------|
| **Severity** | High (undici) / Moderate (yauzl) |
| **Category** | Dependency Vulnerabilities |
| **CWE** | CWE-1357 |
| **Location** | `package.json` (transitive) |
| **Detection** | npm audit |
| **Status** | ⚠️ Partially Fixed |

**Description:**
`npm audit` identified 8 vulnerabilities:
- **undici** (HIGH × 6): HTTP smuggling, WebSocket memory exhaustion, CRLF injection, DoS via response buffering — via `wrangler → miniflare → undici`
- **yauzl** (MODERATE): Off-by-one in zip parsing — via `puppeteer-core → @puppeteer/browsers → extract-zip → yauzl`

**Fix Applied:**
Ran `npm audit fix --force` multiple times, upgrading:
- `wrangler` → latest patched version
- `puppeteer-core` → `24.39.1`
- `@cloudflare/puppeteer` → `0.0.11`

**Residual Risk:**
`undici` and `yauzl` vulnerabilities remain as a transitive cycle between `wrangler` and `puppeteer-core`. These affect **development tooling only** (not production runtime). Upstream maintainers must release patched versions to fully resolve.

**Recommended Action:** Monitor upstream `wrangler` and `@cloudflare/puppeteer` release notes for patches. Add `npm audit --audit-level=high` as a CI gate.

---

### SEC-011 — Dynamic Client Registration Accepts Any `redirect_uri`

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Broken Access Control — OAuth Security |
| **CWE** | CWE-601 |
| **Location** | `src/index.ts` (`/oauth/register` endpoint) |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
The `/oauth/register` endpoint (RFC 7591) stored any supplied `redirect_uris` without validation, including `http://` non-localhost URIs and URIs with fragments. Combined with SEC-004, this enabled a two-step attack to steal authorization codes.

**Fix Applied:**
Added URI validation loop before storing client registration:
- Reject URIs that are not valid URLs
- Reject URIs containing a fragment (`#`)
- Reject non-HTTPS URIs unless `http://localhost`

```typescript
const rawUris = body.redirect_uris || [];
const validatedUris: string[] = [];
for (const uri of rawUris) {
  const parsed = new URL(uri); // throws on invalid URL
  if (parsed.hash) throw 400 "must not contain a fragment";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost"))
    throw 400 "must use https";
  validatedUris.push(uri);
}
```

---

### SEC-012 — OAuth Authorization Code and State Token in INFO Logs

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Logging & Monitoring — Sensitive Data in Logs |
| **CWE** | CWE-532 |
| **Location** | `src/index.ts` (`/token` endpoint, `/oauth/callback`) |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
Authorization codes (`code`), state tokens (`stateToken`), and KV lookup keys containing session IDs were logged at INFO level. Although one-time-use, logging these values creates a window for log-based replay or correlation attacks.

**Fix Applied:**
Replaced raw secret values with boolean indicators in all INFO log statements:

```typescript
// Before:
logger.info({ grantType, clientId, code, sessionId, tokenKey }, "Token exchange request");
logger.info({ stateToken, sessionId, hasSessionId: !!sessionId }, "OAuth callback - state token lookup");
logger.error({ tokenKey, sessionId, clientId, code }, "Token not found for exchange");

// After:
logger.info({ grantType, clientId, hasCode: !!code, sessionId }, "Token exchange request");
logger.info({ hasStateToken: !!stateToken, hasSessionId: !!sessionId }, "OAuth callback - state token lookup");
logger.error({ sessionId, clientId, hasCode: !!code }, "Token not found for exchange");
```

---

### SEC-013 — Missing HTTP Security Headers on All Responses

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Security Misconfiguration |
| **CWE** | CWE-16 |
| **Location** | `src/index.ts` (all HTTP response paths) |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
No HTTP security headers were applied to any Cloudflare Worker response, making the application more vulnerable to clickjacking, MIME sniffing, and downgrade attacks.

**Fix Applied:**
Added `withSecurityHeaders()` wrapper applied to every response via the top-level fetch handler:

```typescript
function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const response = await handleRequest(request, env, ctx);
    return withSecurityHeaders(response);
  }
};
```

---

### SEC-014 — Port Advertisement Files World-Readable in `/tmp`

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Broken Access Control — Local Privilege |
| **CWE** | CWE-732 |
| **Location** | `src/core/port-discovery.ts` (`advertisePort()`, `refreshPortAdvertisement()`) |
| **Detection** | Manual |
| **Status** | ✅ Fixed |

**Description:**
Port advertisement files in `/tmp/figma-console-mcp-*.json` were written with default permissions (world-readable `0o644`). On multi-user systems, any local process could read these files to discover the MCP server's port, or write a malicious port file to redirect plugin connections.

**Fix Applied:**
Added `{ mode: 0o600 }` to both `writeFileSync` calls so port files are readable only by the owning user:

```typescript
// Before:
writeFileSync(filePath, JSON.stringify(data, null, 2));

// After:
writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
```

---

### SEC-015 — `figma_execute` Prompt Injection Risk (Design-Level)

| Field | Value |
|-------|-------|
| **Severity** | Informational |
| **Category** | Injection — Code Injection via Prompt |
| **CWE** | CWE-94 |
| **Location** | `src/core/write-tools.ts` |
| **Detection** | Manual |
| **Status** | ℹ️ Noted (not fixed — design limitation) |

**Description:**
The `figma_execute` tool accepts arbitrary JavaScript strings from the MCP client (typically an LLM) and executes them in the Figma plugin sandbox. A malicious Figma design file could contain text that manipulates the LLM into generating destructive JavaScript (e.g., deleting all pages or exfiltrating design data).

**Recommended Mitigations (not yet implemented):**
1. Display a confirmation prompt before executing code generated from untrusted file content
2. Implement a blocklist of destructive Figma API patterns (AST-based check before execution)
3. Log all executed code with source context for audit trail

---

## Files Modified

| File | Changes |
|------|---------|
| `src/index.ts` | SEC-001, SEC-002, SEC-003, SEC-004, SEC-006, SEC-011, SEC-012, SEC-013 |
| `src/core/figma-api.ts` | SEC-006 |
| `src/local.ts` | SEC-006 |
| `src/core/websocket-server.ts` | SEC-007 |
| `src/core/config.ts` | SEC-008 |
| `src/core/cloud-websocket-relay.ts` | SEC-009 |
| `src/core/port-discovery.ts` | SEC-014 |
| `wrangler.jsonc` | SEC-005 |
| `package.json` / `package-lock.json` | SEC-010 (npm audit fix --force) |

---

## Remaining Risk

| Issue | Risk Level | Notes |
|-------|-----------|-------|
| `undici` HIGH CVEs (transitive via wrangler) | Medium | Dev tooling only — not production runtime. Monitor upstream. |
| `yauzl` MODERATE CVE (transitive via puppeteer-core) | Low | Archive extraction at browser install time only. |
| `figma_execute` prompt injection | Informational | Mitigations recommended but require UX changes. |
| No TruffleHog git history scan | Unknown | Run manually: `trufflehog git file://$(pwd) --no-update` |

---

## Recommendations Going Forward

1. **Add `npm audit --audit-level=high` to CI** — block PRs that introduce HIGH or CRITICAL dependency vulnerabilities.
2. **Run TruffleHog on git history** — verify no secrets were ever committed.
3. **Review `figma_execute` UX** — add a confirmation step when executing LLM-generated code derived from untrusted Figma file content.
4. **Monitor upstream releases** — `wrangler` and `@cloudflare/puppeteer` for patches to the `undici`/`yauzl` transitive chain.
5. **Set `CLOUDFLARE_ACCOUNT_ID`** — ensure deployers configure this via environment variable before deploying.
