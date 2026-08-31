import { Request, Response } from 'express';
import { auth } from '../config/firebase';
import prisma from '@syncforge/db';

export const syncUser = async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header.' } });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await auth.verifyIdToken(token);
    
    if (!decodedToken.email) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Token does not contain an email address.' } });
    }

    const dbUser = await prisma.user.upsert({
      where: { id: decodedToken.uid },
      update: {
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.email.split('@')[0],
      },
      create: {
        id: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.email.split('@')[0],
      }
    });

    return res.status(200).json({ user: dbUser });
  } catch (error: any) {
    console.error('Token verification or sync failed:', error);
    
    // Check if it's a Prisma error or Firebase error
    if (error.code && typeof error.code === 'string' && error.code.startsWith('auth/')) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token.', details: error.message } });
    }
    
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred during user sync.' } });
  }
};
