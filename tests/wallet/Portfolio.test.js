const Portfolio = require('../../src/wallet/Portfolio');

describe('Portfolio Class', () => {
    let portfolio;

    beforeEach(() => {
        portfolio = new Portfolio('myId');
    });

    test('should update and retrieve balance', () => {
        portfolio.updateBalance('alice', 50);
        expect(portfolio.getBalance('alice')).toBe(50);
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
});

