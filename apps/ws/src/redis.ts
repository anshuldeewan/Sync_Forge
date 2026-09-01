import Redis from 'ioredis';
import * as Y from 'yjs';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisPublisher = new Redis(redisUrl);
export const redisSubscriber = new Redis(redisUrl);

type UpdateCallback = (pageId: string, update: Uint8Array) => void;

redisSubscriber.on('error', (err) => {
  console.error('Redis Subscriber Error (safe):', err.message);
});

redisPublisher.on('error', (err) => {
  console.error('Redis Publisher Error (safe):', err.message);
});

export function subscribeToPage(docName: string, onUpdate: UpdateCallback) {
  const channel = docName;
  
  // Subscribe to the channel
  redisSubscriber.subscribe(channel, (err) => {
    if (err) {
      console.error(`Failed to subscribe to ${channel}:`, err.message);
    }
  });
  
  // Listen for messages
  const listener = (msgChannel: string, message: Buffer) => {
    if (msgChannel === channel) {
      onUpdate(docName, new Uint8Array(message));
    }
  };
  
  // Use messageBuffer to get binary data directly without string encoding corruption
  redisSubscriber.on('messageBuffer', listener);
  
  return () => {
    redisSubscriber.unsubscribe(channel);
    redisSubscriber.off('messageBuffer', listener);
  };
}

export function publishUpdate(docName: string, update: Uint8Array) {
  const channel = docName;
  const buffer = Buffer.from(update);
  
  redisPublisher.publish(channel, buffer).catch((err) => {
    console.error(`Failed to publish to ${channel}:`, err.message);
  });
}

export async function closeRedis() {
  await redisSubscriber.quit();
  await redisPublisher.quit();
}
