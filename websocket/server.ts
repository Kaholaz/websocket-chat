import net from 'net';
import crypto from 'crypto';

import { Disconnect, NameChange, Payload } from './payload';
import { Session } from './session';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'


let sessions = new Set<Session>();

const wsServer = net.createServer((connection) => {
    let session = new Session(connection);

    // Look for websocket upgrade request
    const handshake = (data: Buffer) => {
        const headers = getHeaders(data);

        // Handshake
        if (headers['Upgrade'] === 'websocket') {
            upgradeToWebSocket(connection, headers);
            connection.off('data', handshake);

            // Inform the client of the names of all other clients
            for (const session of sessions) {
                if (session.name === '') continue;
                const payload = new NameChange(session, session.name);
                payload.send(connection);
            }

            sessions.add(session);

            // Listen for messages
            connection.on('data', (data) => {
                let payload: Payload;
                try {
                    payload = Payload.decode(data, session);
                } catch (err) {
                    handshake(data);
                    return;
                }
                payload.broadcast(sessions);
            });
        } else {
            connection.write('HTTP/1.1 400 Bad Request\r\n');
        }
    }

    // Listen for handshake
    connection.on('data', handshake);

    // Listen for disconnect
    connection.on('end', () => {
        if (!sessions.has(session)) return;
        const payload = new Disconnect(session);
        payload.broadcast(sessions);
    });

    // Log errors
    connection.on('error', (err) => {
        console.error(err.stack || err);
    });
});

// Start the server
wsServer.listen(3001, () => {
    console.log("WebSocket server listening on port 3001");
});

// Log errors
wsServer.on('error', (err) => {
    console.error(err.stack || err);
});

// Parse HTTP headers from a request
function getHeaders(data: Buffer) : {[key: string]: string} {
    const headers: {[key: string]: string} = {};
    const headerLines = data.toString().split('\r');

    // Skip the first line, which is the request line
    for (let i = 1; i < headerLines.length; i++) {
        if (headerLines[i].trim() === '') break;

        const header = headerLines[i].split(': ').map((s) => s.trim());
        headers[header[0]] = header[1];
    }
    
    return headers;
}

// Upgrade a connection to a WebSocket connection (handshake response)
function upgradeToWebSocket(connection: net.Socket, headers: {[key: string]: string}) {
    const key = headers['Sec-WebSocket-Key'];
    const acceptKey = getAcceptKey(key);

    const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        ''
    ].map((line) => line + '\r\n').join('');

    connection.write(responseHeaders);
}

// Generate the Sec-WebSocket-Accept key
function getAcceptKey(key: string) : string {
    const sha1 = crypto.createHash('sha1')
    sha1.update(key + WS_GUID);
    return sha1.digest('base64');
}

