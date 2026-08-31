import request from 'supertest';
import app from '../src/index';
import { auth } from '../src/config/firebase';
import prisma from '@syncforge/db';

jest.mock('../src/config/firebase', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
}));

jest.mock('@syncforge/db', () => ({
  user: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
}));

describe('Auth Endpoints & Middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Middleware (requireAuth)', () => {
    it('should return 401 for missing Authorization header', async () => {
      const res = await request(app).get('/api/protected');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Missing or invalid authorization header.');
    });

    it('should return 401 for invalid Bearer token format', async () => {
      const res = await request(app).get('/api/protected').set('Authorization', 'InvalidToken');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Missing or invalid authorization header.');
    });

    it('should return 401 if Firebase verification fails', async () => {
      (auth.verifyIdToken as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      const res = await request(app).get('/api/protected').set('Authorization', 'Bearer bad-token');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid or expired token.');
    });

    it('should return 401 if user not in database', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'user-1' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/protected').set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('User record not found in database. Please sync.');
    });

    it('should allow access to protected route with valid token and existing user', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'user-1' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1', email: 'test@test.com' });

      const res = await request(app).get('/api/protected').set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe('user-1');
    });
  });

  describe('POST /api/auth/sync', () => {
    it('should return 400 if token lacks email', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'user-1' });

      const res = await request(app).post('/api/auth/sync').set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Token does not contain an email address.');
    });

    it('should upsert user successfully with valid token', async () => {
      const mockDecoded = { uid: 'firebase-123', email: 'test@example.com', name: 'Test User' };
      const mockDbUser = { id: 'firebase-123', email: 'test@example.com', displayName: 'Test User' };
      
      (auth.verifyIdToken as jest.Mock).mockResolvedValue(mockDecoded);
      (prisma.user.upsert as jest.Mock).mockResolvedValue(mockDbUser);

      const res = await request(app).post('/api/auth/sync').set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual(mockDbUser);
      expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'firebase-123' },
        update: { email: 'test@example.com', displayName: 'Test User' },
        create: { id: 'firebase-123', email: 'test@example.com', displayName: 'Test User' }
      }));
    });
  });
});
