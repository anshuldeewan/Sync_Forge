# SyncForge - Production Specification

## Objective
To build a real-time collaborative engineering workspace for development teams, supporting robust RBAC, real-time document editing (CRDT), issue tracking, and code exploration.

## Core Features

1. **Authentication**
   - Firebase Authentication (Email/password, Google Sign-In).
   - Backend verification using Firebase Admin.
   - User synchronization with PostgreSQL.

2. **Workspace Management**
   - Create, Rename, Delete, Switch workspaces.
   - Strict tenant isolation between workspaces.

3. **RBAC**
   - Roles: OWNER, ADMIN, EDITOR, VIEWER.
   - Enforced completely server-side.

4. **Workspace Invitations**
   - Invite by email (start with copyable links, pending state).
   - Accept, decline, revoke, expiration.

5. **Project Management**
   - Create, rename, delete projects (atomic DB operations).
   - "Getting Started" page created automatically upon project creation.

6. **Page / Documentation System**
   - Nested hierarchy, empty states, Tiptap editor (rich text, code blocks).

7. **Real-Time Collaboration**
   - Yjs CRDT via WebSocket server.
   - Redis Pub/Sub for scaling.
   - PostgreSQL debounced persistence (NOT on every keystroke).

8. **Comments & Mentions**
   - Attached to documents, resolution state.
   - @mention workspace members (safe display names, no exposed UUIDs).

9. **Notifications & Issue Tracking**
   - In-app unread/read state.
   - Track issues (priority, status, assignee, link to code/files).

10. **Version History**
    - Document snapshots/revisions.
    - Restore capability without creating unnecessary duplicate revisions. Auditable.

11. **File Management & Code Explorer**
    - Zip upload/extraction (Zip Slip protection).
    - Syntax highlighting, code preview, snippet selection.
    - Issue creation from snippet.

12. **Demo Mode & Platform Admin**
    - Isolated recruiter/demo environment with dummy data.
    - PLATFORM_ADMIN dashboard for system health, user, workspace, and audit log management.

13. **Audit Logging**
    - Business event tracking (no sensitive secrets).

## Assumptions & Open Decisions
- We assume PostgreSQL is hosted externally in production (e.g., Supabase/RDS) and Redis via Elasticache/Upstash.
- We assume File Management will use local storage for development and S3 for production.
- Open Decision: How exactly should "Getting Started" page content be populated?
- Open Decision: Is WebSocket server part of the Express backend or a separate Node.js process? (Assuming part of Express for now).
