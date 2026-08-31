import { hasPermission, WorkspaceAction } from '../src/middleware/rbac';
import { Role } from '@syncforge/db';

describe('RBAC Permission Matrix', () => {
  it('OWNER should have full access', () => {
    expect(hasPermission(Role.OWNER, WorkspaceAction.UPDATE_WORKSPACE)).toBe(true);
    expect(hasPermission(Role.OWNER, WorkspaceAction.DELETE_WORKSPACE)).toBe(true);
    expect(hasPermission(Role.OWNER, WorkspaceAction.READ_WORKSPACE)).toBe(true);
    expect(hasPermission(Role.OWNER, WorkspaceAction.MANAGE_MEMBERS)).toBe(true);
    expect(hasPermission(Role.OWNER, WorkspaceAction.MANAGE_INVITATIONS)).toBe(true);
    expect(hasPermission(Role.OWNER, WorkspaceAction.MANAGE_PROJECTS)).toBe(true);
    expect(hasPermission(Role.OWNER, WorkspaceAction.READ_PROJECTS)).toBe(true);
  });

  it('ADMIN should have management access but cannot delete workspace', () => {
    expect(hasPermission(Role.ADMIN, WorkspaceAction.DELETE_WORKSPACE)).toBe(false);
    expect(hasPermission(Role.ADMIN, WorkspaceAction.UPDATE_WORKSPACE)).toBe(true);
    expect(hasPermission(Role.ADMIN, WorkspaceAction.MANAGE_MEMBERS)).toBe(true);
  });

  it('EDITOR should have project access but no member management', () => {
    expect(hasPermission(Role.EDITOR, WorkspaceAction.MANAGE_MEMBERS)).toBe(false);
    expect(hasPermission(Role.EDITOR, WorkspaceAction.MANAGE_INVITATIONS)).toBe(false);
    expect(hasPermission(Role.EDITOR, WorkspaceAction.UPDATE_WORKSPACE)).toBe(false);
    expect(hasPermission(Role.EDITOR, WorkspaceAction.MANAGE_PROJECTS)).toBe(true);
    expect(hasPermission(Role.EDITOR, WorkspaceAction.READ_PROJECTS)).toBe(true);
  });

  it('VIEWER should have only read access', () => {
    expect(hasPermission(Role.VIEWER, WorkspaceAction.MANAGE_PROJECTS)).toBe(false);
    expect(hasPermission(Role.VIEWER, WorkspaceAction.READ_PROJECTS)).toBe(true);
    expect(hasPermission(Role.VIEWER, WorkspaceAction.READ_WORKSPACE)).toBe(true);
  });
});
