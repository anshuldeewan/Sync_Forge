import { Response } from 'express';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';
import { IssueStatus, IssuePriority } from '@prisma/client';
import { AuditService, AuditEventAction } from '../services/audit';

export const listIssues = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const issues = await prisma.issue.findMany({
      where: { projectId },
      include: {
        author: { select: { id: true, displayName: true } },
        assignee: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ issues });
  } catch (error) {
    console.error('Error listing issues:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch issues' } });
  }
};

export const getIssue = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { projectId, issueId } = req.params;

    const issue = await prisma.issue.findFirst({
      where: { id: issueId, projectId },
      include: {
        author: { select: { id: true, displayName: true } },
        assignee: { select: { id: true, displayName: true } },
      },
    });

    if (!issue) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Issue not found' } });
    }

    return res.json({ issue });
  } catch (error) {
    console.error('Error getting issue:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch issue' } });
  }
};

export const createIssue = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { title, description, assigneeId, status, priority, linkedSnippet } = req.body;
    const { workspaceId } = req.params; // from route params

    if (req.workspaceMember!.role === 'VIEWER') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Viewers cannot create issues.' } });
    }

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Title is required' } });
    }

    if (assigneeId) {
      const isMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: assigneeId } }
      });
      if (!isMember) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Assignee must be a workspace member' } });
      }
    }

    const issue = await prisma.$transaction(async (tx) => {
      const created = await tx.issue.create({
        data: {
          projectId,
          authorId: req.user!.id,
          assigneeId,
          title,
          description,
          status: status || 'OPEN',
          priority: priority || 'MEDIUM',
          linkedSnippet
        },
        include: {
          author: { select: { id: true, displayName: true } },
          assignee: { select: { id: true, displayName: true } },
        }
      });

      if (assigneeId && assigneeId !== req.user!.id) {
        await tx.notification.create({
          data: {
            userId: assigneeId,
            type: 'ISSUE_ASSIGNED',
            message: `You were assigned to issue "${created.title}"`
          }
        });
      }

      await AuditService.logEvent({
        workspaceId,
        userId: req.user!.id,
        action: AuditEventAction.ISSUE_CREATED,
        resource: created.id,
        metadata: { priority: created.priority, assigneeId: created.assigneeId }
      }, tx);

      return created;
    });

    return res.status(201).json({ issue });
  } catch (error) {
    console.error('Error creating issue:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create issue' } });
  }
};

export const updateIssue = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { projectId, issueId, workspaceId } = req.params;
    const { title, description, assigneeId, status, priority } = req.body;

    if (req.workspaceMember!.role === 'VIEWER') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Viewers cannot update issues.' } });
    }

    const issue = await prisma.issue.findFirst({
      where: { id: issueId, projectId }
    });

    if (!issue) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Issue not found' } });
    }

    if (assigneeId && assigneeId !== issue.assigneeId) {
      const isMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: assigneeId } }
      });
      if (!isMember) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Assignee must be a workspace member' } });
      }
    }

    const updated = await prisma.issue.update({
      where: { id: issueId },
      data: {
        title,
        description,
        assigneeId,
        status,
        priority
      },
      include: {
        author: { select: { id: true, displayName: true } },
        assignee: { select: { id: true, displayName: true } },
      }
    });

    if (assigneeId && assigneeId !== issue.assigneeId && assigneeId !== req.user!.id) {
      await prisma.notification.create({
        data: {
          userId: assigneeId,
          type: 'ISSUE_ASSIGNED',
          message: `You were assigned to issue "${updated.title}"`
        }
      });
    }

    return res.json({ issue: updated });
  } catch (error) {
    console.error('Error updating issue:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update issue' } });
  }
};

export const deleteIssue = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { projectId, issueId } = req.params;
    const role = req.workspaceMember!.role;

    const issue = await prisma.issue.findFirst({
      where: { id: issueId, projectId }
    });

    if (!issue) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Issue not found' } });
    }

    if (issue.authorId !== req.user!.id && !['OWNER', 'ADMIN'].includes(role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to delete this issue.' } });
    }

    await prisma.issue.delete({ where: { id: issueId } });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting issue:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete issue' } });
  }
};
