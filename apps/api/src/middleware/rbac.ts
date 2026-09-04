import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import prisma from '@syncforge/db';
import { Role } from '@syncforge/db';

export enum WorkspaceAction {
  UPDATE_WORKSPACE = 'UPDATE_WORKSPACE',
  DELETE_WORKSPACE = 'DELETE_WORKSPACE',
  READ_WORKSPACE = 'READ_WORKSPACE',
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  MANAGE_INVITATIONS = 'MANAGE_INVITATIONS',
  MANAGE_PROJECTS = 'MANAGE_PROJECTS',
  DELETE_PROJECT = 'DELETE_PROJECT',
  READ_PROJECTS = 'READ_PROJECTS',
  MANAGE_FILES = 'MANAGE_FILES',
  READ_FILES = 'READ_FILES',
  MANAGE_PAGES = 'MANAGE_PAGES',
  READ_PAGES = 'READ_PAGES',
  READ_AUDIT_LOGS = 'READ_AUDIT_LOGS'
}

const RolePermissions: Record<Role, WorkspaceAction[]> = {
  [Role.OWNER]: [
    WorkspaceAction.UPDATE_WORKSPACE,
    WorkspaceAction.DELETE_WORKSPACE,
    WorkspaceAction.READ_WORKSPACE,
    WorkspaceAction.MANAGE_MEMBERS,
    WorkspaceAction.MANAGE_INVITATIONS,
    WorkspaceAction.MANAGE_PROJECTS,
    WorkspaceAction.DELETE_PROJECT,
    WorkspaceAction.READ_PROJECTS,
    WorkspaceAction.MANAGE_FILES,
    WorkspaceAction.READ_FILES,
    WorkspaceAction.MANAGE_PAGES,
    WorkspaceAction.READ_PAGES,
    WorkspaceAction.READ_AUDIT_LOGS,
  ],
  [Role.ADMIN]: [
    WorkspaceAction.UPDATE_WORKSPACE,
    WorkspaceAction.DELETE_WORKSPACE,
    WorkspaceAction.READ_WORKSPACE,
    WorkspaceAction.MANAGE_MEMBERS,
    WorkspaceAction.MANAGE_INVITATIONS,
    WorkspaceAction.MANAGE_PROJECTS,
    WorkspaceAction.DELETE_PROJECT,
    WorkspaceAction.READ_PROJECTS,
    WorkspaceAction.MANAGE_FILES,
    WorkspaceAction.READ_FILES,
    WorkspaceAction.MANAGE_PAGES,
    WorkspaceAction.READ_PAGES,
    WorkspaceAction.READ_AUDIT_LOGS,
  ],
  [Role.EDITOR]: [
    WorkspaceAction.READ_WORKSPACE,
    WorkspaceAction.MANAGE_PROJECTS,
    WorkspaceAction.READ_PROJECTS,
    WorkspaceAction.MANAGE_FILES,
    WorkspaceAction.READ_FILES,
    WorkspaceAction.MANAGE_PAGES,
    WorkspaceAction.READ_PAGES,
  ],
  [Role.VIEWER]: [
    WorkspaceAction.READ_WORKSPACE,
    WorkspaceAction.READ_PROJECTS,
    WorkspaceAction.READ_FILES,
    WorkspaceAction.READ_PAGES,
  ]
};

export const hasPermission = (role: Role, action: WorkspaceAction): boolean => {
  return RolePermissions[role].includes(action);
};

export interface AuthorizedRequest extends AuthenticatedRequest {
  workspaceMember?: {
    workspaceId: string;
    userId: string;
    role: Role;
  };
}

export const requirePermission = (action: WorkspaceAction) => {
  return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } });
    }

    // Attempt to extract workspaceId from params, then body, then query
    const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
    if (!workspaceId || typeof workspaceId !== 'string') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing workspaceId.' } });
    }

    try {
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: user.id
          }
        },
        include: {
          workspace: true
        }
      });

      if (!member || member.workspace.isDeleted) {
        // Return 404 to avoid leaking existence of a workspace the user doesn't belong to
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workspace not found.' } });
      }

      if (!hasPermission(member.role, action)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions.' } });
      }

      req.workspaceMember = {
        workspaceId: member.workspaceId,
        userId: member.userId,
        role: member.role
      };

      next();
    } catch (error) {
      console.error('RBAC Error:', error);
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred during authorization.' } });
    }
  };
};
