import UserNode from '../../src/core/UserNode';
import { saveDocument, getDocument } from '../../src/firebase/storage';

// Mock Firestore storage
jest.mock('../../src/firebase/storage', () => {
    const db = new Map();
    return {
        saveDocument: jest.fn(async (collection, id, data) => {
            if (!db.has(collection)) db.set(collection, new Map());
            db.get(collection).set(id, data);
            // console.log(`[MockDB] Saved ${collection}/${id}`, data);
        }),
        getDocument: jest.fn(async (collection, id) => {
            const collectionMap = db.get(collection);
            const data = collectionMap ? collectionMap.get(id) : null;
            // console.log(`[MockDB] Read ${collection}/${id}`, data);
            return data;
        }),
        getCollectionDocs: jest.fn(async () => [])
    };
});

jest.mock('../../src/firebase/p2p', () => ({
    broadcastBlock: jest.fn(),
    listenForBlocks: jest.fn()
}));

// Mock Firebase
jest.mock('firebase/firestore', () => ({}));
jest.mock('firebase/app', () => ({}));
jest.mock('../../src/firebase/firebase', () => ({}));

describe('Persistence Integration', () => {
    const userId = 'user@example.com';

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset DB mock? Ideally yes, but the map is in closure.
        // We can rely on overwriting or unique IDs if needed.
    });

    test('minting should persist balance across node instances', async () => {
        // 1. Create Node A (Simulate Request 1: Mint)
        const nodeA = new UserNode(userId);
        await nodeA.initialize();
        
        const amount = 100;
        await nodeA.mint(amount);
        
        const balanceA = nodeA.chain.getInflationStats().currentBalance;
        expect(balanceA).toBe(100);

        // Verify saveDocument was called
        expect(saveDocument).toHaveBeenCalledWith('chains', userId, expect.objectContaining({
            chain: expect.arrayContaining([expect.objectContaining({ type: 'MINT' })])
        }));

        // 2. Create Node B (Simulate Request 2: Poll)
        // This simulates a fresh serverless function invocation loading from DB
        const nodeB = new UserNode(userId);
        await nodeB.initialize();

        const balanceB = nodeB.chain.getInflationStats().currentBalance;
        
        // This assertion fails if loadChain doesn't correctly replay state
        expect(balanceB).toBe(100);
    });
});

