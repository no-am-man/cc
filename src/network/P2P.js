// src/network/P2P.js
const WebSocket = require('ws');

const MESSAGE_TYPES = {
    HANDSHAKE: 'HANDSHAKE',
    CHAIN_REQUEST: 'CHAIN_REQUEST',
    CHAIN_RESPONSE: 'CHAIN_RESPONSE',
    NEW_BLOCK: 'NEW_BLOCK',
    TRANSFER_REQUEST: 'TRANSFER_REQUEST',
    ANNOUNCE_USER: 'ANNOUNCE_USER' // New Gossip Type
};

class P2P {
    constructor(port, userNode) {
        this.sockets = [];
        this.userNode = userNode; 
        this.API_VERSION = '1.0.0';
        
        this.resolveNode = null; // Resolves LOCAL nodes
        
        // Federation Directory: Map<userId, socket>
        // Keeps track of which peer hosts which user.
        this.directory = new Map();

        this.server = new WebSocket.Server({ port });
        this.server.on('connection', (socket, req) => this.connectSocket(socket, req));
        
        console.log(`P2P Network listening on port ${port}`);
    }

    connectToPeer(peerUrl) {
        const socket = new WebSocket(peerUrl);
        socket._peerUrl = peerUrl;
        socket.on('open', () => this.connectSocket(socket));
        socket.on('error', (err) => console.error(`Connection error with ${peerUrl}:`, err.message));
    }

    connectSocket(socket, req = null) {
        this.sockets.push(socket);
        console.log('Socket connected');
        
        if (req) {
            socket._peerUrl = req.socket.remoteAddress; 
        }

        socket.on('message', message => {
            try {
                const data = JSON.parse(message);
                this.handleMessage(socket, data);
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        });

        socket.on('close', () => {
            this.sockets = this.sockets.filter(s => s !== socket);
            
            // Clean up directory
            for (const [userId, s] of this.directory.entries()) {
                if (s === socket) {
                    this.directory.delete(userId);
                }
            }
            
            console.log(`Socket disconnected: ${socket.nodeId || 'unknown'}`);
        });

        if (this.userNode) {
            this.sendHandshake(socket, this.userNode);
        }
    }

    handleMessage(socket, message) {
        let targetNode = this.userNode; 

        // 1. Resolve Local Node
        let targetId = null;
        if (message.type === 'NEW_BLOCK' && message.payload.data && message.payload.data.toAddress) {
            targetId = message.payload.data.toAddress;
        } else if (message.type === 'TRANSFER_REQUEST') {
            targetId = message.payload.from; // Request directed at Issuer
        }

        if (targetId) {
            if (this.resolveNode) {
                const resolved = this.resolveNode(targetId);
                if (resolved) {
                    targetNode = resolved;
                } else if (this.directory.has(targetId)) {
                    // 2. Resolve Remote Node (Routing)
                    // If not local, but we know where they are, FORWARD it.
                    const gatewaySocket = this.directory.get(targetId);
                    if (gatewaySocket && gatewaySocket.readyState === WebSocket.OPEN) {
                        console.log(`📡 Forwarding message for ${targetId} to gateway.`);
                        this.send(gatewaySocket, message);
                        return; // Handled by forwarding
                    }
                }
            }
        }

        this.processMessage(socket, message, targetNode);
    }

    processMessage(socket, message, node) {
        switch (message.type) {
            case MESSAGE_TYPES.HANDSHAKE:
                // console.log(`Received Handshake from Node: ${message.payload.nodeId}`);
                socket.nodeId = message.payload.nodeId;
                
                // If the peer identifies as a specific user, add to directory
                if (message.payload.nodeId) {
                    this.directory.set(message.payload.nodeId, socket);
                }
                break;

            case MESSAGE_TYPES.ANNOUNCE_USER:
                // Gossip: "I host user X"
                const { userId } = message.payload;
                if (userId) {
                    // console.log(`📖 Directory Update: ${userId} is at ${socket._peerUrl || 'peer'}`);
                    this.directory.set(userId, socket);
                }
                break;

            case MESSAGE_TYPES.CHAIN_REQUEST:
                if (node) this.sendChain(socket, node);
                break;

            case MESSAGE_TYPES.CHAIN_RESPONSE:
                if (node) {
                    const { nodeId, chain } = message.payload;
                    if (nodeId && chain) {
                        node.updateExternalChain(nodeId, chain);
                    }
                }
                break;
            
            case MESSAGE_TYPES.NEW_BLOCK:
                const block = message.payload;
                
                if (node && block.type === 'SEND' && block.data.toAddress === node.userId) {
                    // console.log(`💰 Incoming payment for ${node.userId} from ${block.data.fromAddress}`);
                    try {
                        const alreadyReceived = node.chain.chain.find(b => 
                            b.type === 'RECEIVE' && b.data.senderBlockHash === block.hash
                        );

                        if (!alreadyReceived) {
                            const receiveBlock = node.chain.receiveTransaction(
                                block.data.fromAddress, 
                                block.data.amount, 
                                block.hash,
                                block.data.message
                            );
                            // console.log(`✅ Accepted Payment for ${node.userId}`);
                            this.broadcast({
                                type: MESSAGE_TYPES.NEW_BLOCK,
                                payload: receiveBlock
                            });
                        }
                    } catch (e) {
                        console.error(`Failed to accept payment for ${node.userId}:`, e.message);
                    }
                }
                break;

            case MESSAGE_TYPES.TRANSFER_REQUEST:
                // Only handle if local 'node' is the target issuer
                if (node && message.payload.from === node.userId) {
                    try {
                        const result = node.handleTransferRequest(message.payload);
                        if (result.success) {
                            this.broadcast({
                                type: MESSAGE_TYPES.NEW_BLOCK,
                                payload: node.chain.getLatestBlock()
                            });
                        }
                    } catch (e) {
                        console.error('Transfer Request Failed:', e.message);
                    }
                }
                break;
            default:
                console.error('Unknown message type:', message.type);
                break;
        }
    }

    sendHandshake(socket, node) {
        this.send(socket, {
            type: MESSAGE_TYPES.HANDSHAKE,
            payload: {
                nodeId: node.userId,
                version: this.API_VERSION,
                publicKey: node.keyPair.publicKey
            }
        });
    }

    sendChain(socket, node) {
        this.send(socket, {
            type: MESSAGE_TYPES.CHAIN_RESPONSE,
            payload: {
                nodeId: node.userId,
                chain: node.chain.chain
            }
        });
    }

    // New: Announce a user to all peers
    announceUser(userId) {
        this.broadcast({
            type: MESSAGE_TYPES.ANNOUNCE_USER,
            payload: { userId }
        });
    }

    send(socket, message) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    }

    broadcast(message) {
        this.sockets.forEach(socket => this.send(socket, message));
    }
    
    getConnectedPeers() {
        return this.sockets.map(s => ({
            nodeId: s.nodeId || 'Gateway',
            url: s._peerUrl || 'Incoming Connection'
        }));
    }

    getDirectoryStats() {
        return Array.from(this.directory.keys());
    }
}

module.exports = { P2P, MESSAGE_TYPES };
