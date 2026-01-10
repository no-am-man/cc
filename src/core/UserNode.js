
const UserChain = require('./UserChain');
const Portfolio = require('../wallet/Portfolio');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { broadcastBlock, listenForBlocks } = require('../firebase/p2p');

class UserNode {
  constructor(userId) {
    this.userId = userId;
    this.dataDir = path.join(__dirname, '../../data');
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Generate/Load Keys
    this.keyPair = this.loadOrGenerateKeys();
    
    // Initialize My Chain
    this.chain = new UserChain(userId, this.keyPair);
    this.loadChain();

    this.portfolio = new Portfolio(userId);
    
    // Trust Lines
    this.trustLines = new Set();
    this.loadTrustLines();

    // External Chains
    this.externalChains = new Map();
    this.loadExternalChains();

    // Peer list (simplified)
    this.peers = []; 

    // Listen for new blocks from the network
    listenForBlocks((block) => this.handleIncomingBlock(block));
  }

  handleIncomingBlock(block) {
    // Basic validation
    if (!block || !block.type || !block.hash) {
      console.error('Invalid block received:', block);
      return;
    }

    // Avoid processing own blocks
    if (block.publicKey === this.keyPair.publicKey) {
      return;
    }

    console.log(`Received block of type ${block.type} from the network.`);

    // Add more advanced validation and processing logic here
    // For example, checking the block's signature and adding it to the chain
  }

  loadOrGenerateKeys() {
      const keyPath = path.join(this.dataDir, `${this.userId}_keys.json`);
      if (fs.existsSync(keyPath)) {
          return JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      }
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      const keys = { publicKey, privateKey };
      fs.writeFileSync(keyPath, JSON.stringify(keys, null, 2));
      return keys;
  }

  loadChain() {
      const chainPath = path.join(this.dataDir, `${this.userId}_chain.json`);
      if (fs.existsSync(chainPath)) {
          const data = JSON.parse(fs.readFileSync(chainPath, 'utf8'));
          this.chain.chain = data;
          
          this.chain.state = { balance: 0, totalSupply: 0, transactionCount: 0 };
          for (let i = 1; i < this.chain.chain.length; i++) {
              try {
                this.chain.updateState(this.chain.chain[i]);
              } catch (e) {
                  console.error(`Error replaying block ${i}:`, e.message);
              }
          }
          console.log(`Loaded chain for ${this.userId}. Height: ${this.chain.chain.length}`);
      }
  }

  saveChain() {
      const chainPath = path.join(this.dataDir, `${this.userId}_chain.json`);
      fs.writeFileSync(chainPath, JSON.stringify(this.chain.chain, null, 2));
  }

  // --- Trust Lines ---

  loadTrustLines() {
      const trustPath = path.join(this.dataDir, `${this.userId}_trust.json`);
      if (fs.existsSync(trustPath)) {
          const data = JSON.parse(fs.readFileSync(trustPath, 'utf8'));
          this.trustLines = new Set(data);
          console.log(`Loaded ${this.trustLines.size} trust lines.`);
      }
  }

  saveTrustLines() {
      const trustPath = path.join(this.dataDir, `${this.userId}_trust.json`);
      fs.writeFileSync(trustPath, JSON.stringify([...this.trustLines], null, 2));
  }

  addTrustLine(targetUserId) {
      this.trustLines.add(targetUserId);
      this.saveTrustLines();
  }

  removeTrustLine(targetUserId) {
      this.trustLines.delete(targetUserId);
      this.saveTrustLines();
  }

  isTrusted(userId) {
      if (this.trustLines.size === 0) return true; 
      return this.trustLines.has(userId);
  }

  // --- External Chains Management ---

  loadExternalChains() {
      const files = fs.readdirSync(this.dataDir);
      files.forEach(file => {
          if (file.startsWith('external_') && file.endsWith('_chain.json')) {
              const remoteUserId = file.replace('external_', '').replace('_chain.json', '');
              const data = JSON.parse(fs.readFileSync(path.join(this.dataDir, file), 'utf8'));
              this.externalChains.set(remoteUserId, data);
          }
      });
  }

  saveExternalChain(remoteUserId, chainData) {
      const filePath = path.join(this.dataDir, `external_${remoteUserId}_chain.json`);
      fs.writeFileSync(filePath, JSON.stringify(chainData, null, 2));
      this.externalChains.set(remoteUserId, chainData);
  }

  updateExternalChain(remoteUserId, chainData) {
      const currentChain = this.externalChains.get(remoteUserId) || [];
      if (chainData.length > currentChain.length) {
          this.saveExternalChain(remoteUserId, chainData);
      }
  }

  /**
   * Actions
   */

  signData(data) {
      const sign = crypto.createSign('SHA256');
      sign.update(JSON.stringify(data));
      sign.end();
      return sign.sign(this.keyPair.privateKey, 'hex');
  }

  // Verify a generic signature (static helper)
  static verifySignature(data, signature, publicKey) {
      const verify = crypto.createVerify('SHA256');
      verify.update(JSON.stringify(data));
      verify.end();
      return verify.verify(publicKey, signature, 'hex');
  }

  handleTransferRequest(request) {
      const { from, to, amount, signature, timestamp } = request;

      const senderChain = this.externalChains.get(from);
      if (senderChain && senderChain.length > 0) {
          // Verify
      }

      // 2. Verify Balance
      const currentBalance = this.calculateBalanceForUser(from);
      if (currentBalance < amount) {
          throw new Error("Insufficient funds");
      }

      const block = this.chain.createBlock('CONTRACT', {
          code: `
            if (!state.ledger) state.ledger = {};
            if (!state.ledger['${from}']) state.ledger['${from}'] = 0;
            if (!state.ledger['${to}']) state.ledger['${to}'] = 0;
            state.ledger['${from}'] -= ${amount};
            state.ledger['${to}'] += ${amount};
          `,
          params: {}
      });
      this.saveChain();
      broadcastBlock(block);
      return { success: true, txId: block.hash };
  }

  calculateBalanceForUser(targetUserId) {
      if (this.chain.state.ledger && this.chain.state.ledger[targetUserId]) {
          return this.chain.state.ledger[targetUserId];
      }
      return 0;
  }
  
  getBalanceForUser(userId) {
      return this.calculateBalanceForUser(userId);
  }

  mint(amount) {
      const block = this.chain.mint(amount);
      this.saveChain();
      broadcastBlock(block);
      return block;
  }

  createTransaction(amount, toAddress, message = '') {
      const block = this.chain.createTransaction(amount, toAddress, message);
      this.saveChain();
      broadcastBlock(block);
      return block;
  }

  /**
   * Sends an asset.
   */
  sendAsset(issuerId, amount, toAddress, message = '') {
      if (issuerId === this.userId) {
          // Native Send
          const block = this.createTransaction(amount, toAddress, message);
          return { type: 'LOCAL', block };
      } else {
          // Third-Party Transfer
          const request = {
              from: this.userId,
              to: toAddress,
              amount: amount,
              message: message, // Include message in request
              timestamp: Date.now()
          };
          
          request.signature = this.signData(request);
          
          return { 
              type: 'REMOTE', 
              targetNode: issuerId, 
              request: request 
          };
      }
  }

  receiveTransaction(fromAddress, amount, senderBlockHash, message = '') {
      if (!this.isTrusted(fromAddress)) {
          throw new Error(`Trust Error: You do not have a Trust Line for ${fromAddress}`);
      }
      const block = this.chain.receiveTransaction(fromAddress, amount, senderBlockHash, message);
      this.saveChain();
      broadcastBlock(block);
      return block;
  }
}

module.exports = UserNode;
