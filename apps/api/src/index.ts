import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

import { syncUser } from './controllers/auth';
import { requireAuth } from './middleware/auth';

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SyncForge API' });
});

app.post('/api/auth/sync', syncUser);

// Example protected route
app.get('/api/protected', requireAuth, (req: any, res: any) => {
  res.json({ status: 'ok', user: req.user });
});

import { createWorkspace, listWorkspaces, getWorkspace, updateWorkspace, deleteWorkspace } from './controllers/workspace';
import { listWorkspaceAuditLogs } from './controllers/audit';
import { listGlobalUsers, listGlobalWorkspaces, listGlobalAuditLogs, getSystemStats } from './controllers/admin';
import { listMembers, updateMemberRole, removeMember } from './controllers/member';
import { requirePermission, WorkspaceAction } from './middleware/rbac';
import { requirePlatformAdmin } from './middleware/admin';
import { blockDemoDestructive } from './middleware/demo';
import { provisionDemo } from './controllers/demo';

// Workspace Routes
app.post('/api/workspaces', requireAuth, createWorkspace);
app.get('/api/workspaces', requireAuth, listWorkspaces);
app.get('/api/workspaces/:workspaceId', requireAuth, requirePermission(WorkspaceAction.READ_WORKSPACE), getWorkspace);
app.patch('/api/workspaces/:workspaceId', requireAuth, requirePermission(WorkspaceAction.UPDATE_WORKSPACE), updateWorkspace);
app.delete('/api/workspaces/:workspaceId', requireAuth, blockDemoDestructive, requirePermission(WorkspaceAction.DELETE_WORKSPACE), deleteWorkspace);
app.get('/api/workspaces/:workspaceId/audit', requireAuth, requirePermission(WorkspaceAction.READ_AUDIT_LOGS), listWorkspaceAuditLogs);

// Member Routes
app.get('/api/workspaces/:workspaceId/members', requireAuth, requirePermission(WorkspaceAction.READ_WORKSPACE), listMembers);
app.patch('/api/workspaces/:workspaceId/members/:userId', requireAuth, blockDemoDestructive, requirePermission(WorkspaceAction.MANAGE_MEMBERS), updateMemberRole);
app.delete('/api/workspaces/:workspaceId/members/:userId', requireAuth, blockDemoDestructive, requirePermission(WorkspaceAction.MANAGE_MEMBERS), removeMember);

import { createInvitation, listInvitations, revokeInvitation, acceptInvitation } from './controllers/invitation';

// Invitation Routes
app.post('/api/workspaces/:workspaceId/invitations', requireAuth, blockDemoDestructive, requirePermission(WorkspaceAction.MANAGE_INVITATIONS), createInvitation);
app.get('/api/workspaces/:workspaceId/invitations', requireAuth, requirePermission(WorkspaceAction.MANAGE_INVITATIONS), listInvitations);
app.delete('/api/workspaces/:workspaceId/invitations/:id', requireAuth, blockDemoDestructive, requirePermission(WorkspaceAction.MANAGE_INVITATIONS), revokeInvitation);
app.post('/api/invitations/accept', requireAuth, acceptInvitation);

import { createProject, listProjects, getProject, updateProject, deleteProject } from './controllers/project';
import multer from 'multer';
import { uploadFile, listFiles, downloadFile, deleteFile } from './controllers/file';

const upload = multer({ storage: multer.memoryStorage() });

// Project Routes
app.post('/api/workspaces/:workspaceId/projects', requireAuth, requirePermission(WorkspaceAction.MANAGE_PROJECTS), createProject);
app.get('/api/workspaces/:workspaceId/projects', requireAuth, requirePermission(WorkspaceAction.READ_PROJECTS), listProjects);
app.get('/api/workspaces/:workspaceId/projects/:projectId', requireAuth, requirePermission(WorkspaceAction.READ_PROJECTS), getProject);
app.patch('/api/workspaces/:workspaceId/projects/:projectId', requireAuth, requirePermission(WorkspaceAction.MANAGE_PROJECTS), updateProject);
app.delete('/api/workspaces/:workspaceId/projects/:projectId', requireAuth, requirePermission(WorkspaceAction.DELETE_PROJECT), deleteProject);

import { listResources, createResource, updateResource, deleteResource, getCollaborationToken as getResourceToken } from './controllers/resource';
import { safeUploadResource, downloadResource } from './controllers/resourceUpload';

// Resource Routes
app.get('/api/workspaces/:workspaceId/projects/:projectId/resources', requireAuth, requirePermission(WorkspaceAction.READ_PROJECTS), listResources);
app.post('/api/workspaces/:workspaceId/projects/:projectId/resources', requireAuth, requirePermission(WorkspaceAction.MANAGE_PROJECTS), createResource);
app.patch('/api/workspaces/:workspaceId/projects/:projectId/resources/:id', requireAuth, requirePermission(WorkspaceAction.MANAGE_PROJECTS), updateResource);
app.delete('/api/workspaces/:workspaceId/projects/:projectId/resources/:id', requireAuth, requirePermission(WorkspaceAction.MANAGE_PROJECTS), deleteResource);
app.get('/api/workspaces/:workspaceId/projects/:projectId/resources/:id/token', requireAuth, requirePermission(WorkspaceAction.READ_PROJECTS), getResourceToken);

import { listRevisions, getRevision, restoreRevision, createRevision } from './controllers/revision';

// Revision Routes
app.get('/api/workspaces/:workspaceId/projects/:projectId/resources/:resourceId/revisions', requireAuth, requirePermission(WorkspaceAction.READ_PROJECTS), listRevisions);
app.post('/api/workspaces/:workspaceId/projects/:projectId/resources/:resourceId/revisions', requireAuth, requirePermission(WorkspaceAction.MANAGE_PROJECTS), createRevision);
app.get('/api/workspaces/:workspaceId/projects/:projectId/resources/:resourceId/revisions/:versionId', requireAuth, requirePermission(WorkspaceAction.READ_PROJECTS), getRevision);
app.post('/api/workspaces/:workspaceId/projects/:projectId/resources/:resourceId/revisions/:versionId/restore', requireAuth, requirePermission(WorkspaceAction.MANAGE_PROJECTS), restoreRevision);

// Resource File Upload/Download
app.post('/api/workspaces/:workspaceId/projects/:projectId/resources/upload', requireAuth, requirePermission(WorkspaceAction.MANAGE_FILES), upload.single('file'), safeUploadResource as any);
app.post('/api/workspaces/:workspaceId/projects/:projectId/resources/:parentId/upload', requireAuth, requirePermission(WorkspaceAction.MANAGE_FILES), upload.single('file'), safeUploadResource as any);
app.get('/api/workspaces/:workspaceId/projects/:projectId/resources/:resourceId/download', requireAuth, requirePermission(WorkspaceAction.READ_FILES), downloadResource as any);

// File Routes
app.post('/api/workspaces/:workspaceId/projects/:projectId/files', requireAuth, requirePermission(WorkspaceAction.MANAGE_FILES), upload.single('file'), uploadFile as any);
app.get('/api/workspaces/:workspaceId/projects/:projectId/files', requireAuth, requirePermission(WorkspaceAction.READ_FILES), listFiles);
app.get('/api/workspaces/:workspaceId/projects/:projectId/files/:fileId', requireAuth, requirePermission(WorkspaceAction.READ_FILES), downloadFile);
app.delete('/api/workspaces/:workspaceId/projects/:projectId/files/:fileId', requireAuth, requirePermission(WorkspaceAction.MANAGE_FILES), deleteFile);

import { createPage, listPages, getPage, updatePage, deletePage, getCollaborationToken } from './controllers/page';
import { listComments, createComment, updateComment, deleteComment } from './controllers/comment';

// Page Routes
app.post('/api/workspaces/:workspaceId/projects/:projectId/pages', requireAuth, requirePermission(WorkspaceAction.MANAGE_PAGES), createPage);
app.get('/api/workspaces/:workspaceId/projects/:projectId/pages', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), listPages);
app.get('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), getPage);
app.patch('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId', requireAuth, requirePermission(WorkspaceAction.MANAGE_PAGES), updatePage);
app.delete('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId', requireAuth, requirePermission(WorkspaceAction.MANAGE_PAGES), deletePage);
app.get('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId/token', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), getCollaborationToken);

// Comment Routes
app.get('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId/comments', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), listComments);
app.post('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId/comments', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), createComment);
app.patch('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId/comments/:commentId', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), updateComment);
app.delete('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId/comments/:commentId', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), deleteComment);

import { listIssues, createIssue, getIssue, updateIssue, deleteIssue } from './controllers/issue';

// Issue Routes
app.get('/api/workspaces/:workspaceId/projects/:projectId/issues', requireAuth, requirePermission(WorkspaceAction.READ_PROJECTS), listIssues);
app.post('/api/workspaces/:workspaceId/projects/:projectId/issues', requireAuth, requirePermission(WorkspaceAction.MANAGE_PROJECTS), createIssue);
app.get('/api/workspaces/:workspaceId/projects/:projectId/issues/:issueId', requireAuth, requirePermission(WorkspaceAction.READ_PROJECTS), getIssue);
app.patch('/api/workspaces/:workspaceId/projects/:projectId/issues/:issueId', requireAuth, requirePermission(WorkspaceAction.MANAGE_PROJECTS), updateIssue);
app.delete('/api/workspaces/:workspaceId/projects/:projectId/issues/:issueId', requireAuth, requirePermission(WorkspaceAction.MANAGE_PROJECTS), deleteIssue);

import { listNotifications, markNotificationRead, markAllNotificationsRead } from './controllers/notification';

// Notification Routes
app.get('/api/notifications', requireAuth, listNotifications);
app.patch('/api/notifications/read-all', requireAuth, markAllNotificationsRead);
app.patch('/api/notifications/:id/read', requireAuth, markNotificationRead);


// Admin Routes
app.get('/api/admin/users', requireAuth, requirePlatformAdmin, listGlobalUsers);
app.get('/api/admin/workspaces', requireAuth, requirePlatformAdmin, listGlobalWorkspaces);
app.get('/api/admin/audit', requireAuth, requirePlatformAdmin, listGlobalAuditLogs);
app.get('/api/admin/stats', requireAuth, requirePlatformAdmin, getSystemStats);

// Demo Routes
app.post('/api/demo/provision', requireAuth, provisionDemo);

// Fallback error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`API Server listening on port ${port}`);
  });
}

export default app;
