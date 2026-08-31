import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';
import { Role, InvitationStatus } from '@syncforge/db';
import { z } from 'zod';
import crypto from 'crypto';

const createInvitationSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: z.nativeEnum(Role).refine((r) => r !== Role.OWNER, {
    message: 'Cannot invite a user as OWNER'
  })
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required')
});

export const createInvitation = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const parsed = createInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0].message } });
    }

    const { email, role } = parsed.data;

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const isMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } }
      });
      if (isMember) {
        return res.status(409).json({ error: { code: 'CONFLICT', message: 'User is already a member of this workspace' } });
      }
    }

    // Check for existing pending invitation
    const pendingInvite = await prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() }
      }
    });

    if (pendingInvite) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'A pending invitation already exists for this email' } });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role,
        token,
        expiresAt,
        status: InvitationStatus.PENDING
      }
    });

    // Provide safe URL in response
    const inviteUrl = `http://localhost:3000/invite/${token}`;

    res.status(201).json({ invitation, inviteUrl });
  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create invitation' } });
  }
};

export const listInvitations = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const invitations = await prisma.workspaceInvitation.findMany({
      where: {
        workspaceId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ invitations });
  } catch (error) {
    console.error('Error listing invitations:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list invitations' } });
  }
};

export const revokeInvitation = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, id } = req.params;

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id }
    });

    if (!invitation || invitation.workspaceId !== workspaceId) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invitation not found' } });
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Only pending invitations can be revoked' } });
    }

    await prisma.workspaceInvitation.update({
      where: { id },
      data: { status: InvitationStatus.REVOKED }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking invitation:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke invitation' } });
  }
};

export const acceptInvitation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });

    const parsed = acceptInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0].message } });
    }

    const { token } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const invitation = await tx.workspaceInvitation.findUnique({
        where: { token },
        include: { workspace: true }
      });

      if (!invitation) {
        throw new Error('NOT_FOUND');
      }

      if (invitation.status !== InvitationStatus.PENDING || invitation.expiresAt < new Date()) {
        throw new Error('EXPIRED');
      }

      if (invitation.email !== req.user!.email) {
        throw new Error('EMAIL_MISMATCH');
      }

      // Check if already a member
      const existingMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: req.user!.id
          }
        }
      });

      if (existingMember) {
        throw new Error('ALREADY_MEMBER');
      }

      // Consume invitation
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED }
      });

      // Create membership
      const membership = await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: req.user!.id,
          role: invitation.role
        }
      });

      return membership;
    });

    res.json({ success: true, workspaceId: result.workspaceId });
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invitation not found' } });
    }
    if (error.message === 'EXPIRED') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invitation is expired or already used' } });
    }
    if (error.message === 'EMAIL_MISMATCH') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This invitation is for a different email address' } });
    }
    if (error.message === 'ALREADY_MEMBER') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'You are already a member of this workspace' } });
    }

    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to accept invitation' } });
  }
};
