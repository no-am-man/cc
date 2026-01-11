import UserNode from './UserNode';

const activeNodes = new Map();

// Helper to get or create a node asynchronously
async function getNodeForUser(userId) {
    if (!userId) return null;
    const normalizedId = userId.trim().toLowerCase();

    if (activeNodes.has(normalizedId)) {
        return activeNodes.get(normalizedId);
    }

    console.log(`✨ Spawning Re-Public Node for: '${normalizedId}'`);
    const node = new UserNode(normalizedId);
    
    // AWAIT the initialization (loads keys/chain from Firestore)
    await node.initialize();
    
    activeNodes.set(normalizedId, node);
    return node;
}

function getActiveNodes() {
    return activeNodes;
}

function evictNode(userId) {
    if (!userId) return;
    const normalizedId = userId.trim().toLowerCase();
    if (activeNodes.has(normalizedId)) {
        activeNodes.delete(normalizedId);
        console.log(`🧹 Evicted node from cache: '${normalizedId}'`);
    }
}

export { getNodeForUser, getActiveNodes, evictNode };
