import { WebSocketServer } from 'ws';
// @ts-ignore
import { setupWSConnection, getYDoc, setPersistence, docs } from 'y-websocket/bin/utils';
import * as Y from 'yjs';
import http from 'http';
import { verifyCollaborationToken } from './auth';
import { debouncePersistence, flushAllPendingSaves } from './persistence';
import { subscribeToPage, publishUpdate, closeRedis } from './redis';

const port = parseInt(process.env.PORT || '3002', 10);
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('SyncForge Collaboration Server\n');
});

const wss = new WebSocketServer({ server });

// Keep track of which pages we have active Redis subscriptions for
const activeSubscriptions = new Map<string, () => void>();

// Register y-websocket persistence layer using its official API
// This replaces the default LevelDB persistence with our PostgreSQL persistence
setPersistence({
  bindState: async (docName: string, ydoc: Y.Doc) => {
    // docName is "page:<pageId>"
    const pageId = docName.startsWith('page:') ? docName.slice(5) : docName;

    // 1. Load from PostgreSQL
    try {
      const prisma = (await import('@syncforge/db')).default;
      const snapshot = await prisma.documentSnapshot.findFirst({
        where: { pageId },
        orderBy: { createdAt: 'desc' }
      });

      if (snapshot) {
        Y.applyUpdate(ydoc, new Uint8Array(snapshot.state));
        console.log(`Loaded snapshot for page ${pageId}`);
      }
    } catch (error) {
      console.error(`Failed to load initial state for page ${pageId}:`, error);
    }

    // 2. Subscribe to Redis for remote updates (cross-server sync)
    if (!activeSubscriptions.has(pageId)) {
      const unsubscribe = subscribeToPage(pageId, (pid, update) => {
        // Apply the update received from Redis
        // We pass 'redis' as the origin to prevent feedback loops
        Y.applyUpdate(ydoc, update, 'redis');
      });
      activeSubscriptions.set(pageId, unsubscribe);
    }

    // 3. Hook into document updates for Redis broadcasting + DB persistence
    ydoc.on('update', (update: Uint8Array, origin: any) => {
      // Prevent feedback loop: don't publish updates that came from Redis
      if (origin !== 'redis') {
        publishUpdate(pageId, update);
      }

      // Trigger debounced persistence (for ALL updates)
      debouncePersistence(pageId, ydoc);
    });
  },
  writeState: async (docName: string, _ydoc: Y.Doc) => {
    // Called when all connections to a doc are closed and the doc is being destroyed.
    // We can do a final flush here.
    const pageId = docName.startsWith('page:') ? docName.slice(5) : docName;

    // Cleanup Redis subscription
    const unsub = activeSubscriptions.get(pageId);
    if (unsub) {
      unsub();
      activeSubscriptions.delete(pageId);
    }

    return Promise.resolve();
  }
});

wss.on('connection', async (ws, req) => {
  const tokenPayload = verifyCollaborationToken(req);

  if (!tokenPayload) {
    console.warn('Rejected connection: Invalid or missing token');
    ws.close(1008, 'Policy Violation');
    return;
  }

  const { pageId, role } = tokenPayload;
  const docName = `page:${pageId}`;

  console.log(`Client connected: pageId=${pageId}, role=${role}`);

  // Enforce VIEWER read-only by intercepting messages BEFORE setupWSConnection
  // setupWSConnection sets binaryType='arraybuffer', so messages arrive as ArrayBuffer
  if (role === 'VIEWER') {
    const originalOn = ws.on.bind(ws);
    ws.on = function (event: string, listener: (...args: any[]) => void) {
      if (event === 'message') {
        const wrappedListener = (data: ArrayBuffer | Buffer) => {
          // Convert to Uint8Array for uniform access
          const message = data instanceof ArrayBuffer ? new Uint8Array(data) : (data as Uint8Array);
          if (message.length >= 2) {
            const msgType = message[0];
            // 0 = messageSync in y-websocket protocol
            if (msgType === 0) {
              const syncType = message[1];
              // syncType 1 = SyncStep2 (client sending state), 2 = Update (client mutation)
              // Only allow syncType 0 = SyncStep1 (client requesting state)
              if (syncType === 1 || syncType === 2) {
                // Drop mutation silently — Viewer cannot write
                return;
              }
            }
          }
          // Allow awareness messages (type 1) and sync step 1 requests (type 0, subtype 0)
          listener(data);
        };
        return originalOn(event, wrappedListener as any);
      }
      return originalOn(event, listener);
    } as any;
  }

  // Let y-websocket handle everything: doc creation, sync protocol, etc.
  setupWSConnection(ws, req, { docName });
});

server.listen(port, () => {
  console.log(`Collaboration Server listening on port ${port}`);
});

// Graceful Shutdown Handler
async function gracefulShutdown() {
  console.log('Shutting down Collaboration Server gracefully...');
  
  // Close WebSocket Server to reject new connections
  wss.close();
  
  // Flush all pending DB saves
  const allDocs: Map<string, Y.Doc> = docs;
  await flushAllPendingSaves(allDocs);
  
  // Close Redis connections
  await closeRedis();
  
  server.close(() => {
    console.log('Shutdown complete.');
    process.exit(0);
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
