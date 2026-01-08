class Portfolio {
  /**
   * @param {string} ownerId - The ID of the portfolio owner
   */
  constructor(ownerId) {
    this.ownerId = ownerId;
    // Map<issuerId, amount>
    // Represents how much credit I hold from other users.
    // e.g. { 'bob_id': 50, 'alice_id': 10 }
    this.assets = new Map();
  }

  /**
   * Updates the balance of a specific asset (issuer).
   * @param {string} issuerId 
   * @param {number} amount - The new balance (or delta? let's assume absolute balance for sync)
   */
  updateBalance(issuerId, amount) {
    this.assets.set(issuerId, amount);
  }

  /**
   * Gets the balance of a specific asset.
   * @param {string} issuerId 
   */
  getBalance(issuerId) {
    return this.assets.get(issuerId) || 0;
  }

  /**
   * Returns a readable summary of all assets.
   */
  getSummary() {
    const summary = {};
    for (const [issuer, amount] of this.assets.entries()) {
      summary[issuer] = amount;
    }
    return summary;
  }

  /**
   * Syncs portfolio by querying known peers (UserNodes).
   * This is a placeholder for network interaction.
   * @param {Array} networkNodes - List of known UserNode instances (or peer connections)
   */
  async syncPortfolio(networkNodes) {
      // In a real P2P system, this would broadcast "GetBalance(myId)" to all peers.
      // Here we iterate mock nodes.
      for (const node of networkNodes) {
          // If the node represents an issuer I hold coins from
          // For now, let's assume 'node' has a method 'getBalanceForUser(userId)'
          try {
              const balance = node.getBalanceForUser(this.ownerId);
              if (balance !== 0) {
                  this.updateBalance(node.userId, balance);
              }
          } catch (e) {
              // Node might not be available or compatible
          }
      }
  }
}

module.exports = Portfolio;
