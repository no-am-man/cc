
// Mock the p2p module to prevent network/Firebase errors during tests
jest.mock('../../src/firebase/p2p', () => ({
    broadcastBlock: jest.fn(),
    listenForBlocks: jest.fn(),
}));

const UserNode = require('../../src/core/UserNode');
const fs = require('fs');
const path = require('path');
// Import the mocked function to check if it's called
const { broadcastBlock } = require('../../src/firebase/p2p');

describe('UserNode Class', () => {
    let node;
    const testUserId = 'test_user';
    const dataDir = path.join(__dirname, '../../data');
    const chainFile = path.join(dataDir, `${testUserId}_chain.json`);
    const keysFile = path.join(dataDir, `${testUserId}_keys.json`);
    const trustFile = path.join(dataDir, `${testUserId}_trust.json`);

    beforeEach(() => {
        // Clear mock history before each test
        broadcastBlock.mockClear();

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        node = new UserNode(testUserId);
    });

    afterEach(() => {
        if (fs.existsSync(chainFile)) fs.unlinkSync(chainFile);
        if (fs.existsSync(keysFile)) fs.unlinkSync(keysFile);
        if (fs.existsSync(trustFile)) fs.unlinkSync(trustFile);
        const externalChainFile = path.join(dataDir, `external_another_user_chain.json`);
        if (fs.existsSync(externalChainFile)) fs.unlinkSync(externalChainFile);
    });

    test('should initialize and generate keys', () => {
        expect(node.userId).toBe(testUserId);
        expect(node.keyPair).toBeDefined();
        expect(node.keyPair.publicKey).toBeDefined();
        expect(fs.existsSync(keysFile)).toBe(true);
    });

    test('should load existing keys if available', () => {
        const firstKeys = node.keyPair;
        const node2 = new UserNode(testUserId);
        expect(node2.keyPair.publicKey).toBe(firstKeys.publicKey);
    });

    test('should mint coins and broadcast the block', () => {
        const block = node.mint(100);
        expect(node.chain.state.balance).toBe(100);
        expect(fs.existsSync(chainFile)).toBe(true);
        const data = JSON.parse(fs.readFileSync(chainFile, 'utf8'));
        expect(data.length).toBe(2);
        expect(broadcastBlock).toHaveBeenCalledWith(block);
    });

    test('should load chain from disk on startup', () => {
        node.mint(50);
        const node2 = new UserNode(testUserId);
        expect(node2.chain.chain.length).toBe(2);
        expect(node2.chain.state.balance).toBe(50);
    });

    describe('Trust Lines', () => {
        test('should add and save a trust line', () => {
            node.addTrustLine('friend');
            expect(node.trustLines.has('friend')).toBe(true);
            const node2 = new UserNode(testUserId);
            expect(node2.trustLines.has('friend')).toBe(true);
        });

        test('should remove a trust line', () => {
            node.addTrustLine('friend');
            node.addTrustLine('foe');
            node.removeTrustLine('foe');
            expect(node.trustLines.has('friend')).toBe(true);
            expect(node.trustLines.has('foe')).toBe(false);
        });

        test('isTrusted should return true if no trust lines are set', () => {
            expect(node.isTrusted('anyone')).toBe(true);
        });

        test('isTrusted should return false for untrusted user', () => {
            node.addTrustLine('friend');
            expect(node.isTrusted('foe')).toBe(false);
        });
    });

    describe('External Chains', () => {
        const remoteUserId = 'another_user';
        const remoteChainData = [{ index: 0, hash: 'abc' }];

        test('should save and load an external chain', () => {
            node.saveExternalChain(remoteUserId, remoteChainData);
            expect(node.externalChains.get(remoteUserId)).toEqual(remoteChainData);
            const node2 = new UserNode(testUserId);
            expect(node2.externalChains.get(remoteUserId)).toEqual(remoteChainData);
        });

        test('should update an external chain if new one is longer', () => {
            node.saveExternalChain(remoteUserId, remoteChainData);
            const newChainData = [{ index: 0, hash: 'abc' }, { index: 1, hash: 'def' }];
            node.updateExternalChain(remoteUserId, newChainData);
            expect(node.externalChains.get(remoteUserId)).toEqual(newChainData);
        });
    });

    describe('Transactions and Asset Management', () => {
        test('handleTransferRequest should throw error for insufficient funds', () => {
            const req = { from: 'alice', to: 'bob', amount: 50 };
            expect(() => node.handleTransferRequest(req)).toThrow("Insufficient funds");
        });

        test('sendAsset should return LOCAL for native sends and broadcast', () => {
            const result = node.sendAsset(testUserId, 10, 'recipient');
            expect(result.type).toBe('LOCAL');
            expect(result.block).toBeDefined();
            expect(broadcastBlock).toHaveBeenCalledWith(result.block);
        });

        test('sendAsset should return REMOTE for third-party transfers', () => {
            const result = node.sendAsset('another_issuer', 10, 'recipient');
            expect(result.type).toBe('REMOTE');
            expect(result.targetNode).toBe('another_issuer');
            expect(result.request.signature).toBeDefined();
            expect(broadcastBlock).not.toHaveBeenCalled();
        });

        test('receiveTransaction should throw error for untrusted source', () => {
            node.addTrustLine('trusted_friend');
            expect(() => node.receiveTransaction('untrusted_source', 10, 'some_hash')).toThrow('Trust Error');
            expect(broadcastBlock).not.toHaveBeenCalled();
        });

        test('receiveTransaction should succeed for trusted source and broadcast', () => {
            node.addTrustLine('trusted_friend');
            const block = node.receiveTransaction('trusted_friend', 10, 'some_hash');
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

        test('should fail to verify tampered data', () => {
            const data = { message: 'hello world' };
            const tamperedData = { message: 'hello darkness' };
            const signature = node.signData(data);
            const isValid = UserNode.verifySignature(tamperedData, signature, node.keyPair.publicKey);
            expect(isValid).toBe(false);
        });
    });

    test('handleTransferRequest should execute successfully and broadcast', () => {
        node.chain.createBlock('CONTRACT', {
            code: `state.ledger = { 'alice': 100 };`,
            params: {}
        });

        const req = {
            from: 'alice',
            to: 'bob',
            amount: 50,
            signature: 'sig'
        };

        const result = node.handleTransferRequest(req);
        expect(result.success).toBe(true);
        expect(node.chain.state.ledger['alice']).toBe(50);
        expect(node.chain.state.ledger['bob']).toBe(50);
        const latestBlock = node.chain.getLatestBlock();
        expect(broadcastBlock).toHaveBeenCalledWith(latestBlock);
    });
});
