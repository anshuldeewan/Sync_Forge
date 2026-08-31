# Security Model & Hardening

Follows OWASP Top 10 prevention patterns.

## 1. Authentication & Tenant Isolation
- Firebase JWTs must be verified via `firebase-admin`.
- Every database query for a workspace resource MUST include `workspaceId` to prevent IDOR.

## 2. Input Validation
- All API inputs validated via Zod schemas.
- Reject unknown fields (`strict()` mode).

## 3. File Upload & Zip Slip Protection
- Strict MIME type and extension checking.
- When extracting ZIP files:
  - Calculate absolute paths.
  - Verify that the resolved path starts with the intended target directory.
  - Reject paths containing `../`.

## 4. Path Traversal
- File Explorer API endpoints must sanitize `filepath` parameters and restrict reads to the project's designated storage directory.

## 5. WebSockets
- WebSocket connections must authenticate by passing the Firebase token during the handshake.
- Disconnect unauthenticated sockets immediately.
- Enforce RBAC (EDITOR or higher) before allowing CRDT mutations.

## 6. Audit Logging
- Log security-sensitive actions (e.g., invites, role changes, deletions).
- Never include raw tokens, passwords, or PII in the `metadata` JSON field.
