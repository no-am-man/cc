# Re-Public Protocol (V2)

**Re-Public** is a decentralized "Personal Economy" protocol where every user becomes their own sovereign bank.

Built on a **Multi-Chain (Block Lattice)** architecture, each user controls their own private blockchain, mints their own currency, and interacts with others via a peer-to-peer federation.

> "Every individual is a Republic."

---

## 🌟 Key Features

*   **Sovereign Identity**: Your Google Account (or future DID) creates a unique Node ID.
*   **Personal Blockchain**: You hold the keys. You write the blocks. No central ledger.
*   **Mutual Credit**: Issue your own currency. Balances can go negative (debt), backed by your reputation.
*   **Silver Standard**: All currencies are denominated in **CC** (Credit Commons), loosely pegged to 1g of Silver.
*   **P2P Federation**: Nodes communicate via Firestore (Serverless Bus) to exchange assets and synchronize chains.
*   **Smart Contracts**: Programmable money with secure, sandboxed JavaScript contracts.
*   **Data Sovereignty**: Download your full blockchain history as JSON anytime.

---

## 🛠 Tech Stack

*   **Framework**: [Next.js 16](https://nextjs.org/) (React 19)
*   **Language**: Node.js / JavaScript
*   **Database**: Google Cloud Firestore (NoSQL Persistence)
*   **Auth**: NextAuth.js (Google OAuth 2.0)
*   **Deployment**: Firebase App Hosting (Serverless)

---

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js 18+ installed.
*   A **Firebase Project** (Free Tier is fine).
*   A **Google Cloud Console** project (for OAuth).

### 2. Installation

```bash
git clone https://github.com/your-username/cc-republic.git
cd cc-republic
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
# --- Firebase (from Project Settings) ---
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# --- NextAuth (Authentication) ---
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=run_openssl_rand_base64_32_to_generate

# --- Google OAuth (from GCP Console) ---
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# --- Oracle (Optional) ---
METAL_PRICE_API_KEY=your_key_from_metalpriceapi.com
```

### 4. Database Rules
Go to your **Firebase Console -> Firestore Database -> Rules** and set them for development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // ⚠️ Dev Mode Only
    }
  }
}
```

### 5. Run Locally

```bash
npm run dev
```
Visit `http://localhost:3000`. Login, Mint, and Transact!

---

## 🌐 Deployment (Firebase App Hosting)

This project is optimized for **Firebase App Hosting**, a next-gen serverless platform for Next.js.

1.  Push your code to **GitHub**.
2.  Go to **Firebase Console -> App Hosting**.
3.  Click **"Get Started"** and connect your GitHub repo.
4.  **Important**: In the App Hosting settings, add **ALL** the environment variables from your `.env.local` (except `NEXTAUTH_URL` which Firebase handles automatically, though you might need to set it to your deployed domain).

---

## 📚 Architecture

### The "Node" Concept
In Re-Public, the "Server" is stateless. When you log in, a `UserNode` is spawned in memory. It hydrates its state (Blockchain, Keys, Portfolio) from Firestore.

### The "Chain"
*   **MINT**: Create new coins (increases your supply).
*   **SEND**: Transfer coins to another user.
*   **RECEIVE**: Accept coins (and debt) from others.
*   **CONTRACT**: Execute arbitrary logic.

### Trust Lines
You only receive money/messages from people you **Trust**. This prevents spam and creates a "Web of Trust" topology.

---

## 🧪 Testing

We use **Jest** for comprehensive unit testing.

```bash
npm test          # Run all tests
npm test -- --coverage # Check code coverage
```

---

**License**: MIT
