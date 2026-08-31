# Implementation Plan

The rebuild is divided into independently verifiable phases.

## Phase 1: Foundation & Scaffolding
- **Goal:** Initialize Git, Docker Compose, Postgres, Redis, Express, and Next.js.
- **Verification:** Both servers start, DB connects.

## Phase 2: Database & ORM
- **Goal:** Prisma schema design, migrations, and seed scripts.
- **Verification:** DB schema matches `DATABASE.md`.

## Phase 3: Auth & Users
- **Goal:** Firebase Admin integration, `/api/auth/sync`, User synchronization.
- **Verification:** Login via frontend creates Postgres user.

## Phase 4: Workspace & RBAC
- **Goal:** Workspace creation, Member management, RBAC middleware.
- **Verification:** API tests for OWNER, ADMIN, EDITOR, VIEWER roles.

## Phase 5: Projects & File Infrastructure
- **Goal:** Project creation (with "Getting Started" page), File upload/extraction logic with Zip Slip protection.
- **Verification:** API tests for safe zip extraction.

## Phase 6: Pages & Yjs WebSockets
- **Goal:** Tiptap frontend, Yjs WebSocket server, Redis pub/sub, debounced DB persistence.
- **Verification:** Real-time sync across two browser tabs.

## Phase 7: Issues, Comments, & Mentions
- **Goal:** Issue tracking, comment threads, @mentions resolution.
- **Verification:** API tests for linking issues to code snippets.

## Phase 8: Version History & Audit Logging
- **Goal:** Snapshotting, Auditable restores.
- **Verification:** Restoring a version adds an audit log and updates content correctly.

## Phase 9: Demo Mode & Platform Admin
- **Goal:** Seed script for Demo Mode, Admin dashboard APIs.
- **Verification:** E2E Demo Mode test.

## Execution Rules
- **Cycle:** SPEC -> PLAN -> TEST -> IMPLEMENT -> TYPECHECK -> TEST -> BUILD -> BROWSER QA -> CODE REVIEW -> GIT COMMIT.
- **Git:** Commit after every successful phase.
