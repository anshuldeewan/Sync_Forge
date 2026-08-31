# Database Schema

Uses PostgreSQL + Prisma. 

## Core Entities

1. **User**
   - `id` (String, PK - maps to Firebase UID)
   - `email` (String, Unique)
   - `displayName` (String)
   - `createdAt`, `updatedAt`
   - `isPlatformAdmin` (Boolean)

2. **Workspace**
   - `id` (String, PK, UUID)
   - `name` (String)
   - `createdAt`, `updatedAt`

3. **WorkspaceMember**
   - Composite PK (`userId`, `workspaceId`)
   - `role` (Enum: OWNER, ADMIN, EDITOR, VIEWER)

4. **WorkspaceInvitation**
   - `id` (String, PK)
   - `workspaceId` (FK)
   - `email` (String)
   - `token` (String, Unique, Secure)
   - `role` (Enum)
   - `expiresAt` (DateTime)

5. **Project**
   - `id` (String, PK)
   - `workspaceId` (FK, indexed for tenant isolation)
   - `name` (String)

6. **Page**
   - `id` (String, PK)
   - `projectId` (FK)
   - `parentId` (FK, nullable for nested hierarchy)
   - `title` (String)
   - `content` (Json/Bytes for Y.Doc state)

7. **Revision (Version History)**
   - `id`, `pageId`, `authorId`, `contentSnapshot`, `createdAt`

8. **Comment / Mention / Issue / FileAsset / Notification / AuditLog**
   - All standard relational models linking back to Workspace/Project for isolation.

## Security & Isolation
- All tables belonging to a workspace must be easily queried by `workspaceId` to enforce tenant isolation.
- `AuditLog` captures user actions without storing secrets.
- Use soft deletion for Projects and Workspaces to prevent accidental data loss.
