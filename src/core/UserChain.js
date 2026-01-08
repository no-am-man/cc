// src/core/UserChain.js
const Block = require('./Block');
const ContractRunner = require('./ContractRunner');

class UserChain {
  constructor(userId, keyPair) {
    this.userId = userId;
    this.chain = [this.createGenesisBlock()];
    this.pendingTransactions = []; 
    this.keyPair = keyPair;
    this.state = {
        balance: 0,
        totalSupply: 0,
        transactionCount: 0
    };
  }

  createGenesisBlock() {
    return new Block(0, Date.now(), { message: "Genesis Block" }, "0", "GENESIS");
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  createBlock(type, data) {
      const latestBlock = this.getLatestBlock();
      // Ensure we handle both Block instances and plain objects
      let prevHash = '0';
      if (latestBlock instanceof Block) {
          prevHash = latestBlock.hash;
      } else {
          // It's a plain object loaded from JSON
          prevHash = latestBlock.hash;
      }

      const newBlock = new Block(
          latestBlock.index + 1,
          Date.now(),
          data,
          prevHash, 
          type
      );

      if (this.keyPair && this.keyPair.privateKey) {
          newBlock.signBlock(this.keyPair.privateKey);
      }

      this.addBlock(newBlock);
      return newBlock;
  }

  addBlock(block) {
      // 1. Basic validation
      const latest = this.getLatestBlock();
      if (block.previousHash !== latest.hash) {
          throw new Error(`Invalid previous hash. Expected: ${latest.hash}, Got: ${block.previousHash}`);
      }
      
      if (block.index !== latest.index + 1) {
          throw new Error("Invalid block index");
      }

      // 2. Signature validation
      if (this.keyPair && this.keyPair.publicKey) {
           const blockObj = block instanceof Block ? block : Object.assign(new Block(), block);
           
          if (!blockObj.verifySignature(this.keyPair.publicKey)) {
              throw new Error("Invalid block signature");
          }
      }

      // 3. Update State
      this.updateState(block);

      this.chain.push(block);
  }

  updateState(block) {
      const newState = { ...this.state };

      switch (block.type) {
          case 'MINT':
              if (block.data.amount <= 0) throw new Error("Mint amount must be positive");
              newState.balance += block.data.amount;
              newState.totalSupply += block.data.amount;
              break;

          case 'SEND':
              newState.balance -= block.data.amount;
              break;

          case 'RECEIVE':
              newState.balance += block.data.amount;
              break;

          case 'CONTRACT':
               const runner = new ContractRunner();
               const contractResultState = runner.execute(
                   block.data.code, 
                   newState, 
                   block.data.params, 
                   block.timestamp
               );
               Object.assign(newState, contractResultState);
               break;
      }

      newState.transactionCount++;
      this.state = newState;
  }

  mint(amount) {
      return this.createBlock('MINT', { amount });
  }

  createTransaction(amount, toAddress, message = '') {
      return this.createBlock('SEND', { amount, toAddress, fromAddress: this.userId, message });
  }
  
  receiveTransaction(fromAddress, amount, senderBlockHash, message = '') {
      return this.createBlock('RECEIVE', { fromAddress, amount, senderBlockHash, message });
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];
      
      const currentBlockObj = currentBlock instanceof Block ? currentBlock : Object.assign(new Block(), currentBlock);

      if (currentBlockObj.hash !== currentBlockObj.calculateHash()) {
        return false;
      }

      if (currentBlockObj.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }

  getInflationStats() {
      return {
          totalMinted: this.state.totalSupply,
          currentBalance: this.state.balance,
          circulatingSupply: this.state.totalSupply
      };
  }
}

module.exports = UserChain;
