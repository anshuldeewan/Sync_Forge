import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import prisma from '@syncforge/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header.' } });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await auth.verifyIdToken(token);
    
    // Check if user exists in the database
    const dbUser = await prisma.user.findUnique({
      where: { id: decodedToken.uid }
    });
    
    if (!dbUser) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User record not found in database. Please sync.' } });
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token.' } });
  }
};
