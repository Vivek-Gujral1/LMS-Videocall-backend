import express from 'express';
import http from 'http';
import { setupSocket } from './socket2';

const app = express();
const server = http.createServer(app);

const PORT = 3000;

// Setup Socket.IO
setupSocket(server);

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

