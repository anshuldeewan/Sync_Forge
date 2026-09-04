import jwt from 'jsonwebtoken';
import { parse } from 'url';

const JWT_SECRET = process.env.JWT_SECRET || 'syncforge_super_secret_for_collaboration_only';

export interface CollaborationTokenPayload {
  userId: string;
  workspaceId: string;
  projectId: string;
  pageId?: string;
  resourceId?: string;
  role: string;
  purpose: string;
  iat?: number;
  exp?: number;
}

export function verifyCollaborationToken(req: any): CollaborationTokenPayload | null {
  let token: string | undefined;
  try {
    const url = parse(req.url, true);
    token = url.query.token as string;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as CollaborationTokenPayload;

    if (decoded.purpose !== 'collaboration') {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error, 'Secret used:', JWT_SECRET.substring(0, 5) + '...', 'Token:', token?.substring(0, 10));
    // Return null if signature is invalid, token expired, etc.
    return null;
  }
}
