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

const activeNodes = new Map();

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'cc-republic-secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

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

function getNodeForUser(userId) {
    if (!userId) return null;
    const normalizedId = userId.toLowerCase();

    if (activeNodes.has(normalizedId)) {
        return activeNodes.get(normalizedId);
    }

    console.log(`✨ Spawning Re-Public Node for: ${normalizedId}`);
    const node = new UserNode(normalizedId);
    const instance = { node };
    activeNodes.set(normalizedId, instance);
    
    if (p2pGateway) {
        p2pGateway.announceUser(normalizedId);
    }

    return instance;
}

const p2pGateway = new P2P(P2P_PORT, null);
p2pGateway.resolveNode = (targetNodeId) => {
    if (activeNodes.has(targetNodeId)) {
        return activeNodes.get(targetNodeId).node;
    }
    return null;
};

// Routes

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
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

app.use((req, res, next) => {
    if (req.user) {
        req.nodeInstance = getNodeForUser(req.user.email);
    } else {
        const defaultId = process.env.NODE_ID || 'guest_node';
        req.nodeInstance = getNodeForUser(defaultId);
    }
    next();
});

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

app.get('/info', (req, res) => {
    const { node } = req.nodeInstance;
    
    // Get list of local active nodes (Republics hosted here)
    const localRepublics = Array.from(activeNodes.keys());

    res.json({
        nodeId: node.userId,
        authUser: req.user ? req.user.email : null,
        publicKey: node.keyPair.publicKey,
        inflationStats: node.chain.getInflationStats(),
        silverPrice: Oracle.getPrice(),
        peersCount: p2pGateway.sockets.length,
        connectedPeers: p2pGateway.getConnectedPeers(),
        directory: p2pGateway.getDirectoryStats(), // Remote users
        localRepublics: localRepublics, // Local users
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

app.listen(HTTP_PORT, () => {
    console.log(`Re-Public Node Server running on ${HTTP_PORT}`);
    console.log(`P2P Gateway running on ${P2P_PORT}`);
});
