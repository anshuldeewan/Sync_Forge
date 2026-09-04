import { Response } from 'express';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';
import { Role } from '@syncforge/db';
import { z } from 'zod';
import { AuditService, AuditEventAction } from '../services/audit';
const updateMemberSchema = z.object({
  role: z.nativeEnum(Role)
});

export const listMembers = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { q } = req.query;

    const whereClause: any = { workspaceId };
    
    if (q && typeof q === 'string') {
      whereClause.user = {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } }
        ]
      };
    }

    const members = await prisma.workspaceMember.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true
          }
        }
      }
    });

    res.json({ members });
  } catch (error) {
    console.error('Error listing members:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list members' } });
  }
};

export const updateMemberRole = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, userId } = req.params;
    const reqMember = req.workspaceMember!;

    const parsed = updateMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0].message } });
    }
    const newRole = parsed.data.role;

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });

    if (!targetMember) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Member not found' } });
    }

    // ADMIN cannot modify OWNER
    if (reqMember.role === Role.ADMIN && targetMember.role === Role.OWNER) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admins cannot modify Owners' } });
    }

    // ADMIN cannot grant OWNER
    if (reqMember.role === Role.ADMIN && newRole === Role.OWNER) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admins cannot grant Owner role' } });
    }

    // Protect last OWNER
    if (targetMember.role === Role.OWNER && newRole !== Role.OWNER) {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId, role: Role.OWNER }
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot demote the last owner' } });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const member = await tx.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId } },
        data: { role: newRole }
      });

      await AuditService.logEvent({
        workspaceId,
        userId: req.user!.id,
        action: AuditEventAction.MEMBER_ROLE_UPDATED,
        resource: userId,
        metadata: { userId, newRole }
      }, tx);

      return member;
    });

    res.json({ member: updated });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update member' } });
  }
};

export const removeMember = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, userId } = req.params;
    const reqMember = req.workspaceMember!;

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });

    if (!targetMember) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Member not found' } });
    }

    // ADMIN cannot remove OWNER
    if (reqMember.role === Role.ADMIN && targetMember.role === Role.OWNER) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admins cannot remove Owners' } });
    }

    // Protect last OWNER
    if (targetMember.role === Role.OWNER) {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId, role: Role.OWNER }
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot remove the last owner' } });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.delete({
        where: { workspaceId_userId: { workspaceId, userId } }
      });

      await AuditService.logEvent({
        workspaceId,
        userId: req.user!.id,
        action: AuditEventAction.MEMBER_REMOVED,
        resource: userId,
        metadata: { userId }
      }, tx);
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to remove member' } });
  }
};
