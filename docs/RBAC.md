# Role-Based Access Control (RBAC)

RBAC is enforced strictly on the backend via Express middleware.

## Roles & Permissions

| Action | OWNER | ADMIN | EDITOR | VIEWER |
| :--- | :---: | :---: | :---: | :---: |
| **View Workspace/Projects/Pages** | ✅ | ✅ | ✅ | ✅ |
| **Comment** | ✅ | ✅ | ✅ | ✅ |
| **Create/Edit/Delete Pages** | ✅ | ✅ | ✅ | ❌ |
| **Upload Files** | ✅ | ✅ | ✅ | ❌ |
| **Manage Issues** | ✅ | ✅ | ✅ | ❌ |
| **Create/Rename/Delete Projects**| ✅ | ✅ | ❌ | ❌ |
| **Invite Members** | ✅ | ✅ | ❌ | ❌ |
| **Change Member Roles** | ✅ | ✅ | ❌ | ❌ |
| **Remove Members** | ✅ | ✅ | ❌ | ❌ |
| **Delete/Rename Workspace** | ✅ | ❌ | ❌ | ❌ |
| **Change Billing (Future)** | ✅ | ❌ | ❌ | ❌ |

*(Note: Admin cannot remove the Owner or change Owner's role).*

## Platform Admin
- Completely separate boolean flag on the User model (`isPlatformAdmin`).
- Can view aggregate stats, suspend users, and view audit logs globally.
- Cannot impersonate users or bypass workspace encryption (if implemented later).
