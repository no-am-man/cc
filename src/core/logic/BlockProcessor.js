const ContractRunner = require('../ContractRunner');

/**
 * Handles the application of blocks to the state.
 * Implements the Strategy pattern for different block types.
 */
class BlockProcessor {
    constructor() {
        this.runner = new ContractRunner();
    }

    /**
     * Process a block and return the new state.
     * @param {object} block - The block to process.
     * @param {object} currentState - The current state object.
     * @returns {object} - The new state.
     */
    process(block, currentState) {
        // Create a deep copy to avoid mutating the passed state directly
        // (Though the caller usually expects a new object or mutation is handled carefully)
        const newState = { ...currentState };

        switch (block.type) {
            case 'MINT':
                this.processMint(block, newState);
                break;
            case 'SEND':
                this.processSend(block, newState);
                break;
            case 'RECEIVE':
                this.processReceive(block, newState);
                break;
            case 'CONTRACT':
                this.processContract(block, newState);
                break;
            case 'GENESIS':
                // Genesis block usually doesn't change balance state unless specified
                break;
            default:
                console.warn(`Unknown block type: ${block.type}`);
        }

        newState.transactionCount++;
        return newState;
    }

    processMint(block, state) {
        if (block.data.amount <= 0) throw new Error("Mint amount must be positive");
        state.balance += block.data.amount;
        state.totalSupply += block.data.amount;
    }

    processSend(block, state) {
        state.balance -= block.data.amount;
    }

    processReceive(block, state) {
        state.balance += block.data.amount;
    }

    processContract(block, state) {
        const resultState = this.runner.execute(
            block.data.code,
            state,
            block.data.params,
            block.timestamp
        );
        Object.assign(state, resultState);
    }
}

module.exports = BlockProcessor;

