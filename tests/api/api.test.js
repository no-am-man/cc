// tests/api/api.test.js
const request = require('supertest');
const createApp = require('../../src/app');
const UserNode = require('../../src/core/UserNode');
const fs = require('fs');
const path = require('path');

// Clean up any test data for the API test node
const testNodeId = 'test-node';
const dataDir = path.join(__dirname, '../../data');
const chainFile = path.join(dataDir, `${testNodeId}_chain.json`);
const keysFile = path.join(dataDir, `${testNodeId}_keys.json`);

// Mock P2P with all methods
const mockP2P = {
    sockets: [],
    connectToPeer: jest.fn(),
    broadcast: jest.fn(),
    getConnectedPeers: jest.fn().mockReturnValue([])
};

describe('API Integration Tests', () => {
    let app;
    let node;

    beforeAll(() => {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(chainFile)) fs.unlinkSync(chainFile);
        if (fs.existsSync(keysFile)) fs.unlinkSync(keysFile);
    });

    beforeEach(() => {
        node = new UserNode(testNodeId);
        app = createApp(node, mockP2P);
    });

    test('GET /info should return node status', async () => {
        const res = await request(app).get('/info');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('nodeId', testNodeId);
        // Note: silverPrice might not be populated if Oracle fetch fails or hasn't run, 
        // but property should exist.
        expect(res.body).toHaveProperty('silverPrice');
    });

    test('POST /mint should create new coins', async () => {
        const res = await request(app)
            .post('/mint')
            .send({ amount: 100 });
        
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(node.chain.state.balance).toBe(100);
        expect(mockP2P.broadcast).toHaveBeenCalled();
    });

    test('GET /chain should return the blockchain', async () => {
        await request(app).post('/mint').send({ amount: 50 });
        
        const res = await request(app).get('/chain');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(1);
    });
});
