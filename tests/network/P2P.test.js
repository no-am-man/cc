const { P2P, MESSAGE_TYPES } = require('../../src/network/P2P');
const WebSocket = require('ws');

// Mock WebSocket
const mockSend = jest.fn();
const mockOn = jest.fn();
const mockSocket = {
    send: mockSend,
    on: mockOn,
    readyState: WebSocket.OPEN
};

// Mock UserNode
const mockUserNode = {
    userId: 'test_node',
    keyPair: { publicKey: 'pubkey' },
    chain: {
        chain: [],
        getLatestBlock: jest.fn().mockReturnValue({})
    },
    handleTransferRequest: jest.fn()
};

describe('P2P Network', () => {
    let p2p;

    beforeEach(() => {
        // Suppress console.log for cleaner test output
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        
        p2p = new P2P(6001, mockUserNode);
    });

    afterEach(() => {
        p2p.server.close();
        jest.clearAllMocks();
    });

    test('should initialize server', () => {
        expect(p2p.server).toBeDefined();
    });

    test('connectSocket should add socket and send handshake', () => {
        p2p.connectSocket(mockSocket);
        
        expect(p2p.sockets.length).toBe(1);
        expect(mockSend).toHaveBeenCalledWith(expect.stringContaining(MESSAGE_TYPES.HANDSHAKE));
    });

    test('handleMessage: HANDSHAKE', () => {
        const msg = {
            type: MESSAGE_TYPES.HANDSHAKE,
            payload: { nodeId: 'peer1', version: '1.0.0' }
        };
        p2p.handleMessage(mockSocket, msg);
        // Expect log
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Received Handshake'));
    });

    test('handleMessage: CHAIN_REQUEST should send chain', () => {
        const msg = { type: MESSAGE_TYPES.CHAIN_REQUEST };
        p2p.handleMessage(mockSocket, msg);
        expect(mockSend).toHaveBeenCalledWith(expect.stringContaining(MESSAGE_TYPES.CHAIN_RESPONSE));
    });

    test('handleMessage: TRANSFER_REQUEST should call userNode', () => {
        const payload = { from: 'Alice', to: 'Bob', amount: 10 };
        const msg = { type: MESSAGE_TYPES.TRANSFER_REQUEST, payload };
        
        mockUserNode.handleTransferRequest.mockReturnValue({ success: true });
        
        p2p.handleMessage(mockSocket, msg);
        expect(mockUserNode.handleTransferRequest).toHaveBeenCalledWith(payload);
        
        // Should broadcast new block if success
        // Since we are not mocking broadcast in this unit (it uses sockets.forEach), we can check if it tries to send to sockets
        // We added mockSocket to p2p.sockets manually? No, we just passed it to handleMessage.
        // Let's add it properly.
        p2p.sockets.push(mockSocket);
        p2p.handleMessage(mockSocket, msg);
        expect(mockSend).toHaveBeenCalledWith(expect.stringContaining(MESSAGE_TYPES.NEW_BLOCK));
    });
});
