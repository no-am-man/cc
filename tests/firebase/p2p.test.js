// Mock Firebase
jest.mock('firebase/firestore', () => ({
    getFirestore: jest.fn(),
    collection: jest.fn(),
    addDoc: jest.fn(),
    onSnapshot: jest.fn(),
}));

jest.mock('../../src/firebase/firebase', () => ({}));

const { addDoc, onSnapshot } = require('firebase/firestore');
const { broadcastBlock, listenForBlocks } = require('../../src/firebase/p2p');

describe('P2P Adapter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('broadcastBlock should add document to blocks collection', async () => {
        addDoc.mockResolvedValue({ id: 'doc123' });
        await broadcastBlock({ hash: 'abc' });
        expect(addDoc).toHaveBeenCalled();
    });

    test('broadcastBlock should handle errors', async () => {
        addDoc.mockRejectedValue(new Error('Network error'));
        // Should not throw, just log
        await broadcastBlock({ hash: 'abc' });
        expect(addDoc).toHaveBeenCalled();
    });

    test('listenForBlocks should set up snapshot listener', () => {
        const unsubscribeMock = jest.fn();
        onSnapshot.mockReturnValue(unsubscribeMock);
        
        const callback = jest.fn();
        const unsubscribe = listenForBlocks(callback);
        
        expect(onSnapshot).toHaveBeenCalled();
        expect(unsubscribe).toBe(unsubscribeMock);
    });

    test('listenForBlocks callback should be triggered on updates', () => {
        // Mock onSnapshot implementation to trigger callback immediately
        onSnapshot.mockImplementation((query, cb) => {
            const mockSnapshot = [
                { data: () => ({ hash: '123' }) }
            ];
            cb(mockSnapshot);
            return jest.fn();
        });

        const callback = jest.fn();
        listenForBlocks(callback);
        
        expect(callback).toHaveBeenCalledWith({ hash: '123' });
    });
});

