// src/network/P2P.js
const WebSocket = require('ws');

const MESSAGE_TYPES = {
    HANDSHAKE: 'HANDSHAKE',
    CHAIN_REQUEST: 'CHAIN_REQUEST',
    CHAIN_RESPONSE: 'CHAIN_RESPONSE',
    NEW_BLOCK: 'NEW_BLOCK',
    TRANSFER_REQUEST: 'TRANSFER_REQUEST'
};

class P2P {
    constructor(port, userNode) {
        this.sockets = [];
        this.userNode = userNode; // This might be null in Gateway Mode
        this.API_VERSION = '1.0.0';
        
        // Router function for Gateway Mode
        this.resolveNode = null; 
        
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
            console.log(`Socket disconnected: ${socket.nodeId || 'unknown'}`);
        });

        // If we have a default node (Legacy Mode), send handshake immediately
        if (this.userNode) {
            this.sendHandshake(socket, this.userNode);
        }
    }

    handleMessage(socket, message) {
        // In Gateway Mode, we might need to route messages to specific UserNodes
        // Currently, we assume broadcast or specific handling.
        
        // For Re-Public, we might host MULTIPLE nodes.
        // Incoming messages often target a specific "toAddress".
        // Let's see if we can resolve a local node for the message.
        
        let targetNode = this.userNode; // Default

        if (message.type === 'NEW_BLOCK' && message.payload.data && message.payload.data.toAddress) {
            if (this.resolveNode) {
                const resolved = this.resolveNode(message.payload.data.toAddress);
                if (resolved) targetNode = resolved;
            }
        }

        // Pass to handler with context
        this.processMessage(socket, message, targetNode);
    }

    processMessage(socket, message, node) {
        // If no node context found for this message, we might just forward it or ignore
        // But for Handshakes, we might want to respond with ALL hosted nodes? 
        // Or just the gateway identity?
        
        switch (message.type) {
            case MESSAGE_TYPES.HANDSHAKE:
                console.log(`Received Handshake from Node: ${message.payload.nodeId}`);
                socket.nodeId = message.payload.nodeId;
                // If we are a gateway, we might not have a single ID to handshake back with yet.
                // Or we handshake as "Gateway".
                // Ideally, we send a handshake for the specific node we represent if we initiated.
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
                
                // If this is a payment to 'node'
                if (node && block.type === 'SEND' && block.data.toAddress === node.userId) {
                    console.log(`💰 Incoming payment for ${node.userId} from ${block.data.fromAddress}`);
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
                            console.log(`✅ Accepted Payment for ${node.userId}`);
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
                // If the target 'from' matches one of our hosted nodes
                if (this.resolveNode) {
                    const issuerNode = this.resolveNode(message.payload.from);
                    if (issuerNode) {
                        try {
                            const result = issuerNode.handleTransferRequest(message.payload);
                            if (result.success) {
                                this.broadcast({
                                    type: MESSAGE_TYPES.NEW_BLOCK,
                                    payload: issuerNode.chain.getLatestBlock()
                                });
                            }
                        } catch (e) {
                            console.error('Transfer Request Failed:', e.message);
                        }
                    }
                } else if (node) {
                    // Legacy single node check
                    if (message.payload.from === node.userId) {
                         // same logic
                    }
                }
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
            nodeId: s.nodeId || 'Unknown',
            url: s._peerUrl || 'Incoming Connection'
        }));
    }
}

module.exports = { P2P, MESSAGE_TYPES };
