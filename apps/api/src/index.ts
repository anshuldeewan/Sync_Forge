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
import { listMembers, updateMemberRole, removeMember } from './controllers/member';
import { requirePermission, WorkspaceAction } from './middleware/rbac';

// Workspace Routes
app.post('/api/workspaces', requireAuth, createWorkspace);
app.get('/api/workspaces', requireAuth, listWorkspaces);
app.get('/api/workspaces/:workspaceId', requireAuth, requirePermission(WorkspaceAction.READ_WORKSPACE), getWorkspace);
app.patch('/api/workspaces/:workspaceId', requireAuth, requirePermission(WorkspaceAction.UPDATE_WORKSPACE), updateWorkspace);
app.delete('/api/workspaces/:workspaceId', requireAuth, requirePermission(WorkspaceAction.DELETE_WORKSPACE), deleteWorkspace);

// Member Routes
app.get('/api/workspaces/:workspaceId/members', requireAuth, requirePermission(WorkspaceAction.READ_WORKSPACE), listMembers);
app.patch('/api/workspaces/:workspaceId/members/:userId', requireAuth, requirePermission(WorkspaceAction.MANAGE_MEMBERS), updateMemberRole);
app.delete('/api/workspaces/:workspaceId/members/:userId', requireAuth, requirePermission(WorkspaceAction.MANAGE_MEMBERS), removeMember);

import { createInvitation, listInvitations, revokeInvitation, acceptInvitation } from './controllers/invitation';

// Invitation Routes
app.post('/api/workspaces/:workspaceId/invitations', requireAuth, requirePermission(WorkspaceAction.MANAGE_INVITATIONS), createInvitation);
app.get('/api/workspaces/:workspaceId/invitations', requireAuth, requirePermission(WorkspaceAction.MANAGE_INVITATIONS), listInvitations);
app.delete('/api/workspaces/:workspaceId/invitations/:id', requireAuth, requirePermission(WorkspaceAction.MANAGE_INVITATIONS), revokeInvitation);
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
app.delete('/api/workspaces/:workspaceId/projects/:projectId', requireAuth, requirePermission(WorkspaceAction.MANAGE_PROJECTS), deleteProject);

// File Routes
app.post('/api/workspaces/:workspaceId/projects/:projectId/files', requireAuth, requirePermission(WorkspaceAction.MANAGE_FILES), upload.single('file'), uploadFile as any);
app.get('/api/workspaces/:workspaceId/projects/:projectId/files', requireAuth, requirePermission(WorkspaceAction.READ_FILES), listFiles);
app.get('/api/workspaces/:workspaceId/projects/:projectId/files/:fileId', requireAuth, requirePermission(WorkspaceAction.READ_FILES), downloadFile);
app.delete('/api/workspaces/:workspaceId/projects/:projectId/files/:fileId', requireAuth, requirePermission(WorkspaceAction.MANAGE_FILES), deleteFile);

import { createPage, listPages, getPage, updatePage, deletePage, getCollaborationToken } from './controllers/page';

// Page Routes
app.post('/api/workspaces/:workspaceId/projects/:projectId/pages', requireAuth, requirePermission(WorkspaceAction.MANAGE_PAGES), createPage);
app.get('/api/workspaces/:workspaceId/projects/:projectId/pages', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), listPages);
app.get('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), getPage);
app.patch('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId', requireAuth, requirePermission(WorkspaceAction.MANAGE_PAGES), updatePage);
app.delete('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId', requireAuth, requirePermission(WorkspaceAction.MANAGE_PAGES), deletePage);
app.get('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId/token', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), getCollaborationToken);


if (require.main === module) {
  app.listen(port, () => {
    console.log(`API Server listening on port ${port}`);
  });
}

export default app;
