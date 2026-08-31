# API Architecture

Uses Express.js with a layered architecture: Controllers, Services, and Repositories.

## Middleware
1. `authMiddleware`: Verifies Firebase JWT, attaches `req.user`.
2. `workspaceResolver`: Extracts `workspaceId` from params/headers, validates membership.
3. `rbacMiddleware(roles)`: Ensures `req.user` has one of the allowed roles in the workspace.

## Key Endpoints

### Auth
- `POST /api/auth/sync` - Syncs Firebase user to Postgres.

### Workspace
- `POST /api/workspaces` - Create (User becomes OWNER).
- `GET /api/workspaces` - List user's workspaces.
- `GET /api/workspaces/:workspaceId` - Details (requires membership).

### Invitations
- `POST /api/workspaces/:workspaceId/invites` (ADMIN/OWNER).
- `POST /api/invites/accept` (Requires token).

### Projects & Pages
- `POST /api/workspaces/:workspaceId/projects`
- `GET /api/workspaces/:workspaceId/projects/:projectId/pages`

### Admin
- `GET /api/admin/health`
- `GET /api/admin/users`
- All `/api/admin/*` paths require `isPlatformAdmin === true`.

## Error Handling
Standardized JSON error responses:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions to delete project."
  }
}
```
