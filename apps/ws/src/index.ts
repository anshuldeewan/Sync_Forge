import 'dotenv/config';
import { WebSocketServer } from 'ws';
// @ts-ignore
import { setupWSConnection, getYDoc, setPersistence, docs } from 'y-websocket/bin/utils';
import * as Y from 'yjs';
import http from 'http';
import { verifyCollaborationToken } from './auth';
import { debouncePersistence, flushAllPendingSaves } from './persistence';
import { subscribeToPage, publishUpdate, closeRedis, redisSubscriber } from './redis';

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
    // docName is "page:<pageId>" or "resource:<resourceId>"
    const id = docName.startsWith('page:') ? docName.slice(5) : docName.startsWith('resource:') ? docName.slice(9) : docName;

    // 1. Load from PostgreSQL
    try {
      const prisma = (await import('@syncforge/db')).default;
      if (docName.startsWith('resource:')) {
        const snapshot = await prisma.fileSnapshot.findFirst({
          where: { resourceId: id },
          orderBy: { createdAt: 'desc' }
        });
        if (snapshot) {
          Y.applyUpdate(ydoc, new Uint8Array(snapshot.state));
          console.log(`Loaded snapshot for resource ${id}`);
        }
      } else {
        const snapshot = await prisma.documentSnapshot.findFirst({
          where: { pageId: id },
          orderBy: { createdAt: 'desc' }
        });
        if (snapshot) {
          Y.applyUpdate(ydoc, new Uint8Array(snapshot.state));
          console.log(`Loaded snapshot for page ${id}`);
        }
      }
    } catch (error) {
      console.error(`Failed to load initial state for ${docName}:`, error);
    }

    // 2. Subscribe to Redis for remote updates (cross-server sync)
    if (!activeSubscriptions.has(docName)) {
      const unsubscribe = subscribeToPage(docName, (name, update) => {
        // Apply the update received from Redis
        // We pass 'redis' as the origin to prevent feedback loops
        Y.applyUpdate(ydoc, update, 'redis');
      });
      activeSubscriptions.set(docName, unsubscribe);
    }

    // 3. Subscribe to specialized restore events
    const restoreChannel = `restore:${docName}`;
    const restoreListener = (msgChannel: string, message: Buffer) => {
      if (msgChannel === restoreChannel) {
        console.log(`[RESTORE] Received restore event for ${docName}. Disconnecting clients.`);
        // To enforce a clean restore, we must destroy the current in-memory ydoc
        // and force clients to reconnect so they fetch the newly restored snapshot.
        // We can do this by closing all websocket connections for this doc.
        wss.clients.forEach(client => {
          // Unfortunately y-websocket doesn't expose the docName on the ws object easily,
          // but we can check the URL.
          // Better: we can just terminate connections associated with this doc by iterating docs.
          // Wait, y-websocket maintains a `conns` map on the doc.
          const ydocAny = ydoc as any;
          if (ydocAny.conns) {
            for (const [conn] of ydocAny.conns) {
               conn.close(1011, 'RESTORE_TRIGGERED');
            }
          }
        });
        
        // Remove from local memory
        ydoc.destroy();
        docs.delete(docName);
      }
    };
    redisSubscriber.subscribe(restoreChannel);
    redisSubscriber.on('messageBuffer', restoreListener);
    
    // Cleanup restore subscription on destroy
    const origDestroy = ydoc.destroy.bind(ydoc);
    ydoc.destroy = function () {
       redisSubscriber.unsubscribe(restoreChannel);
       redisSubscriber.off('messageBuffer', restoreListener);
       origDestroy();
    };

    // 4. Hook into document updates for Redis broadcasting + DB persistence
    ydoc.on('update', (update: Uint8Array, origin: any) => {
      // Prevent feedback loop: don't publish updates that came from Redis
      if (origin !== 'redis') {
        publishUpdate(docName, update);
      }

      // Trigger debounced persistence (for ALL updates)
      debouncePersistence(docName, ydoc);
    });
  },
  writeState: async (docName: string, _ydoc: Y.Doc) => {
    // Called when all connections to a doc are closed and the doc is being destroyed.
    // We can do a final flush here.
    // Cleanup Redis subscription
    const unsub = activeSubscriptions.get(docName);
    if (unsub) {
      unsub();
      activeSubscriptions.delete(docName);
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

  const { pageId, resourceId, role } = tokenPayload;
  const docName = resourceId ? `resource:${resourceId}` : `page:${pageId}`;

  console.log(`Client connected: docName=${docName}, role=${role}`);

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
                console.log(`[VIEWER] Dropping mutation: syncType=${syncType}`);
                // Drop mutation silently — Viewer cannot write
                return;
              } else {
                console.log(`[VIEWER] Allowed syncType: ${syncType}`);
              }
            } else {
              console.log(`[VIEWER] Allowed msgType: ${msgType}`);
            }
          } else {
             console.log(`[VIEWER] Message too short: ${message.length}`);
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
