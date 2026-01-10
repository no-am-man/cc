/**
 * Generates standard smart contract code for common operations.
 * This avoids hardcoding strings in the business logic.
 */
class TransactionFactory {
    
    /**
     * Generates code for a cross-chain transfer (Ledger update).
     * @param {string} fromUser - The sender's user ID.
     * @param {string} toUser - The recipient's user ID.
     * @param {number} amount - The amount to transfer.
     * @returns {string} - The JavaScript code to execute.
     */
    static createTransferScript(fromUser, toUser, amount) {
        // Sanitize inputs to prevent injection (basic check)
        const safeFrom = fromUser.replace(/['"\\]/g, '');
        const safeTo = toUser.replace(/['"\\]/g, '');
        const safeAmount = Number(amount);

        if (isNaN(safeAmount)) throw new Error("Invalid amount for transaction script");

        return `
            if (!state.ledger) state.ledger = {};
            if (!state.ledger['${safeFrom}']) state.ledger['${safeFrom}'] = 0;
            if (!state.ledger['${safeTo}']) state.ledger['${safeTo}'] = 0;
            
            // Decimal arithmetic safety could be added here
            state.ledger['${safeFrom}'] -= ${safeAmount};
            state.ledger['${safeTo}'] += ${safeAmount};
        `;
    }
}

module.exports = TransactionFactory;

