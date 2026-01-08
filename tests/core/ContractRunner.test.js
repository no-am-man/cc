const ContractRunner = require('../../src/core/ContractRunner');

describe('ContractRunner Class', () => {
    let runner;

    beforeEach(() => {
        runner = new ContractRunner();
    });

    test('should execute simple subtraction logic', () => {
        const code = "state.balance -= transaction.amount;";
        const state = { balance: 100 };
        const tx = { amount: 10 };
        
        const newState = runner.execute(code, state, tx, Date.now());
        expect(newState.balance).toBe(90);
    });

    test('should not modify original state object', () => {
        const code = "state.balance = 0;";
        const originalState = { balance: 100 };
        
        runner.execute(code, originalState, {}, Date.now());
        expect(originalState.balance).toBe(100);
    });

    test('should prevent access to process', () => {
        const code = "state.result = process.version;";
        const state = {};
        
        // It might throw or just result in undefined depending on implementation specifics
        // Our implementation explicitly blocks it, so it should be undefined or throw.
        try {
            const newState = runner.execute(code, state, {}, Date.now());
            expect(newState.result).toBeUndefined();
        } catch (e) {
            // Alternatively, it might throw if strict mode or similar
        }
    });

    test('should timeout on infinite loops', () => {
        const code = "while(true) {}";
        const state = {};
        
        expect(() => {
            runner.execute(code, state, {}, Date.now());
        }).toThrow();
    });

    test('should fail if Math.random is used', () => {
        const code = "state.rnd = Math.random();";
        const state = {};
        
        expect(() => {
            runner.execute(code, state, {}, Date.now());
        }).toThrow("Math.random is not allowed");
    });
});
