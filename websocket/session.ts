import net from 'net';
import crypto from 'crypto';

export class Session {
    connection: net.Socket;
    id: string;
    name: string;

    constructor(connection: net.Socket) {
        this.connection = connection;
        this.id = crypto.randomBytes(4).toString('hex');
        this.name = '';
    }
}