import request from 'supertest';

jest.mock('../src/config/firebase', () => ({ auth: {} }));
import app from '../src/index';

describe('API Health Check', () => {
  it('should return status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'SyncForge API' });
  });
});
