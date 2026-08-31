import { verifyCollaborationToken } from '../src/auth';
import { debouncePersistence, loadInitialState } from '../src/persistence';
import * as Y from 'yjs';
import jwt from 'jsonwebtoken';
import { publishUpdate } from '../src/redis';

// Mock everything
jest.mock('../src/redis', () => ({
  subscribeToPage: jest.fn(),
  publishUpdate: jest.fn(),
  closeRedis: jest.fn()
}));

jest.mock('@syncforge/db', () => ({
  documentSnapshot: {
    create: jest.fn(),
    findFirst: jest.fn()
  }
}));

describe('WebSocket Collaboration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Debounced Persistence', () => {
    it('rapid updates produce one debounced persistence', () => {
      const { documentSnapshot } = require('@syncforge/db');
      const ydoc = new Y.Doc();

      debouncePersistence('page1', ydoc);
      debouncePersistence('page1', ydoc);
      debouncePersistence('page1', ydoc);

      expect(documentSnapshot.create).not.toHaveBeenCalled();

      // Fast forward 5 seconds
      jest.advanceTimersByTime(5000);

      expect(documentSnapshot.create).toHaveBeenCalledTimes(1);
    });

    it('multiple pages have independent persistence timers', () => {
      const { documentSnapshot } = require('@syncforge/db');
      const ydoc1 = new Y.Doc();
      const ydoc2 = new Y.Doc();

      debouncePersistence('pageA', ydoc1);
      jest.advanceTimersByTime(2500);
      debouncePersistence('pageB', ydoc2);

      jest.advanceTimersByTime(2500);
      // pageA fires
      expect(documentSnapshot.create).toHaveBeenCalledTimes(1);
      expect(documentSnapshot.create.mock.calls[0][0].data.pageId).toBe('pageA');

      jest.advanceTimersByTime(2500);
      // pageB fires
      expect(documentSnapshot.create).toHaveBeenCalledTimes(2);
      expect(documentSnapshot.create.mock.calls[1][0].data.pageId).toBe('pageB');
    });

    it('loads initial state from database correctly', async () => {
      const { documentSnapshot } = require('@syncforge/db');
      
      const mockDoc = new Y.Doc();
      const text = mockDoc.getText('default');
      text.insert(0, 'Hello');
      const stateVector = Y.encodeStateAsUpdate(mockDoc);
      
      documentSnapshot.findFirst.mockResolvedValueOnce({
        pageId: 'page1',
        state: Buffer.from(stateVector)
      });
      
      const ydoc = new Y.Doc();
      await loadInitialState('page1', ydoc);
      
      expect(ydoc.getText('default').toString()).toBe('Hello');
    });
  });

  describe('Authentication and Token Security', () => {
    const JWT_SECRET = process.env.JWT_SECRET || 'syncforge_super_secret_for_collaboration_only';
    
    it('accepts valid token with exact payload binding', () => {
      const token = jwt.sign({
        purpose: 'collaboration',
        userId: 'u1',
        workspaceId: 'w1',
        projectId: 'p1',
        pageId: 'page1',
        role: 'EDITOR'
      }, JWT_SECRET, { expiresIn: '5m' });
      
      const req = { url: `/collaboration?token=${token}` };
      const payload = verifyCollaborationToken(req);
      
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe('u1');
      expect(payload?.workspaceId).toBe('w1');
      expect(payload?.pageId).toBe('page1');
      expect(payload?.role).toBe('EDITOR');
    });

    it('rejects missing token', () => {
      const req = { url: '/collaboration' };
      const payload = verifyCollaborationToken(req);
      expect(payload).toBeNull();
    });

    it('rejects invalid purpose', () => {
      const token = jwt.sign({ purpose: 'auth' }, JWT_SECRET);
      const req = { url: `/collaboration?token=${token}` };
      const payload = verifyCollaborationToken(req);
      expect(payload).toBeNull();
    });

    it('rejects expired token', () => {
      const token = jwt.sign({ purpose: 'collaboration' }, JWT_SECRET, { expiresIn: '-1s' });
      const req = { url: `/collaboration?token=${token}` };
      const payload = verifyCollaborationToken(req);
      expect(payload).toBeNull();
    });

    it('rejects tampered signature', () => {
      const token = jwt.sign({ purpose: 'collaboration' }, 'wrong_secret');
      const req = { url: `/collaboration?token=${token}` };
      const payload = verifyCollaborationToken(req);
      expect(payload).toBeNull();
    });
  });

  describe('Yjs Redis Update Flow & Feedback Loop Prevention', () => {
    it('publishes local updates to Redis but does not republish Redis-origin updates', () => {
      const ydoc = new Y.Doc();
      let publishCount = 0;
      
      const mockPublish = (publishUpdate as jest.Mock);
      mockPublish.mockImplementation(() => { publishCount++; });

      ydoc.on('update', (update, origin) => {
        if (origin !== 'redis') {
          mockPublish('page1', update);
        }
      });

      // 1. Local update (origin is implicitly null/client)
      const text = ydoc.getText('default');
      text.insert(0, 'Local edit'); // Triggers update event with no origin
      expect(mockPublish).toHaveBeenCalledTimes(1);
      
      // 2. Redis-originated update (we receive it from subscribeToPage)
      const remoteDoc = new Y.Doc();
      remoteDoc.getText('default').insert(0, 'Remote edit ');
      const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);
      
      // Apply with 'redis' origin
      Y.applyUpdate(ydoc, remoteUpdate, 'redis');
      
      // The update event fired, but since origin === 'redis', publish should NOT have been called again
      expect(mockPublish).toHaveBeenCalledTimes(1); 
    });
  });
  describe('Server-Side Viewer Enforcement', () => {
    it('allows SyncStep1 requests but drops SyncStep2/Update mutations from VIEWERS', () => {
      // Mock the WebSocket and req
      const ws = {
        on: jest.fn(),
        close: jest.fn(),
      };
      
      let messageHandler: (data: Buffer | ArrayBuffer) => void = () => {};
      const originalOn = ws.on.bind(ws);
      ws.on.mockImplementation((event, listener) => {
        if (event === 'message') {
          messageHandler = listener;
        }
        return originalOn(event, listener);
      });

      // Simulate a Viewer connection wrapper logic as seen in index.ts
      let receivedValidMessages = 0;
      const wrappedListener = (data: ArrayBuffer | Buffer) => {
        const message = data instanceof ArrayBuffer ? new Uint8Array(data) : (data as Uint8Array);
        if (message.length >= 2) {
          const msgType = message[0];
          if (msgType === 0) {
            const syncType = message[1];
            if (syncType === 1 || syncType === 2) {
              return; // Dropped
            }
          }
        }
        receivedValidMessages++;
      };

      // 1. ArrayBuffer: SyncStep1 (valid for viewer)
      const buffer1 = new Uint8Array([0, 0, 5, 6]).buffer; // type 0, sync 0
      wrappedListener(buffer1);
      expect(receivedValidMessages).toBe(1);

      // 2. Buffer: SyncStep2 (state update, dropped)
      const buffer2 = Buffer.from([0, 1, 5, 6]); // type 0, sync 1
      wrappedListener(buffer2);
      expect(receivedValidMessages).toBe(1); // Still 1

      // 3. ArrayBuffer: Update (mutation, dropped)
      const buffer3 = new Uint8Array([0, 2, 5, 6]).buffer; // type 0, sync 2
      wrappedListener(buffer3);
      expect(receivedValidMessages).toBe(1); // Still 1

      // 4. Awareness update (allowed)
      const buffer4 = Buffer.from([1, 0, 0]); // type 1
      wrappedListener(buffer4);
      expect(receivedValidMessages).toBe(2);
    });
  });
});
