const Block = require('../../src/core/Block');
const crypto = require('crypto');

describe('Block Class', () => {
    let block;
    let index = 1;
    let timestamp = 123456789;
    let data = { amount: 10 };
    let previousHash = '00000abc';

    beforeEach(() => {
        block = new Block(index, timestamp, data, previousHash);
    });

    test('should initialize correctly', () => {
        expect(block.index).toBe(index);
        expect(block.timestamp).toBe(timestamp);
        expect(block.data).toEqual(data);
        expect(block.previousHash).toBe(previousHash);
        expect(block.type).toBe('SEND'); // Default
        expect(block.hash).toBeDefined();
    });

    test('calculateHash should be consistent', () => {
        const hash1 = block.calculateHash();
        const hash2 = block.calculateHash();
        expect(hash1).toBe(hash2);
    });

    test('calculateHash should change if data changes', () => {
        const hash1 = block.calculateHash();
        block.data = { amount: 20 };
        const hash2 = block.calculateHash();
        expect(hash1).not.toBe(hash2);
    });

    test('signBlock should add a valid signature', () => {
        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        block.signBlock(privateKey);
        expect(block.signature).toBeDefined();
        expect(block.signature).not.toBe('');
        
        // Verify
        const isValid = block.verifySignature(publicKey);
        expect(isValid).toBe(true);
    });

    test('verifySignature should fail for invalid key', () => {
        const { privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        const { publicKey: wrongKey } = crypto.generateKeyPairSync('rsa', {
             modulusLength: 2048,
             publicKeyEncoding: { type: 'spki', format: 'pem' },
             privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
         });

        block.signBlock(privateKey);
        const isValid = block.verifySignature(wrongKey);
        expect(isValid).toBe(false);
    });
});
