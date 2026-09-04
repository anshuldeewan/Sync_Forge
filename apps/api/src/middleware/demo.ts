import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export const blockDemoDestructive = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.isDemo) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This operation is not permitted in Demo Mode.' } });
  }
  next();
};
