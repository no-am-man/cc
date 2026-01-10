// Mock UserNode since nodeManager instantiates it
jest.mock('../../src/core/UserNode', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation((id) => ({
            userId: id,
            initialize: jest.fn().mockResolvedValue(true)
        }))
    };
});

const { getNodeForUser, getActiveNodes } = require('../../src/core/nodeManager');
const UserNode = require('../../src/core/UserNode').default;

describe('NodeManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getActiveNodes().clear();
    });

    test('should create a new node if not exists', async () => {
        const node = await getNodeForUser('alice@test.com');
        expect(node).toBeDefined();
        expect(node.userId).toBe('alice@test.com');
        expect(UserNode).toHaveBeenCalledWith('alice@test.com');
        expect(node.initialize).toHaveBeenCalled();
    });

    test('should return existing node if already active', async () => {
        const node1 = await getNodeForUser('alice@test.com');
        const node2 = await getNodeForUser('alice@test.com');
        
        expect(node1).toBe(node2);
        expect(UserNode).toHaveBeenCalledTimes(1);
    });

    test('should return null for invalid userId', async () => {
        const node = await getNodeForUser(null);
        expect(node).toBeNull();
    });

    test('should normalize user IDs', async () => {
        const node1 = await getNodeForUser('Alice@Test.com');
        const node2 = await getNodeForUser('alice@test.com');
        expect(node1).toBe(node2);
        expect(node1.userId).toBe('alice@test.com');
    });
});

