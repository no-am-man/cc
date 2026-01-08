const UserChain = require('../../src/core/UserChain');
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

    test('createTransaction should decrease balance (allowing negative)', () => {
        chain.mint(50);
        chain.createTransaction(60, 'recipient');
        
        expect(chain.state.balance).toBe(-10);
        expect(chain.chain.length).toBe(3);
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
});

