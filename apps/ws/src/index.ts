import { WebSocketServer } from 'ws';

const port = parseInt(process.env.PORT || '3002', 10);
const wss = new WebSocketServer({ port });

wss.on('connection', (ws, req) => {
  console.log('Client connected to WebSocket server');
  
  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
  });

  ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to SyncForge Collaboration Server' }));
});

console.log(`Collaboration Server listening on port ${port}`);
