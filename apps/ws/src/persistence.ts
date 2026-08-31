import prisma from '@syncforge/db';
import * as Y from 'yjs';

// Maintain state of debouncing
const debounceTimers = new Map<string, { timer: NodeJS.Timeout, version: number }>();
const DEBOUNCE_MS = 5000; // 5 seconds

/**
 * Trigger a debounced save to PostgreSQL.
 */
export function debouncePersistence(pageId: string, ydoc: Y.Doc) {
  if (debounceTimers.has(pageId)) {
    const current = debounceTimers.get(pageId)!;
    clearTimeout(current.timer);
    
    // We increase the version so if an old timer was executing, it gets superceded
    current.version += 1;
    
    const newVersion = current.version;
    const timer = setTimeout(() => executeSave(pageId, ydoc, newVersion), DEBOUNCE_MS);
    
    debounceTimers.set(pageId, { timer, version: newVersion });
  } else {
    const version = 1;
    const timer = setTimeout(() => executeSave(pageId, ydoc, version), DEBOUNCE_MS);
    debounceTimers.set(pageId, { timer, version });
  }
}

async function executeSave(pageId: string, ydoc: Y.Doc, expectedVersion: number) {
  try {
    // Check if another save was queued
    const current = debounceTimers.get(pageId);
    if (current && current.version > expectedVersion) {
      // Abort, a newer save is pending
      return;
    }

    const stateVector = Y.encodeStateAsUpdate(ydoc);
    const buffer = Buffer.from(stateVector);

    // Save to Postgres
    await prisma.documentSnapshot.create({
      data: {
        pageId,
        state: buffer
      }
    });

    // Clean up timer tracking if this was the last queued save
    const latest = debounceTimers.get(pageId);
    if (latest && latest.version === expectedVersion) {
      debounceTimers.delete(pageId);
    }
  } catch (error) {
    console.error(`Failed to persist page ${pageId}:`, error);
    // In a production system we could implement retry logic, but for now we log it safely.
    // Notice we do NOT log document contents.
  }
}

/**
 * Fetch latest state from PostgreSQL to initialize the Y.Doc
 */
export async function loadInitialState(pageId: string, ydoc: Y.Doc) {
  try {
    const snapshot = await prisma.documentSnapshot.findFirst({
      where: { pageId },
      orderBy: { createdAt: 'desc' }
    });

    if (snapshot) {
      Y.applyUpdate(ydoc, new Uint8Array(snapshot.state));
    }
  } catch (error) {
    console.error(`Failed to load initial state for page ${pageId}`, error);
  }
}

/**
 * Force flush all pending saves (for graceful shutdown)
 */
export async function flushAllPendingSaves(docs: Map<string, Y.Doc>) {
  const promises = [];
  
  for (const [pageId, tracking] of debounceTimers.entries()) {
    clearTimeout(tracking.timer);
    
    const ydoc = docs.get(pageId);
    if (ydoc) {
      promises.push(executeSave(pageId, ydoc, tracking.version));
    }
  }
  
  await Promise.all(promises);
  debounceTimers.clear();
}
