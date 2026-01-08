const UserNode = require('../../src/core/UserNode');
const fs = require('fs');
const path = require('path');

describe('UserNode Class', () => {
    let node;
    const testUserId = 'test_user';
    const dataDir = path.join(__dirname, '../../data');
    const chainFile = path.join(dataDir, `${testUserId}_chain.json`);
    const keysFile = path.join(dataDir, `${testUserId}_keys.json`);

    beforeAll(() => {
        // Ensure data dir exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    });

    afterEach(() => {
        // Cleanup files
        if (fs.existsSync(chainFile)) fs.unlinkSync(chainFile);
        if (fs.existsSync(keysFile)) fs.unlinkSync(keysFile);
    });

    afterAll(() => {
         // Optional: clean up data dir if empty
    });

    test('should initialize and generate keys', () => {
        node = new UserNode(testUserId);
        expect(node.userId).toBe(testUserId);
        expect(node.keyPair).toBeDefined();
        expect(node.keyPair.publicKey).toBeDefined();
        expect(fs.existsSync(keysFile)).toBe(true);
    });

    test('should load existing keys if available', () => {
        node = new UserNode(testUserId);
        const firstKeys = node.keyPair;
        
        // Re-initialize
        const node2 = new UserNode(testUserId);
        expect(node2.keyPair.publicKey).toBe(firstKeys.publicKey);
    });

    test('should mint coins and persist chain', () => {
        node = new UserNode(testUserId);
        node.mint(100);
        
        expect(node.chain.state.balance).toBe(100);
        expect(fs.existsSync(chainFile)).toBe(true);
        
        // Verify persistence
        const data = JSON.parse(fs.readFileSync(chainFile, 'utf8'));
        expect(data.length).toBe(2); // Genesis + Mint
    });

    test('should load chain from disk on startup', () => {
        // 1. Create chain and save
        node = new UserNode(testUserId);
        node.mint(50);
        
        // 2. New instance
        const node2 = new UserNode(testUserId);
        expect(node2.chain.chain.length).toBe(2);
        expect(node2.chain.state.balance).toBe(50);
    });

    test('handleTransferRequest should execute successfully if valid', () => {
        node = new UserNode(testUserId);
        
        // Mock a user 'alice' who holds 100 of my coins
        // We simulate this by manipulating state directly or creating a mock ledger block
        // In our simple model, we check calculateBalanceForUser which reads ledger.
        // Let's manually inject a ledger state via a contract block first?
        // Or simpler: We just test the logic flow, assuming we have balance.
        
        // Let's create a "fake" contract block that sets Alice's balance to 100
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
    });
});
