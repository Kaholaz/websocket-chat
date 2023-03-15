const net = require('net');
const fs = require('fs');

// Simple HTTP server responds with a simple WebSocket client test
const httpServer = net.createServer((connection) => {
  const content = fs.readFileSync('index.html', 'utf8');
  connection.on('data', () => {
    connection.write('HTTP/1.1 200 OK\r\nContent-Length: ' + content.length + '\r\n\r\n' + content);
  });
});

httpServer.listen(3000, () => {
  console.log('HTTP server listening on port 3000');
});

httpServer.on('error', (err) => {
  console.error("Something went wrong: " + err.stack || err);
});