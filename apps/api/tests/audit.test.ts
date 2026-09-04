import { AuditService, AuditEventAction } from '../src/services/audit';
import prisma, { Prisma } from '@syncforge/db';

jest.mock('@syncforge/db', () => {
  const actual = jest.requireActual('@syncforge/db');
  return {
    ...actual,
    __esModule: true,
    default: {
      auditLog: {
        create: jest.fn(),
      },
    },
  };
});

describe('AuditService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sanitizeMetadata', () => {
    it('should return undefined if no metadata provided', () => {
      expect(AuditService.sanitizeMetadata()).toBeUndefined();
    });

    it('should pass through safe metadata', () => {
      const safe = { name: 'test', size: 100 };
      expect(AuditService.sanitizeMetadata(safe)).toEqual(safe);
    });

    it('should redact sensitive keys case-insensitively', () => {
      const sensitive = {
        password: 'my-password',
        Token: 'my-token',
        SECRET: 'my-secret',
        authorization: 'Bearer foo',
        content: 'sensitive file content',
        safeKey: 'safe-value'
      };
      
      const sanitized = AuditService.sanitizeMetadata(sensitive);
      
      expect(sanitized).toEqual({
        password: '[REDACTED]',
        Token: '[REDACTED]',
        SECRET: '[REDACTED]',
        authorization: '[REDACTED]',
        content: '[REDACTED]',
        safeKey: 'safe-value'
      });
    });

    it('should shallowly omit objects/arrays for non-sensitive keys to prevent deep nested logging', () => {
      const meta = {
        array: ['a', 'b'],
        obj: { nested: 'value' },
        normal: 'string'
      };

      const sanitized = AuditService.sanitizeMetadata(meta);
      expect(sanitized).toEqual({
        array: ['a', 'b'], // Array of strings is kept, based on our logic
        obj: '[OBJECT OMITTED]',
        normal: 'string'
      });
    });
  });

  describe('logEvent', () => {
    it('should log an event using the default prisma client', async () => {
      await AuditService.logEvent({
        workspaceId: 'ws-1',
        userId: 'user-1',
        action: AuditEventAction.WORKSPACE_CREATED,
        resource: 'ws-1',
        metadata: { name: 'New WS' }
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          userId: 'user-1',
          action: AuditEventAction.WORKSPACE_CREATED,
          resource: 'ws-1',
          metadata: { name: 'New WS' },
        }
      });
    });

    it('should log an event using a provided transaction client', async () => {
      const mockTxClient = {
        auditLog: {
          create: jest.fn().mockResolvedValue({})
        }
      };

      await AuditService.logEvent({
        workspaceId: 'ws-2',
        userId: 'user-2',
        action: AuditEventAction.PROJECT_CREATED,
        resource: 'proj-1'
      }, mockTxClient as any);

      expect(mockTxClient.auditLog.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-2',
          userId: 'user-2',
          action: AuditEventAction.PROJECT_CREATED,
          resource: 'proj-1',
          metadata: Prisma.JsonNull,
        }
      });
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
