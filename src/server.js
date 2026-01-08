// src/server.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const UserNode = require('./core/UserNode');
const Oracle = require('./Oracle');
const { P2P } = require('./network/P2P');

const app = express();
const HTTP_PORT = process.env.PORT || 3000;
const P2P_PORT = process.env.P2P_PORT || 6001;

// --- Global State ---
// Map<userId, { node: UserNode, p2p: P2P }>
// In a real cloud wallet, this would likely be unloaded/loaded from DB to memory.
// For this demo, we keep active nodes in memory.
const activeNodes = new Map();

// --- Middleware ---
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'cc-republic-secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// --- Auth Strategy ---
passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((user, done) => {
    done(null, user);
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback"
    },
    (accessToken, refreshToken, profile, cb) => {
        const email = profile.emails[0].value;
        return cb(null, { id: email, name: profile.displayName, email: email });
    }));
}

// --- Helper: Get or Create Node for User ---
function getNodeForUser(userId) {
    if (!userId) return null;
    
    // Normalize ID (emails as IDs)
    const normalizedId = userId.toLowerCase();

    if (activeNodes.has(normalizedId)) {
        return activeNodes.get(normalizedId);
    }

    console.log(`✨ Spawning Re-Public Node for: ${normalizedId}`);
    
    // Create new Node instance
    const node = new UserNode(normalizedId);
    
    // We need a P2P layer for this user.
    // CHALLENGE: We can't bind 1000 ports for 1000 users.
    // ARCHITECTURE SHIFT: 
    // 1. Single P2P Gateway (Port 6001) that routes messages to specific UserNodes based on "to" field?
    // 2. Or simplified: This server acts as a "Host" for multiple nodes.
    // 
    // For this "Re-Public" vision where "Email = NodeID", it implies a Personal Server.
    // But if we are running ONE server hosting MANY users (Cloud Wallet), we need a Router.
    //
    // Let's implement a Shared P2P Gateway.
    // The Gateway receives a message, checks "toAddress" (if available) or "nodeId" in handshake, 
    // and routes it to the correct in-memory UserNode.
    //
    // For simplicity in this step: We will use a Singleton P2P Manager that manages all connections
    // and routes logic to specific `UserNode` instances.
    
    const instance = { node };
    activeNodes.set(normalizedId, instance);
    return instance;
}

// --- Shared P2P Gateway ---
// This acts as the "Post Office" for all users hosted on this server.
const p2pGateway = new P2P(P2P_PORT, null); // Pass null as default node, we will inject router

// Monkey-patch or extend P2P to handle routing?
// Better: Update P2P class to accept a "NodeResolver" function instead of a single UserNode.
// But we can't easily change P2P signature without breaking tests/other files.
// Let's attach a router function to the gateway.
p2pGateway.resolveNode = (targetNodeId) => {
    if (activeNodes.has(targetNodeId)) {
        return activeNodes.get(targetNodeId).node;
    }
    return null;
};

// Override specific handlers in P2P to route based on message content?
// This requires P2P.js refactor. 
// For now, let's assume we are running in "Single User Mode" if not logged in, 
// or "Multi User Mode" if logged in.
// actually, let's stick to the prompt: "Login with Google... email becomes nodeID".
// This implies 1 active user per session?
// If I login as Alice, I am Alice. If I logout and login as Bob, I am Bob.
// So `getNodeForUser(req.user.email)` is correct.

// --- Routes ---

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Initialize Node upon login
        getNodeForUser(req.user.email);
        res.redirect('/');
    });

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

app.get('/user', (req, res) => {
    res.json(req.user || null);
});

// Middleware to ensure a node exists for current session
app.use((req, res, next) => {
    // If logged in, use their node
    if (req.user) {
        req.nodeInstance = getNodeForUser(req.user.email);
    } else {
        // Guest / Default Node (e.g. for initial browsing or demo)
        // Let's use a default "guest" node or the ENV defined one
        const defaultId = process.env.NODE_ID || 'guest_node';
        req.nodeInstance = getNodeForUser(defaultId);
    }
    next();
});

// --- SSE Setup ---
const sseClients = new Set();
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    sseClients.add(res);
    res.write(`event: connected\ndata: "Connected"\n\n`);
    req.on('close', () => sseClients.delete(res));
});

function broadcastSSE(type, data) {
    sseClients.forEach(res => {
        res.write(`event: ${type}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
}

Oracle.on('price_update', (price) => broadcastSSE('price', { price }));

// --- API Endpoints (Delegated to Active Node) ---

app.get('/info', (req, res) => {
    const { node } = req.nodeInstance;
    res.json({
        nodeId: node.userId,
        authUser: req.user ? req.user.email : null,
        publicKey: node.keyPair.publicKey,
        inflationStats: node.chain.getInflationStats(),
        silverPrice: Oracle.getPrice(),
        peersCount: p2pGateway.sockets.length,
        connectedPeers: p2pGateway.getConnectedPeers(),
        trustLines: Array.from(node.trustLines)
    });
});

app.get('/chain', (req, res) => res.json(req.nodeInstance.node.chain.chain));
app.get('/portfolio', (req, res) => res.json(req.nodeInstance.node.portfolio.getSummary()));

app.post('/mint', (req, res) => {
    const { amount } = req.body;
    const { node } = req.nodeInstance;
    try {
        const block = node.mint(amount);
        p2pGateway.broadcast({ type: 'NEW_BLOCK', payload: block });
        broadcastSSE('chain_update', { block, stats: node.chain.getInflationStats() });
        res.json({ success: true, block });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/send', (req, res) => {
    const { amount, to, asset, message } = req.body;
    const { node } = req.nodeInstance;
    const targetAsset = asset || node.userId;

    try {
        const result = node.sendAsset(targetAsset, amount, to, message);
        if (result.type === 'LOCAL') {
            p2pGateway.broadcast({ type: 'NEW_BLOCK', payload: result.block });
            broadcastSSE('chain_update', { block: result.block, stats: node.chain.getInflationStats() });
            res.json({ success: true, block: result.block });
        } else {
            // Remote request
            // Ideally target specific peer
            p2pGateway.broadcast({ type: 'TRANSFER_REQUEST', payload: result.request });
            res.json({ success: true, message: 'Transfer Request Sent' });
        }
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/connect', (req, res) => {
    const { peer } = req.body;
    p2pGateway.connectToPeer(peer);
    res.json({ message: `Connecting to ${peer}` });
});

app.post('/trust', (req, res) => {
    const { userId, action } = req.body;
    const { node } = req.nodeInstance;
    if (action === 'add') node.addTrustLine(userId);
    else node.removeTrustLine(userId);
    res.json({ success: true, trustLines: Array.from(node.trustLines) });
});

// Start Server
app.listen(HTTP_PORT, () => {
    console.log(`Re-Public Node Server running on ${HTTP_PORT}`);
    console.log(`P2P Gateway running on ${P2P_PORT}`);
});
