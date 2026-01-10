const { P2P, MESSAGE_TYPES } = require('../../src/network/P2P');
const UserNode = require('../../src/core/UserNode');
const WebSocket = require('ws');

jest.mock('ws');

describe('P2P Network', () => {
    let p2p;
    let mockUserNode;
    let mockSocket;
    let mockServerInstance;

    beforeEach(() => {
        WebSocket.Server.mockClear();
        WebSocket.mockClear();

        mockUserNode = new UserNode('test-node');
        mockUserNode.userId = 'test-node';
        mockUserNode.keyPair = { publicKey: 'pub' };
        mockUserNode.chain = {
            chain: [{ index: 0, hash: 'genesis' }],
            getLatestBlock: jest.fn(),
            receiveTransaction: jest.fn().mockReturnValue({ hash: 'received' })
        };
        mockUserNode.handleTransferRequest = jest.fn();
        mockUserNode.updateExternalChain = jest.fn();

        p2p = new P2P(6001, mockUserNode);
        mockServerInstance = WebSocket.Server.mock.instances[0];

        jest.spyOn(p2p, 'send');
        jest.spyOn(p2p, 'broadcast');
        jest.spyOn(p2p, 'processMessage');

        mockSocket = {
            send: jest.fn(),
            readyState: WebSocket.OPEN,
            nodeId: 'peer-node',
            on: jest.fn(),
            close: jest.fn(),
            _peerUrl: 'ws://peer-url:6001'
        };

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        if (p2p.server && p2p.server.close) p2p.server.close();
        jest.restoreAllMocks();
    });

    describe('Connection Handling', () => {
        test('should handle server connection and assign remoteAddress', () => {
            const req = { socket: { remoteAddress: '127.0.0.1' } };
            const connectionHandler = mockServerInstance.on.mock.calls.find(c => c[0] === 'connection')[1];
            connectionHandler(mockSocket, req);
            expect(mockSocket._peerUrl).toBe('127.0.0.1');
            expect(p2p.sockets).toContain(mockSocket);
        });

        test('should handle peer connection error', () => {
            p2p.connectToPeer('ws://error-peer');
            const wsInstance = WebSocket.mock.instances[WebSocket.mock.instances.length - 1];
            const errorHandler = wsInstance.on.mock.calls.find(c => c[0] === 'error')[1];
            const error = new Error('Connection failed');
            errorHandler(error);
            expect(console.error).toHaveBeenCalledWith('Connection error with ws://error-peer:', error.message);
        });

        test('should handle socket closure and clean up directory', () => {
            p2p.directory.set('peer-node', mockSocket);
            p2p.connectSocket(mockSocket);
            const closeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'close')[1];
            closeHandler();
            expect(p2p.sockets).not.toContain(mockSocket);
            expect(p2p.directory.has('peer-node')).toBe(false);
        });
        
        test('should handle invalid JSON message', () => {
            p2p.connectSocket(mockSocket);
            const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message')[1];
            messageHandler('invalid-json');
            expect(console.error).toHaveBeenCalledWith('Failed to parse message:', expect.any(Error));
        });
    });

    describe('Message Routing and Processing', () => {
        test('should handle CHAIN_REQUEST and send chain back', () => {
            p2p.processMessage(mockSocket, { type: MESSAGE_TYPES.CHAIN_REQUEST }, mockUserNode);
            expect(p2p.send).toHaveBeenCalledWith(mockSocket, expect.objectContaining({ type: MESSAGE_TYPES.CHAIN_RESPONSE }));
        });

        test('should handle CHAIN_RESPONSE and update external chain', () => {
            const chain = [{ index: 1 }];
            p2p.processMessage(mockSocket, { type: MESSAGE_TYPES.CHAIN_RESPONSE, payload: { nodeId: 'remote', chain } }, mockUserNode);
            expect(mockUserNode.updateExternalChain).toHaveBeenCalledWith('remote', chain);
        });

        test('should forward message if target is in directory', () => {
            const gatewaySocket = { send: jest.fn(), readyState: WebSocket.OPEN };
            p2p.directory.set('remote-user', gatewaySocket);
            p2p.resolveNode = jest.fn().mockReturnValue(null); // Ensure it doesn't resolve locally

            const msg = { type: MESSAGE_TYPES.TRANSFER_REQUEST, payload: { from: 'remote-user' } };
            p2p.handleMessage(mockSocket, msg);
            
            expect(gatewaySocket.send).toHaveBeenCalledWith(JSON.stringify(msg));
            expect(p2p.processMessage).not.toHaveBeenCalled();
        });
        
        test('should not forward if gateway socket is closed', () => {
            const gatewaySocket = { send: jest.fn(), readyState: WebSocket.CLOSED };
            p2p.directory.set('remote-user', gatewaySocket);
            p2p.resolveNode = jest.fn();

            const msg = { type: MESSAGE_TYPES.TRANSFER_REQUEST, payload: { from: 'remote-user' } };
            p2p.handleMessage(mockSocket, msg);
            expect(gatewaySocket.send).not.toHaveBeenCalled();
            expect(p2p.processMessage).toHaveBeenCalledWith(mockSocket, msg, mockUserNode);
        });
    });
});
