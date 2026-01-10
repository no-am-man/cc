import { createMocks } from 'node-mocks-http';
import mintHandler from '../../pages/api/mint';
import infoHandler from '../../pages/api/info';
import { getSession } from 'next-auth/react';
import { getNodeForUser } from '../../src/core/nodeManager';
import Oracle from '../../src/Oracle';

jest.mock('next-auth/react');
jest.mock('../../src/core/nodeManager');
jest.mock('../../src/Oracle');

describe('API Endpoints', () => {
  let mockNode;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockNode = {
      userId: 'test-user',
      keyPair: { publicKey: 'pub-key' },
      chain: {
        getInflationStats: jest.fn().mockReturnValue({ balance: 100 }),
      },
      trustLines: new Set(['trusted-user']),
      mint: jest.fn(),
      createTransaction: jest.fn(),
      addTrustLine: jest.fn(),
      removeTrustLine: jest.fn(),
    };

    getNodeForUser.mockResolvedValue(mockNode);
    getSession.mockResolvedValue({ user: { email: 'test-user' } });
    Oracle.getPrice.mockReturnValue(0.85);
  });

  describe('/api/mint', () => {
    test('mints tokens successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: { amount: 50 },
      });

      mockNode.mint.mockResolvedValue({ hash: 'block-hash' });

      await mintHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        success: true,
        block: { hash: 'block-hash' },
      });
      expect(mockNode.mint).toHaveBeenCalledWith(50);
    });

    test('returns 405 for non-POST requests', async () => {
        const { req, res } = createMocks({ method: 'GET' });
        await mintHandler(req, res);
        expect(res._getStatusCode()).toBe(405);
    });

    test('handles errors', async () => {
        const { req, res } = createMocks({ method: 'POST', body: { amount: -10 } });
        mockNode.mint.mockRejectedValue(new Error('Invalid amount'));
        
        await mintHandler(req, res);
        expect(res._getStatusCode()).toBe(400);
    });
  });

  describe('/api/info', () => {
      test('returns node info', async () => {
          const { req, res } = createMocks({ method: 'GET' });
          await infoHandler(req, res);

          expect(res._getStatusCode()).toBe(200);
          const data = JSON.parse(res._getData());
          expect(data).toMatchObject({
              nodeId: 'test-user',
              silverPrice: 0.85,
              inflationStats: { balance: 100 },
          });
      });
  });
});

