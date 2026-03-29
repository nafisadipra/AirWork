// electron/p2p.ts
import * as dgram from 'dgram';
import * as net from 'net';
import { EventEmitter } from 'events';

const BROADCAST_PORT = 43210;
const BROADCAST_ADDR = '255.255.255.255';

export class P2PEngine extends EventEmitter {
    private udpSocket: dgram.Socket;
    private tcpServer: net.Server;
    private peerId: string;
    private username: string;
    private tcpPort: number = 0;
    
    // Track who we know about, and who we are actively connected to
    private knownPeers: Map<string, any> = new Map();
    private activeConnections: Map<string, net.Socket> = new Map();

    // <--- ADDED: Tracker for the broadcast timer --->
    private broadcastInterval: NodeJS.Timeout | null = null;

    constructor(peerId: string, username: string) {
        super();
        this.peerId = peerId;
        this.username = username;
        
        this.tcpServer = net.createServer((socket) => this.handleIncomingConnection(socket));
        this.udpSocket = dgram.createSocket('udp4');
    }

    start() {
        this.tcpServer.listen(0, '0.0.0.0', () => {
            this.tcpPort = (this.tcpServer.address() as net.AddressInfo).port;
            console.log(`[P2P] 🚪 TCP Server open for business on port ${this.tcpPort}`);
            this.startDiscovery();
        });
    }

    private startDiscovery() {
        this.udpSocket.bind(BROADCAST_PORT, () => {
            this.udpSocket.setBroadcast(true);
            
            this.udpSocket.on('message', (msg, rinfo) => {
                const message = msg.toString();
                
                if (message.startsWith('AIRWORK:HELLO:')) {
                    const [, , id, user, port] = message.split(':');
                    
                    // If we found someone new...
                    if (id !== this.peerId && !this.knownPeers.has(id)) {
                        console.log(`[P2P] 📡 Heard ${user} on the network at ${rinfo.address}:${port}`);
                        this.knownPeers.set(id, { id, user, address: rinfo.address, port: parseInt(port) });
                        
                        this.emit('peer-discovered', { id, user });
                        
                        this.connectToPeer(id, rinfo.address, parseInt(port));
                    }
                }
            });

            // <--- ADDED: Assign the interval to our tracker variable and add a safety try/catch --->
            this.broadcastInterval = setInterval(() => {
                const msg = Buffer.from(`AIRWORK:HELLO:${this.peerId}:${this.username}:${this.tcpPort}`);
                try {
                    this.udpSocket.send(msg, 0, msg.length, BROADCAST_PORT, BROADCAST_ADDR);
                } catch (error) {
                    // Socket is likely closed, safely ignore to prevent crash
                }
            }, 3000);
            
            console.log('[P2P] 📢 Shouting presence to the local network...');
        });
        
        this.udpSocket.on('error', (err) => {
            console.log(`[P2P] UDP Socket error: ${err.message}`);
        });
    }

    private connectToPeer(targetPeerId: string, address: string, port: number) {
        if (this.activeConnections.has(targetPeerId)) return; // Already connected!

        console.log(`[P2P] 🤝 Attempting to dial ${address}:${port}...`);
        
        const socket = net.createConnection({ host: address, port: port }, () => {
            console.log(`[P2P] ✅ Successfully connected to peer ${targetPeerId}!`);
            this.activeConnections.set(targetPeerId, socket);
            this.setupSocketHandlers(socket, targetPeerId);
            
            this.sendMessage(socket, { type: 'HANDSHAKE', peerId: this.peerId, username: this.username });
        });

        socket.on('error', (err) => {
            console.log(`[P2P] ❌ Failed to connect to ${targetPeerId}:`, err.message);
            this.knownPeers.delete(targetPeerId); 
        });
    }

    private handleIncomingConnection(socket: net.Socket) {
        console.log(`[P2P] 🔔 Someone is knocking at our TCP door from ${socket.remoteAddress}`);
        const tempId = `unknown-${Date.now()}`; 
        this.setupSocketHandlers(socket, tempId);
    }

    private setupSocketHandlers(socket: net.Socket, connectionId: string) {
        let actualPeerId = connectionId;
        
        // <--- NEW: Buffer to handle rapid-fire keystroke data chunks safely --->
        let buffer = '';

        socket.on('data', (data) => {
            buffer += data.toString();
            
            let boundary = buffer.indexOf('\n');
            while (boundary !== -1) {
                const messageStr = buffer.substring(0, boundary);
                buffer = buffer.substring(boundary + 1); // remove processed message from buffer
                
                if (messageStr.trim()) {
                    try {
                        const message = JSON.parse(messageStr);
                        
                        if (message.type === 'HANDSHAKE') {
                            actualPeerId = message.peerId;
                            this.activeConnections.set(actualPeerId, socket);
                            console.log(`[P2P] 🤝 Handshake complete with ${message.username}. Secure tube established.`);
                        } else {
                            // Pass the Sync Data up to main.ts
                            this.emit('message', message);
                        }
                        
                    } catch (error) {
                        console.error('[P2P] Received garbled data (failed to parse):', messageStr);
                    }
                }
                boundary = buffer.indexOf('\n'); // check if there is another message in the buffer
            }
        });

        socket.on('close', () => {
            console.log(`[P2P] 🔌 Connection closed with ${actualPeerId}`);
            this.activeConnections.delete(actualPeerId);
            this.knownPeers.delete(actualPeerId); 
        });
    }

    private sendMessage(socket: net.Socket, payload: any) {
        if (socket && !socket.destroyed) {
            socket.write(JSON.stringify(payload) + '\n');
        }
    }

    broadcast(payload: any) {
        const messageString = JSON.stringify(payload) + '\n';
        this.activeConnections.forEach((socket, peerId) => {
            if (!socket.destroyed) {
                // We won't log every single keystroke broadcast here so it doesn't spam your terminal!
                socket.write(messageString);
            }
        });
    }

    stop() {
        // <--- ADDED: Clear the interval before closing the socket --->
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }

        if (this.udpSocket) {
            try { this.udpSocket.close(); } catch(e) {}
        }
        if (this.tcpServer) this.tcpServer.close();
        this.activeConnections.forEach(socket => socket.destroy());
    }
}