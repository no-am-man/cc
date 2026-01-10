// Mock Firebase Dependencies
jest.mock('../../src/firebase/p2p', () => ({
    broadcastBlock: jest.fn(),
    listenForBlocks: jest.fn(),
}));

jest.mock('../../src/firebase/storage', () => ({
    saveDocument: jest.fn(),
    getDocument: jest.fn(),
    getCollectionDocs: jest.fn(),
}));

const UserNode = require('../../src/core/UserNode').default || require('../../src/core/UserNode');
const { broadcastBlock } = require('../../src/firebase/p2p');
const { saveDocument, getDocument } = require('../../src/firebase/storage');

describe('UserNode Class', () => {
    let node;
    const testUserId = 'test_user';

    beforeEach(async () => {
        jest.clearAllMocks();
        
        // Setup mock return values for clean initialization
        getDocument.mockImplementation((collection, docId) => {
            if (collection === 'keys') return Promise.resolve(null); // Force generate
            if (collection === 'chains') return Promise.resolve(null);
            if (collection === 'trust') return Promise.resolve({ lines: [] });
            return Promise.resolve(null);
        });

        node = new UserNode(testUserId);
        await node.initialize();
    });

    test('should initialize and generate keys', async () => {
        expect(node.userId).toBe(testUserId);
        expect(node.keyPair).toBeDefined();
        expect(node.keyPair.publicKey).toBeDefined();
        // Should save keys
        expect(saveDocument).toHaveBeenCalledWith('keys', testUserId, expect.any(Object));
    });

    test('should load existing keys if available', async () => {
        const mockKeys = { publicKey: 'pk', privateKey: 'sk' };
        
        // Reset mocks so previous calls don't interfere
        jest.clearAllMocks();
        getDocument.mockResolvedValueOnce(mockKeys); // Mock keys response

        const node2 = new UserNode(testUserId);
        await node2.initialize();

        expect(node2.keyPair).toEqual(mockKeys);
        expect(saveDocument).not.toHaveBeenCalledWith('keys', expect.any(String), expect.any(Object));
    });

    test('should mint coins and broadcast the block', async () => {
        const block = await node.mint(100);
        expect(node.chain.state.balance).toBe(100);
        expect(saveDocument).toHaveBeenCalledWith('chains', testUserId, expect.objectContaining({
            chain: expect.arrayContaining([expect.objectContaining({ type: 'MINT' })])
        }));
        expect(broadcastBlock).toHaveBeenCalledWith(block);
    });

    test('should load chain from DB on startup', async () => {
        // First node creates some state (mocked)
        const mockChain = [
            { index: 0, hash: 'genesis', type: 'GENESIS' },
            { index: 1, hash: 'abc', type: 'MINT', data: { amount: 50 } }
        ];
        
        // Reset mocks for second node
        getDocument.mockImplementation((col) => {
            if (col === 'chains') return Promise.resolve({ chain: mockChain });
            if (col === 'keys') return Promise.resolve({ publicKey: 'pk' });
            return Promise.resolve(null);
        });

        const node2 = new UserNode(testUserId);
        await node2.initialize();

        expect(node2.chain.chain.length).toBe(2);
        // Balance calculation logic is inside UserChain updateState, we need to ensure it ran
        // Since we are mocking the raw data, UserNode.loadChain replays it.
        // However, UserChain logic relies on proper Block structure/validation.
        // Simplest check is chain length.
        expect(node2.chain.chain).toEqual(mockChain);
    });

    describe('Trust Lines', () => {
        test('should add and save a trust line', () => {
            node.addTrustLine('friend');
            expect(node.trustLines.has('friend')).toBe(true);
            expect(saveDocument).toHaveBeenCalledWith('trust', testUserId, { lines: ['friend'] });
        });

        test('should remove a trust line', () => {
            node.addTrustLine('friend');
            node.removeTrustLine('friend');
            expect(node.trustLines.has('friend')).toBe(false);
            expect(saveDocument).toHaveBeenCalledWith('trust', testUserId, { lines: [] });
        });

        test('isTrusted should return true if no trust lines are set', () => {
            expect(node.isTrusted('anyone')).toBe(true);
        });

        test('isTrusted should return false for untrusted user', () => {
            node.addTrustLine('friend');
            expect(node.isTrusted('foe')).toBe(false);
        });
    });

    describe('Transactions and Asset Management', () => {
        test('handleTransferRequest should throw error for insufficient funds', () => {
            const req = { from: 'alice', to: 'bob', amount: 50 };
            expect(() => node.handleTransferRequest(req)).toThrow("Insufficient funds");
        });

        test('sendAsset should return LOCAL for native sends and broadcast', async () => {
            const result = await node.sendAsset(testUserId, 10, 'recipient');
            expect(result.type).toBe('LOCAL');
            expect(result.block).toBeDefined();
            expect(broadcastBlock).toHaveBeenCalledWith(result.block);
        });

        test('sendAsset should return REMOTE for third-party transfers', async () => {
            const result = await node.sendAsset('another_issuer', 10, 'recipient');
            expect(result.type).toBe('REMOTE');
            expect(result.targetNode).toBe('another_issuer');
            expect(result.request.signature).toBeDefined();
            expect(broadcastBlock).not.toHaveBeenCalled();
        });

        test('receiveTransaction should throw error for untrusted source', async () => {
            node.addTrustLine('trusted_friend');
            await expect(node.receiveTransaction('untrusted_source', 10, 'some_hash'))
                .rejects.toThrow('Trust Error');
            expect(broadcastBlock).not.toHaveBeenCalled();
        });

        test('receiveTransaction should succeed for trusted source and broadcast', async () => {
            node.addTrustLine('trusted_friend');
            const block = await node.receiveTransaction('trusted_friend', 10, 'some_hash');
            expect(block).toBeDefined();
            expect(broadcastBlock).toHaveBeenCalledWith(block);
        });
    });
    
    describe('Signatures', () => {
        test('should sign data and verify signature', () => {
            const data = { message: 'hello world' };
            const signature = node.signData(data);
            const isValid = UserNode.verifySignature(data, signature, node.keyPair.publicKey);
            expect(isValid).toBe(true);
        });
    });

    test('handleTransferRequest should execute successfully and broadcast', () => {
        // Manually inject state for test
        node.chain.state.ledger = { 'alice': 100 };
        
        const req = {
            from: 'alice',
            to: 'bob',
            amount: 50,
            signature: 'sig'
        };

        const result = node.handleTransferRequest(req);
        expect(result.success).toBe(true);
        // Need to check the CONTRACT execution result in the chain state
        // The handleTransferRequest creates a block which updates state
        const latestBlock = node.chain.getLatestBlock();
        expect(latestBlock.type).toBe('CONTRACT');
        expect(broadcastBlock).toHaveBeenCalled();
    });

    test('should log error if loadChain fails to replay', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const mockChain = [{ index: 0, hash: 'gen', type: 'GENESIS' }, { index: 1, hash: 'bad', type: 'MINT', data: { amount: 10 } }];
        
        getDocument.mockImplementation((col) => {
            if (col === 'chains') return Promise.resolve({ chain: mockChain });
            if (col === 'keys') return Promise.resolve({ publicKey: 'pk' });
            return Promise.resolve(null);
        });

        // Mock updateState to throw
        const node2 = new UserNode(testUserId);
        // We can't easily mock UserChain.updateState here because it's instantiated inside.
        // But we can force an error by providing invalid block data that updateState dislikes?
        // Actually updateState logic is in UserChain.
        // If we provide a block type that doesn't exist? Switch default does nothing.
        // If we provide MINT with negative amount?
        mockChain[1].data.amount = -10; 

        await node2.initialize();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Error replaying block 1"), expect.any(String));
        consoleSpy.mockRestore();
    });

    test('should save external chain', async () => {
        await node.saveExternalChain('bob', [{ hash: '123' }]);
        expect(node.externalChains.get('bob')).toEqual([{ hash: '123' }]);
    });

    test('handleIncomingBlock should ignore own blocks', () => {
        const block = { publicKey: node.keyPair.publicKey, type: 'MINT', hash: '123' };
        node.handleIncomingBlock(block);
        // Should not log "Received block..."
        // We can check if any side effect happened (none expected)
    });

    test('handleIncomingBlock should ignore invalid blocks', () => {
        node.handleIncomingBlock(null);
        node.handleIncomingBlock({});
        node.handleIncomingBlock({ type: 'MINT' }); // Missing hash
    });

    test('handleIncomingBlock should process valid blocks', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const block = { publicKey: 'other', type: 'MINT', hash: '123' };
        node.handleIncomingBlock(block);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Received block"));
        consoleSpy.mockRestore();
    });
});
