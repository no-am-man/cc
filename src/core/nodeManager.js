
import UserNode from './UserNode';

const activeNodes = new Map();

// In a serverless environment, this Map might be reset between invocations.
// For a production app, this state should be moved to a persistent store like Redis or a database.
console.log('Initializing Node Manager...');

function getNodeForUser(userId) {
    if (!userId) return null;
    const normalizedId = userId.toLowerCase();

    if (activeNodes.has(normalizedId)) {
        return activeNodes.get(normalizedId);
    }

    console.log(`✨ Spawning Re-Public Node for: ${normalizedId}`);
    const node = new UserNode(normalizedId);
    activeNodes.set(normalizedId, node);

    return node;
}

function getActiveNodes() {
    return activeNodes;
}

export { getNodeForUser, getActiveNodes };
