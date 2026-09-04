import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '@syncforge/db';
import { Role } from '@syncforge/db';
import { AuditService, AuditEventAction } from '../services/audit';

export const provisionDemo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isDemoMode = process.env.DEMO_MODE === 'true';
    if (!isDemoMode) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Demo mode is not enabled.' } });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } });
    }

    if (!user.isDemo) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only demo users can provision a demo workspace.' } });
    }

    // Check if the user already has a workspace to make it idempotent
    const existingMembership = await prisma.workspaceMember.findFirst({
      where: {
        userId: user.id,
        role: Role.OWNER,
        workspace: { isDeleted: false }
      },
      include: { workspace: true }
    });

    if (existingMembership) {
      return res.json({ workspace: existingMembership.workspace, message: 'Existing demo workspace found.' });
    }

    // Provision a new isolated sandbox
    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: `${user.displayName}'s Sandbox`,
          members: {
            create: {
              userId: user.id,
              role: Role.OWNER
            }
          }
        }
      });

      // Seed a project and some demo data
      const project = await tx.project.create({
        data: {
          workspaceId: workspace.id,
          name: 'Demo Project',
        }
      });

      const resource = await tx.resource.create({
        data: {
          projectId: project.id,
          name: 'Welcome to SyncForge',
          type: 'PAGE',
          createdBy: user.id,
        }
      });

      const page = await tx.page.create({
        data: {
          projectId: project.id,
          resourceId: resource.id,
          title: 'Welcome to SyncForge',
        }
      });

      await AuditService.logEvent({
        workspaceId: workspace.id,
        userId: user.id,
        action: AuditEventAction.WORKSPACE_CREATED,
        resource: workspace.id,
        metadata: { demoProvisioned: true }
      }, tx as any);

      return workspace;
    });

    return res.status(201).json({ workspace: result, message: 'Demo workspace provisioned successfully.' });

  } catch (error) {
    console.error('Error provisioning demo:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to provision demo workspace.' } });
  }
};
