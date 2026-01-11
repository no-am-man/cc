import UserChain from './UserChain';
import Portfolio from '../wallet/Portfolio';
import TransactionFactory from './logic/TransactionFactory';
import crypto from 'crypto';
import { broadcastBlock, listenForBlocks } from '../firebase/p2p';
import { saveDocument, getDocument, getCollectionDocs } from '../firebase/storage';

class UserNode {
    constructor(userId) {
        this.userId = userId;
    this.initialized = false;
    
    // Core components (data loaded later)
    this.chain = null;
        this.portfolio = new Portfolio(userId);
    this.trustLines = new Set();
    this.externalChains = new Map();
    this.peers = [];
  }

  // New Async Initializer
  async initialize() {
    if (this.initialized) return;

    console.log(`🚀 Initializing node for ${this.userId}...`);

    // 1. Load or Generate Keys
    this.keyPair = await this.loadOrGenerateKeys();

    // 2. Initialize Chain
    this.chain = new UserChain(this.userId, this.keyPair);
    await this.loadChain();

    // 3. Load Trust Lines
    await this.loadTrustLines();

    // 4. Load External Chains (Network State)
    await this.loadExternalChains();

    // 5. Listen for updates
    // Determine start time for listening
    // If we loaded a chain, start from its last update. 
    // If it's a new/reset chain, start from NOW to ignore history.
    const startTime = this.lastChainUpdate || Date.now();
    console.log(`👂 Listening for blocks since: ${new Date(startTime).toISOString()}`);
    listenForBlocks((block) => this.handleIncomingBlock(block), startTime);

    this.initialized = true;
    console.log(`✅ Node ${this.userId} ready.`);
  }

  // --- Persistence Methods (Now Async) ---

  async loadOrGenerateKeys() {
    const keys = await getDocument('keys', this.userId);
    if (keys) {
        return keys;
    }

    console.log("Generating new keys...");
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    
    const newKeys = { publicKey, privateKey };
    // In production, NEVER save privateKey to DB directly without encryption!
    await saveDocument('keys', this.userId, newKeys);
    return newKeys;
  }

    // Helper to sync portfolio with chain state
    syncPortfolio() {
        if (this.chain && this.chain.state && this.chain.state.assets) {
            for (const [issuer, amount] of Object.entries(this.chain.state.assets)) {
                this.portfolio.updateBalance(issuer, amount);
            }
        }
    }

    async loadChain() {
    console.log(`🔍 Attempting to load chain for ${this.userId} from Firestore...`);
    const data = await getDocument('chains', this.userId);
    
    if (data && data.chain) {
        this.chain.chain = data.chain;
        // Replay state
        this.chain.state = { balance: 0, totalSupply: 0, transactionCount: 0, assets: {} };
        for (let i = 1; i < this.chain.chain.length; i++) {
            try {
              this.chain.updateState(this.chain.chain[i]);
            } catch (e) {
                console.error(`Error replaying block ${i}:`, e.message);
            }
        }
        
        // Sync Portfolio with Chain State
        this.syncPortfolio();

        // Track last update time
        this.lastChainUpdate = data.lastUpdated || 0;

        console.log(`✅ Loaded chain for ${this.userId}. Height: ${this.chain.chain.length}`);
    } else {
        console.warn(`⚠️ No chain found for ${this.userId}. Using Genesis block.`);
        this.lastChainUpdate = null; // Mark as new/reset
    }
  }

  async saveChain() {
    // Save the full chain array
    // Serialize to pure JSON to remove any class methods or undefined fields
    const plainChain = JSON.parse(JSON.stringify(this.chain.chain));
    
    console.log(`💾 SAVING CHAIN for '${this.userId}' | Blocks: ${plainChain.length}`);

    await saveDocument('chains', this.userId, { 
        chain: plainChain,
        lastUpdated: Date.now()
    });
  }

  async loadTrustLines() {
    const data = await getDocument('trust', this.userId);
    if (data && data.lines) {
        this.trustLines = new Set(data.lines);
    }
  }

  async saveTrustLines() {
    await saveDocument('trust', this.userId, { 
        lines: [...this.trustLines] 
    });
  }

  addTrustLine(targetUserId) {
      this.trustLines.add(targetUserId);
      this.saveTrustLines().catch(console.error); // Fire and forget save
  }

  removeTrustLine(targetUserId) {
      this.trustLines.delete(targetUserId);
      this.saveTrustLines().catch(console.error);
  }

  isTrusted(userId) {
      if (this.trustLines.size === 0) return true; 
      return this.trustLines.has(userId);
  }

  // --- External Chains ---

  async loadExternalChains() {
      // In Firestore, we might query a 'chains' collection
      // For now, let's just load active peers if needed or leave empty to fetch on demand
      // Optimally, we don't load ALL chains, only ones we care about.
      // Leaving this simple for now.
  }

  async saveExternalChain(remoteUserId, chainData) {
      // We don't save other people's chains to our DB record usually
      // We might cache them locally in memory
      this.externalChains.set(remoteUserId, chainData);
  }

  // --- Actions (Async Updates) ---

  async handleIncomingBlock(block) {
    if (!block || !block.type || !block.hash) return;
    // Ignore my own blocks
    if (block.publicKey === this.keyPair.publicKey) return;

    console.log(`Received block ${block.type} from network (Hash: ${block.hash.substring(0, 8)}...)`);

    // 1. Automatic Receipt of Funds
    // If someone sent money TO me, I should automatically receive it if I trust them.
    if (block.type === 'SEND' && block.data && block.data.toAddress === this.userId) {
        const fromAddress = block.data.fromAddress;
        
        console.log(`💸 Incoming payment detected from ${fromAddress}!`);

        if (this.isTrusted(fromAddress)) {
            try {
                // Check if we already processed this (idempotency)
                // In a real system we'd check our chain history for this 'senderBlockHash'
                
                console.log(`✅ Trusted sender. Auto-receiving ${block.data.amount} CC...`);
                await this.receiveTransaction(fromAddress, block.data.amount, block.hash, "Auto-received");
                console.log(`💰 Payment accepted and recorded.`);
            } catch (e) {
                console.error("Failed to auto-receive transaction:", e);
            }
        } else {
            console.warn(`⚠️ Payment ignored: ${fromAddress} is not in trust lines.`);
        }
    }

    // 2. Network State Update
    // In a full node, we would verify and add this block to our cache of external chains
    // this.saveExternalChain(block.data.fromAddress, block);
  }

  signData(data) {
      const sign = crypto.createSign('SHA256');
      sign.update(JSON.stringify(data));
      sign.end();
      return sign.sign(this.keyPair.privateKey, 'hex');
  }

  static verifySignature(data, signature, publicKey) {
      const verify = crypto.createVerify('SHA256');
      verify.update(JSON.stringify(data));
      verify.end();
      return verify.verify(publicKey, signature, 'hex');
  }

  async mint(amount) {
      const block = this.chain.mint(amount);
      this.syncPortfolio();
      await this.saveChain();
      broadcastBlock(block);
        return block;
    }

  async createTransaction(amount, toAddress, message = '') {
      const block = this.chain.createTransaction(amount, toAddress, message);
      this.syncPortfolio();
      await this.saveChain();
      broadcastBlock(block);
      return block;
  }

  async sendAsset(issuerId, amount, toAddress, message = '') {
      if (issuerId === this.userId) {
          const block = await this.createTransaction(amount, toAddress, message);
          return { type: 'LOCAL', block };
      } else {
          // Remote logic remains similar, but saving request might be needed
          const request = {
              from: this.userId,
              to: toAddress,
              amount: amount,
              message: message,
              timestamp: Date.now()
          };
          request.signature = this.signData(request);
          return { type: 'REMOTE', targetNode: issuerId, request };
      }
  }

  async receiveTransaction(fromAddress, amount, senderBlockHash, message = '') {
      if (!this.isTrusted(fromAddress)) {
          throw new Error(`Trust Error: You do not have a Trust Line for ${fromAddress}`);
      }
      const block = this.chain.receiveTransaction(fromAddress, amount, senderBlockHash, message);
      this.syncPortfolio();
      await this.saveChain();
      broadcastBlock(block);
      return block;
  }

  handleTransferRequest(request) {
      const { from, to, amount, signature, timestamp } = request;

      // 1. Verify Sender (Remote Chain check - simplified)
      // In a real implementation, we would fetch the sender's chain and verify signatures.
      
      // 2. Verify Balance
      const currentBalance = this.calculateBalanceForUser(from);
      if (currentBalance < amount) {
          throw new Error("Insufficient funds");
      }

      const block = this.chain.createBlock('CONTRACT', {
          code: TransactionFactory.createTransferScript(from, to, amount),
          params: {}
      });
      
      this.saveChain(); // Fire and forget or await if async context allowed
      broadcastBlock(block);
      return { success: true, txId: block.hash };
  }

  calculateBalanceForUser(targetUserId) {
      if (this.chain.state.ledger && this.chain.state.ledger[targetUserId]) {
          return this.chain.state.ledger[targetUserId];
      }
      return 0;
  }
}

export default UserNode;
