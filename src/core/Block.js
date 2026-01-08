const crypto = require('crypto');

class Block {
  /**
   * @param {number} index
   * @param {number} timestamp
   * @param {object} data
   * @param {string} previousHash
   * @param {string} type - 'SEND'|'RECEIVE'|'MINT'|'CONTRACT'
   * @param {string} signature - Digital signature of the block creator
   */
  constructor(index, timestamp, data, previousHash = '', type = 'SEND', signature = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.type = type;
    this.signature = signature;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.index +
          this.previousHash +
          this.timestamp +
          JSON.stringify(this.data) +
          this.type +
          this.signature
      )
      .digest('hex');
  }

  /**
   * Signs the block with a private key
   * @param {string} privateKey - PEM encoded private key
   */
  signBlock(privateKey) {
      // In a real implementation, we would sign the hash of the block content (excluding signature)
      // For this scaffold, we'll sign the hash calculated *without* the signature field.
      // However, calculateHash() currently includes this.signature.
      // To properly sign:
      // 1. Calculate hash of content.
      // 2. Sign that hash.
      // 3. Store signature.
      // 4. Recalculate block hash (which might act as the ID).
      
      // Let's create a "content hash" for signing.
      const contentHash = crypto.createHash('sha256').update(
        this.index +
        this.previousHash +
        this.timestamp +
        JSON.stringify(this.data) +
        this.type
      ).digest('hex');

      const sign = crypto.createSign('SHA256');
      sign.update(contentHash);
      sign.end();
      this.signature = sign.sign(privateKey, 'hex');
      this.hash = this.calculateHash(); // Update hash to include signature
  }

  /**
   * Verifies the block's signature
   * @param {string} publicKey - PEM encoded public key
   */
  verifySignature(publicKey) {
      if (!this.signature) return false;
      
      const contentHash = crypto.createHash('sha256').update(
        this.index +
        this.previousHash +
        this.timestamp +
        JSON.stringify(this.data) +
        this.type
      ).digest('hex');

      const verify = crypto.createVerify('SHA256');
      verify.update(contentHash);
      verify.end();
      return verify.verify(publicKey, this.signature, 'hex');
  }
}

module.exports = Block;
