import { hasPermission, WorkspaceAction } from '../src/middleware/rbac';
import { Role } from '@syncforge/db';

describe('RBAC Permission Matrix', () => {
  // ── Workspace Deletion ────────────────────────────────────────────────
  describe('DELETE_WORKSPACE', () => {
    it('OWNER can delete workspace', () => {
      expect(hasPermission(Role.OWNER, WorkspaceAction.DELETE_WORKSPACE)).toBe(true);
    });
    it('ADMIN can delete workspace', () => {
      expect(hasPermission(Role.ADMIN, WorkspaceAction.DELETE_WORKSPACE)).toBe(true);
    });
    it('EDITOR cannot delete workspace', () => {
      expect(hasPermission(Role.EDITOR, WorkspaceAction.DELETE_WORKSPACE)).toBe(false);
    });
    it('VIEWER cannot delete workspace', () => {
      expect(hasPermission(Role.VIEWER, WorkspaceAction.DELETE_WORKSPACE)).toBe(false);
    });
  });

  // ── Project Deletion ──────────────────────────────────────────────────
  describe('DELETE_PROJECT', () => {
    it('OWNER can delete project', () => {
      expect(hasPermission(Role.OWNER, WorkspaceAction.DELETE_PROJECT)).toBe(true);
    });
    it('ADMIN can delete project', () => {
      expect(hasPermission(Role.ADMIN, WorkspaceAction.DELETE_PROJECT)).toBe(true);
    });
    it('EDITOR cannot delete project', () => {
      expect(hasPermission(Role.EDITOR, WorkspaceAction.DELETE_PROJECT)).toBe(false);
    });
    it('VIEWER cannot delete project', () => {
      expect(hasPermission(Role.VIEWER, WorkspaceAction.DELETE_PROJECT)).toBe(false);
    });
  });

  // ── Full permission matrix spot-checks ───────────────────────────────
  it('OWNER has full management access', () => {
    expect(hasPermission(Role.OWNER, WorkspaceAction.UPDATE_WORKSPACE)).toBe(true);
    expect(hasPermission(Role.OWNER, WorkspaceAction.READ_WORKSPACE)).toBe(true);
    expect(hasPermission(Role.OWNER, WorkspaceAction.MANAGE_MEMBERS)).toBe(true);
    expect(hasPermission(Role.OWNER, WorkspaceAction.MANAGE_INVITATIONS)).toBe(true);
    expect(hasPermission(Role.OWNER, WorkspaceAction.MANAGE_PROJECTS)).toBe(true);
    expect(hasPermission(Role.OWNER, WorkspaceAction.READ_PROJECTS)).toBe(true);
  });

  it('ADMIN has full management access plus deletion', () => {
    expect(hasPermission(Role.ADMIN, WorkspaceAction.UPDATE_WORKSPACE)).toBe(true);
    expect(hasPermission(Role.ADMIN, WorkspaceAction.MANAGE_MEMBERS)).toBe(true);
    expect(hasPermission(Role.ADMIN, WorkspaceAction.MANAGE_PROJECTS)).toBe(true);
  });

  it('EDITOR has project/file/page access but no member management or deletion', () => {
    expect(hasPermission(Role.EDITOR, WorkspaceAction.MANAGE_MEMBERS)).toBe(false);
    expect(hasPermission(Role.EDITOR, WorkspaceAction.MANAGE_INVITATIONS)).toBe(false);
    expect(hasPermission(Role.EDITOR, WorkspaceAction.UPDATE_WORKSPACE)).toBe(false);
    expect(hasPermission(Role.EDITOR, WorkspaceAction.MANAGE_PROJECTS)).toBe(true);
    expect(hasPermission(Role.EDITOR, WorkspaceAction.READ_PROJECTS)).toBe(true);
  });

  it('VIEWER has only read access', () => {
    expect(hasPermission(Role.VIEWER, WorkspaceAction.MANAGE_PROJECTS)).toBe(false);
    expect(hasPermission(Role.VIEWER, WorkspaceAction.UPDATE_WORKSPACE)).toBe(false);
    expect(hasPermission(Role.VIEWER, WorkspaceAction.READ_PROJECTS)).toBe(true);
    expect(hasPermission(Role.VIEWER, WorkspaceAction.READ_WORKSPACE)).toBe(true);
    expect(hasPermission(Role.VIEWER, WorkspaceAction.READ_FILES)).toBe(true);
    expect(hasPermission(Role.VIEWER, WorkspaceAction.READ_PAGES)).toBe(true);
  });
});
