import { Prisma } from '@syncforge/db';
import prisma from '@syncforge/db';

export enum AuditEventAction {
  WORKSPACE_CREATED = 'WORKSPACE_CREATED',
  WORKSPACE_UPDATED = 'WORKSPACE_UPDATED',
  WORKSPACE_DELETED = 'WORKSPACE_DELETED',
  MEMBER_INVITED = 'MEMBER_INVITED',
  MEMBER_ROLE_UPDATED = 'MEMBER_ROLE_UPDATED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  PROJECT_CREATED = 'PROJECT_CREATED',
  PROJECT_DELETED = 'PROJECT_DELETED',
  RESOURCE_UPLOADED = 'RESOURCE_UPLOADED',
  RESOURCE_DELETED = 'RESOURCE_DELETED',
  ISSUE_CREATED = 'ISSUE_CREATED',
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'content',
  'filebuffer',
  'file',
]);

export interface LogAuditParams {
  workspaceId: string;
  userId: string;
  action: AuditEventAction;
  resource: string;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Sanitizes metadata by removing known sensitive fields.
   */
  static sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;
    
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        if (typeof value === 'object' && value !== null) {
          // Shallow sanitization for nested objects
          if (Array.isArray(value)) {
             sanitized[key] = value.map(v => typeof v === 'string' ? v : '[OBJECT OMITTED]');
          } else {
             sanitized[key] = '[OBJECT OMITTED]';
          }
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  }

  /**
   * Logs an audit event synchronously. Can participate in a Prisma transaction if the tx client is provided.
   */
  static async logEvent(
    params: LogAuditParams,
    txClient?: Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
  ): Promise<void> {
    const client = txClient || prisma;
    const sanitizedMetadata = AuditService.sanitizeMetadata(params.metadata);

    await client.auditLog.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        metadata: sanitizedMetadata ? (sanitizedMetadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }
}
