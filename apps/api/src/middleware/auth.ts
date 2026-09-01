import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import prisma from '@syncforge/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    displayName: string;
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
    
    let dbUser = await prisma.user.findUnique({
      where: { id: decodedToken.uid }
    });
    
    if (!dbUser) {
      if (!decodedToken.email) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Firebase token missing email.' } });
      }
      
      // Auto-synchronize Firebase user to Database
      dbUser = await prisma.user.create({
        data: {
          id: decodedToken.uid,
          email: decodedToken.email,
          displayName: decodedToken.name || decodedToken.email.split('@')[0],
        }
      });
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.displayName
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token.' } });
  }
};
