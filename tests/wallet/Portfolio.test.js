const Portfolio = require('../../src/wallet/Portfolio');

describe('Portfolio Class', () => {
    let portfolio;
    const ownerId = 'myId';

    beforeEach(() => {
        portfolio = new Portfolio(ownerId);
    });

    test('should initialize with the correct owner ID', () => {
        expect(portfolio.ownerId).toBe(ownerId);
    });

    test('should update and retrieve balance', () => {
        portfolio.updateBalance('alice', 50);
        expect(portfolio.getBalance('alice')).toBe(50);
    });

    test('updateBalance should overwrite existing balance', () => {
        portfolio.updateBalance('alice', 50);
        portfolio.updateBalance('alice', 75);
        expect(portfolio.getBalance('alice')).toBe(75);
    });

    test('should return 0 for unknown issuer', () => {
        expect(portfolio.getBalance('bob')).toBe(0);
    });

    test('should return correct summary', () => {
        portfolio.updateBalance('alice', 50);
        portfolio.updateBalance('bob', 20);
        
        const summary = portfolio.getSummary();
        expect(summary).toEqual({ alice: 50, bob: 20 });
    });

    test('getSummary should return an empty object for an empty portfolio', () => {
        const summary = portfolio.getSummary();
        expect(summary).toEqual({});
    });

    describe('syncPortfolio', () => {
        test('should sync balances from various network nodes', async () => {
            const mockNode1 = {
                userId: 'alice',
                getBalanceForUser: jest.fn().mockReturnValue(100)
            };
            const mockNode2 = {
                userId: 'bob',
                getBalanceForUser: jest.fn().mockReturnValue(200)
            };
            const mockNode3 = { // This node doesn't have a balance for the user
                userId: 'charlie',
                getBalanceForUser: jest.fn().mockReturnValue(0)
            };

            const networkNodes = [mockNode1, mockNode2, mockNode3];

            await portfolio.syncPortfolio(networkNodes);

            expect(mockNode1.getBalanceForUser).toHaveBeenCalledWith(ownerId);
            expect(mockNode2.getBalanceForUser).toHaveBeenCalledWith(ownerId);
            expect(mockNode3.getBalanceForUser).toHaveBeenCalledWith(ownerId);
            
            expect(portfolio.getBalance('alice')).toBe(100);
            expect(portfolio.getBalance('bob')).toBe(200);
            expect(portfolio.getBalance('charlie')).toBe(0);
        });

        test('should handle nodes that throw errors gracefully', async () => {
            const mockNode1 = {
                userId: 'alice',
                getBalanceForUser: jest.fn().mockReturnValue(100)
            };
            const mockNodeError = {
                userId: 'error_node',
                getBalanceForUser: jest.fn().mockImplementation(() => {
                    throw new Error('Network error');
                })
            };

            const networkNodes = [mockNode1, mockNodeError];

            await expect(portfolio.syncPortfolio(networkNodes)).resolves.not.toThrow();

            expect(portfolio.getBalance('alice')).toBe(100);
            expect(portfolio.getBalance('error_node')).toBe(0);
        });
    });
});
