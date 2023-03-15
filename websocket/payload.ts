import net from 'net';
import { Session } from './session';


export abstract class Payload {
    protected readonly payload: string;
    protected readonly payloadSuffix: string = '';

    constructor(payload: string, payloadSuffix: string) {
        this.payload = `${payloadSuffix}\n${payload}`;
    }

    encode() : Buffer {
        const buffer = Buffer.alloc(2 + this.payload.length);
        buffer.writeUInt8(0b10000001, 0);
        buffer.writeUInt8(this.payload.length, 1);
        buffer.write(this.payload, 2);
        return buffer;
    }

    static decode(data: Buffer, session: Session) : Payload {
        const markerAndLength = data.readUInt8(1);
        const isMasked = (markerAndLength & 0b10000000) !== 0;
        if (!isMasked) throw new Error('Client sent unmasked message');
    
        const length = markerAndLength & 0b01111111;
        if (length > 125) throw new Error('Client sent message with length > 125');
    
        const maskKey = data.slice(2, 6);
        const payload = data.slice(6, 6 + length);
    
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= maskKey[i % 4];
        }

        const payloadString = payload.toString();
        const firstNewline = payloadString.indexOf('\n');
        const payloadType = payloadString.slice(0, firstNewline);
        const payloadContent = payloadString.slice(firstNewline + 1);

        switch (payloadType) {
            case 'MSG':
                return new Message(session, payloadContent);
            case 'NAM':
                return new NameChange(session, payloadContent);
            case 'DCN':
                return new Disconnect(session);
            case 'CON':
                return new ConnectionEstablished(session);
            default:
                throw new Error(`Unknown payload type: ${payloadType}`);
        }
    }

    send(connection: net.Socket) : void {
        connection.write(this.encode());
    }

    broadcast(sessions: Set<Session>) : void {
        for (const connection of sessions) {
            this.send(connection.connection);
        }
    }
}

export class Message extends Payload {
    constructor(session: Session, message: string) {
        const payload = `${session.id}=${message}`;
        super(payload, 'MSG');
    }
}

export class NameChange extends Payload {
    constructor(session: Session, newName: string) {
        session.name = newName;
        const payload = `${session.id}=${newName}`;
        super(payload, 'NAM');
    }
}

export class Disconnect extends Payload {
    session: Session;

    constructor(session: Session) {
        const payload = session.id;
        super(payload, 'DCN');

        this.session = session;
    }

    broadcast(sessions: Set<Session>): void {
        super.broadcast(sessions);
        sessions.delete(this.session);
        this.session.connection.end();
    }
}

export class ConnectionEstablished extends Payload {
    constructor(session: Session) {
        const payload = session.id;
        super(payload, 'CON');
    }
}