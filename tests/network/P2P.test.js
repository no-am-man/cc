// tests/network/P2P.test.js
const { P2P, MESSAGE_TYPES } = require('../../src/network/P2P');
const UserNode = require('../../src/core/UserNode');

// Mock UserNode
jest.mock('../../src/core/UserNode');

describe('P2P Network', () => {
    let p2p;
    let mockUserNode;
    let mockSocket;

    beforeEach(() => {
        mockUserNode = new UserNode('test-node');
        mockUserNode.userId = 'test-node';
        mockUserNode.keyPair = { publicKey: 'pub', privateKey: 'priv' };
        mockUserNode.chain = { chain: [], getLatestBlock: jest.fn() };
        mockUserNode.handleTransferRequest = jest.fn().mockReturnValue({ success: true });
        mockUserNode.updateExternalChain = jest.fn();

        p2p = new P2P(6001, mockUserNode);
        
        mockSocket = {
            send: jest.fn(),
            readyState: 1, // OPEN
            nodeId: 'peer-node'
        };
        
        // Mock console.log to avoid noise
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        p2p.server.close();
        jest.clearAllMocks();
    });

    test('handleMessage: HANDSHAKE', () => {
        const msg = {
            type: MESSAGE_TYPES.HANDSHAKE,
            payload: { nodeId: 'peer-node', version: '1.0.0' }
        };
        
        // Trigger handleMessage directly (simulating socket event)
        // Since handleMessage is bound to socket in P2P.js, we need to mimic the flow 
        // or just call processMessage if accessible. 
        // P2P.js structure calls processMessage(socket, message, node).
        
        p2p.processMessage(mockSocket, msg, mockUserNode);
        
        // We can't easily expect console.log 'Received Handshake' because 
        // console.log is mocked with empty function.
        // Instead, check side effects: socket.nodeId should be set
        expect(mockSocket.nodeId).toBe('peer-node');
        
        // It should add to directory
        expect(p2p.directory.has('peer-node')).toBe(true);
    });

    test('handleMessage: CHAIN_REQUEST should send chain', () => {
        const msg = { type: MESSAGE_TYPES.CHAIN_REQUEST, payload: {} };
        
        p2p.processMessage(mockSocket, msg, mockUserNode);
        
        expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('CHAIN_RESPONSE'));
    });

    test('handleMessage: TRANSFER_REQUEST should call userNode', () => {
        const payload = { from: 'test-node', amount: 10, to: 'Bob' };
        const msg = { 
            type: MESSAGE_TYPES.TRANSFER_REQUEST, 
            payload 
        };
        
        p2p.processMessage(mockSocket, msg, mockUserNode);
        expect(mockUserNode.handleTransferRequest).toHaveBeenCalledWith(payload);
    });
});
