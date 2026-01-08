const vm = require('vm');

class ContractRunner {
  constructor() {
    this.DEFAULT_TIMEOUT = 500; // ms
  }

  /**
   * Executes a smart contract (JS code) in a sandboxed environment.
   * @param {string} contractCode - The JavaScript code to execute.
   * @param {object} currentState - The current state (e.g., balance).
   * @param {object} transactionData - Data from the transaction (amount, sender, etc.).
   * @param {number} blockTimestamp - Timestamp to be used instead of Date.now().
   * @returns {object} - The modified state.
   */
  execute(contractCode, currentState, transactionData, blockTimestamp) {
    // Deep copy state to prevent reference mutation issues outside sandbox
    const state = JSON.parse(JSON.stringify(currentState));
    
    // Create the sandbox context
    const sandbox = {
      state: state,
      transaction: transactionData,
      // Deterministic helpers
      timestamp: blockTimestamp,
      // Block non-deterministic or dangerous globals
      console: {
          log: () => {}, // No-op or controlled logging
          error: () => {}
      },
      // Explicitly block standard dangerous objects if they leak through (though vm usually handles this)
      process: undefined,
      require: undefined,
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      Date: {
          now: () => blockTimestamp,
          parse: Date.parse,
          UTC: Date.UTC
      },
      Math: {
          ...Math,
          random: () => { throw new Error("Math.random is not allowed in contracts"); }
      }
    };

    const context = vm.createContext(sandbox);

    try {
      // Execute the code
      vm.runInContext(contractCode, context, {
        timeout: this.DEFAULT_TIMEOUT,
        displayErrors: true
      });

      return sandbox.state;
    } catch (error) {
      console.error("Smart Contract Execution Failed:", error.message);
      throw error; // Propagate error so block validation fails
    }
  }
}

module.exports = ContractRunner;
