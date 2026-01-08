# CC Federation (Re-Public)

A Decentralized Mutual Credit System built on a Block Lattice architecture (Node.js).

> **Concept**: 1 CC is pegged to 1 gram of Silver. Users issue their own credit (Personal Chains) and can hold negative balances. Trust is managed via Reputation and Trust Lines.

## 🌟 Features

### 1. "Re-Public" Identity
*   **Email = Node ID**: Login with Google, and your email becomes your sovereign Blockchain Identity (e.g., `alice@gmail.com`).
*   **Multi-Tenancy**: A single server can host multiple "Republics" (User Nodes).
*   **Persistence**: Your chain and keys are saved to disk (`data/`).

### 2. The Economy
*   **Mutual Credit**: You issue your own currency. "Money" is just credit you extend to others.
*   **Silver Peg**: All currencies are denominated in Grams of Silver. The system fetches live spot prices.
*   **Crypto Barter**: Hold coins from Alice? You can send them to Bob directly (Third-Party Transfer).

### 3. Trust & Security
*   **Trust Lines**: You can whitelist who is allowed to pay you. "I only accept coins from Bob and Charlie."
*   **JavaScript Mining**: Transactions are validated by executing sandboxed JavaScript smart contracts.
*   **P2P Mesh**: Nodes connect via WebSockets to sync chains and broadcast transactions.

## 🚀 Getting Started

### Prerequisites
*   Node.js (v14+)
*   Google OAuth Credentials (for Login)
*   MetalPriceAPI Key (Optional, for live Silver price)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/cc-federation.git
    cd cc-federation
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file:
    ```env
    PORT=3000
    P2P_PORT=6001
    SESSION_SECRET=your_random_secret
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    METAL_PRICE_API_KEY=your_metalprice_api_key
    ```

### Running the Node

**Start the Server:**
```bash
npm start
```

**Development Mode (2 Nodes):**
Simulate a network with Alice (Port 3000) and Bob (Port 3001) on one machine:
```bash
npm run dev
```

### Using the UI
Open `http://localhost:3000`.
1.  **Login**: Sign in with Google to spawn your Personal Node.
2.  **Mint**: Create some coins (Credit).
3.  **Connect**: Add a peer's P2P URL (e.g., `ws://localhost:6002`) in the Address Book.
4.  **Transact**: Send money, swap assets, or manage Trust Lines.

## 🛠 Architecture

*   **`src/core`**: The Blockchain Engine (Block, UserChain, UserNode).
*   **`src/network`**: P2P Gateway and WebSocket logic.
*   **`src/server.js`**: The Host Server (Express + Passport Auth).
*   **`data/`**: JSON persistence layer (Chains, Keys, Trust Lists).

## 🧪 Testing

Run the full test suite (Core + API + P2P):
```bash
npm test
```

## 📜 License

MIT License. Open for global federation.
