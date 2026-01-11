// Mock Firebase
jest.mock('firebase/firestore', () => ({
    getFirestore: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
    deleteDoc: jest.fn(),
    collection: jest.fn(),
    getDocs: jest.fn(),
}));

jest.mock('../../src/firebase/firebase', () => ({}));

const { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } = require('firebase/firestore');
const { saveDocument, getDocument, getCollectionDocs, deleteDocument } = require('../../src/firebase/storage');

describe('Storage Adapter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('saveDocument should write to firestore', async () => {
        setDoc.mockResolvedValue(true);
        await saveDocument('users', 'alice', { name: 'Alice' });
        expect(doc).toHaveBeenCalled();
        expect(setDoc).toHaveBeenCalledWith(undefined, { name: 'Alice' }, { merge: true });
    });

    test('saveDocument should handle errors', async () => {
        setDoc.mockRejectedValue(new Error('Write failed'));
        await expect(saveDocument('users', 'alice', {}))
            .rejects.toThrow('Write failed');
    });

    test('deleteDocument should delete from firestore', async () => {
        deleteDoc.mockResolvedValue(true);
        await deleteDocument('users', 'alice');
        expect(doc).toHaveBeenCalled();
        expect(deleteDoc).toHaveBeenCalled();
    });

    test('deleteDocument should handle errors', async () => {
        deleteDoc.mockRejectedValue(new Error('Delete failed'));
        await expect(deleteDocument('users', 'alice'))
            .rejects.toThrow('Delete failed');
    });

    test('getDocument should return data if exists', async () => {
        setDoc.mockResolvedValue(true);
        await saveDocument('users', 'alice', { name: 'Alice' });
        expect(doc).toHaveBeenCalled();
        expect(setDoc).toHaveBeenCalledWith(undefined, { name: 'Alice' }, { merge: true });
    });

    test('saveDocument should handle errors', async () => {
        setDoc.mockRejectedValue(new Error('Write failed'));
        await expect(saveDocument('users', 'alice', {}))
            .rejects.toThrow('Write failed');
    });

    test('getDocument should return data if exists', async () => {
        getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({ name: 'Alice' })
        });
        const data = await getDocument('users', 'alice');
        expect(data).toEqual({ name: 'Alice' });
    });

    test('getDocument should return null if not exists', async () => {
        getDoc.mockResolvedValue({
            exists: () => false
        });
        const data = await getDocument('users', 'bob');
        expect(data).toBeNull();
    });

    test('getDocument should handle errors gracefully', async () => {
        getDoc.mockRejectedValue(new Error('Read failed'));
        const data = await getDocument('users', 'alice');
        expect(data).toBeNull();
    });

    test('getCollectionDocs should return array of data', async () => {
        getDocs.mockResolvedValue([
            { id: '1', data: () => ({ val: 'a' }) },
            { id: '2', data: () => ({ val: 'b' }) }
        ]);
        const data = await getCollectionDocs('chains');
        expect(data).toHaveLength(2);
        expect(data[0]).toEqual({ id: '1', val: 'a' });
    });

    test('getCollectionDocs should handle errors gracefully', async () => {
        getDocs.mockRejectedValue(new Error('Query failed'));
        const data = await getCollectionDocs('chains');
        expect(data).toEqual([]);
    });
});

