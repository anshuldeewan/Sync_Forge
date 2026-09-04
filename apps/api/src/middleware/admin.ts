import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export const requirePlatformAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } });
  }

  if (user.isDemo) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Demo users cannot access platform administration APIs.' } });
  }

  if (!user.isPlatformAdmin) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions. Platform Admin required.' } });
  }

  next();
};
