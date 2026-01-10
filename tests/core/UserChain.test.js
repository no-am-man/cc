const UserChain = require('../../src/core/UserChain');
const Block = require('../../src/core/Block');
const crypto = require('crypto');

describe('UserChain Class', () => {
    let chain;
    let keyPair;

    beforeEach(() => {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        keyPair = { publicKey, privateKey };
        chain = new UserChain('user1', keyPair);
    });

    test('should start with genesis block', () => {
        expect(chain.chain.length).toBe(1);
        expect(chain.chain[0].type).toBe('GENESIS');
    });

    test('mint should increase balance and totalSupply', () => {
        chain.mint(100);
        expect(chain.state.balance).toBe(100);
        expect(chain.state.totalSupply).toBe(100);
        expect(chain.chain.length).toBe(2);
        expect(chain.chain[1].type).toBe('MINT');
    });

    test('mint should throw error for negative amount', () => {
        expect(() => chain.createBlock('MINT', { amount: -10 })).toThrow("Mint amount must be positive");
    });

    test('createTransaction should decrease balance (allowing negative)', () => {
        chain.mint(50);
        chain.createTransaction(60, 'recipient');
        
        expect(chain.state.balance).toBe(-10);
        expect(chain.chain.length).toBe(3);
    });

    test('receiveTransaction should increase balance', () => {
        chain.receiveTransaction('sender', 50, 'hash123');
        expect(chain.state.balance).toBe(50);
        const block = chain.getLatestBlock();
        expect(block.type).toBe('RECEIVE');
    });

    test('isChainValid should return true for valid chain', () => {
        chain.mint(100);
        chain.createTransaction(50, 'recipient');
        expect(chain.isChainValid()).toBe(true);
    });

    test('isChainValid should return false if block data modified', () => {
        chain.mint(100);
        // Tamper with block
        chain.chain[1].data.amount = 1000;
        expect(chain.isChainValid()).toBe(false);
    });

    test('isChainValid should return false if previousHash is wrong', () => {
        chain.mint(100);
        chain.chain[1].previousHash = 'wrong';
        expect(chain.isChainValid()).toBe(false);
    });

    test('addBlock should throw if previousHash is invalid', () => {
        const block = new Block(1, Date.now(), {}, 'wronghash', 'MINT');
        expect(() => chain.addBlock(block)).toThrow('Invalid previous hash');
    });

    test('addBlock should throw if index is invalid', () => {
        const latest = chain.getLatestBlock();
        const block = new Block(latest.index + 2, Date.now(), {}, latest.hash, 'MINT');
        expect(() => chain.addBlock(block)).toThrow('Invalid block index');
    });

    test('addBlock should throw if hash is invalid', () => {
        const latest = chain.getLatestBlock();
        const block = new Block(latest.index + 1, Date.now(), {}, latest.hash, 'MINT');
        block.hash = 'fakehash';
        expect(() => chain.addBlock(block)).toThrow('Invalid block hash');
    });

    test('should handle plain object blocks (loaded from JSON)', () => {
        // Create a real block
        const block = chain.mint(100);
        
        // Convert to plain object to simulate JSON load
        const plainBlock = JSON.parse(JSON.stringify(block));
        chain.chain[1] = plainBlock;

        // Create next block - should work even if previous is plain object
        const block2 = chain.mint(50);
        expect(block2.previousHash).toBe(plainBlock.hash);
        expect(chain.isChainValid()).toBe(true);
    });

    test('should execute CONTRACT blocks', () => {
        // Manually create a contract block
        const code = `state.balance += 1000;`;
        chain.createBlock('CONTRACT', { code, params: {} });
        
        expect(chain.state.balance).toBe(1000);
    });

    test('getInflationStats should return correct stats', () => {
        chain.mint(100);
        const stats = chain.getInflationStats();
        expect(stats.totalMinted).toBe(100);
        expect(stats.currentBalance).toBe(100);
        expect(stats.circulatingSupply).toBe(100);
    });
});
