import prisma from '@syncforge/db';
import * as Y from 'yjs';

// Maintain state of debouncing
const debounceTimers = new Map<string, { timer: NodeJS.Timeout, version: number }>();
const DEBOUNCE_MS = 5000; // 5 seconds

/**
 * Trigger a debounced save to PostgreSQL.
 */
export function debouncePersistence(docName: string, ydoc: Y.Doc) {
  if (debounceTimers.has(docName)) {
    const current = debounceTimers.get(docName)!;
    clearTimeout(current.timer);
    
    // We increase the version so if an old timer was executing, it gets superceded
    current.version += 1;
    
    const newVersion = current.version;
    const timer = setTimeout(() => executeSave(docName, ydoc, newVersion), DEBOUNCE_MS);
    
    debounceTimers.set(docName, { timer, version: newVersion });
  } else {
    const version = 1;
    const timer = setTimeout(() => executeSave(docName, ydoc, version), DEBOUNCE_MS);
    debounceTimers.set(docName, { timer, version });
  }
}

async function executeSave(docName: string, ydoc: Y.Doc, expectedVersion: number) {
  try {
    // Check if another save was queued
    const current = debounceTimers.get(docName);
    if (current && current.version > expectedVersion) {
      // Abort, a newer save is pending
      return;
    }

    const stateVector = Y.encodeStateAsUpdate(ydoc);
    const buffer = Buffer.from(stateVector);

    // Save to Postgres
    const id = docName.startsWith('page:') ? docName.slice(5) : docName.startsWith('resource:') ? docName.slice(9) : docName;
    if (docName.startsWith('resource:')) {
      await prisma.fileSnapshot.upsert({
        where: { resourceId: id },
        update: { state: buffer },
        create: { resourceId: id, state: buffer }
      });
    } else {
      await prisma.documentSnapshot.create({
        data: {
          pageId: id,
          state: buffer
        }
      });
    }

    // Clean up timer tracking if this was the last queued save
    const latest = debounceTimers.get(docName);
    if (latest && latest.version === expectedVersion) {
      debounceTimers.delete(docName);
    }
  } catch (error) {
    console.error(`Failed to persist ${docName}:`, error);
    // In a production system we could implement retry logic, but for now we log it safely.
    // Notice we do NOT log document contents.
  }
}

/**
 * Fetch latest state from PostgreSQL to initialize the Y.Doc
 */
export async function loadInitialState(docName: string, ydoc: Y.Doc) {
  try {
    const id = docName.startsWith('page:') ? docName.slice(5) : docName.startsWith('resource:') ? docName.slice(9) : docName;
    
    if (docName.startsWith('resource:')) {
      const snapshot = await prisma.fileSnapshot.findFirst({
        where: { resourceId: id },
        orderBy: { createdAt: 'desc' }
      });
      if (snapshot) {
        Y.applyUpdate(ydoc, new Uint8Array(snapshot.state));
      }
    } else {
      const snapshot = await prisma.documentSnapshot.findFirst({
        where: { pageId: id },
        orderBy: { createdAt: 'desc' }
      });
      if (snapshot) {
        Y.applyUpdate(ydoc, new Uint8Array(snapshot.state));
      }
    }
  } catch (error) {
    console.error(`Failed to load initial state for ${docName}`, error);
  }
}

/**
 * Force flush all pending saves (for graceful shutdown)
 */
export async function flushAllPendingSaves(docs: Map<string, Y.Doc>) {
  const promises = [];
  
  for (const [docName, tracking] of debounceTimers.entries()) {
    clearTimeout(tracking.timer);
    
    const ydoc = docs.get(docName);
    if (ydoc) {
      promises.push(executeSave(docName, ydoc, tracking.version));
    }
  }
  
  await Promise.all(promises);
  debounceTimers.clear();
}
