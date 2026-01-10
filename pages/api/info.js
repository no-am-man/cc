
import { getSession } from 'next-auth/react';
import { getNodeForUser } from '../../src/core/nodeManager';
import Oracle from '../../src/Oracle';

export default async function handler(req, res) {
  const session = await getSession({ req });
  const userId = session?.user?.email || process.env.NODE_ID || 'guest_node';
  const node = await getNodeForUser(userId);

  res.status(200).json({
    nodeId: node.userId,
    authUser: session?.user?.email || null,
    publicKey: node.keyPair.publicKey,
    inflationStats: node.chain.getInflationStats(),
    silverPrice: Oracle.getPrice(),
    trustLines: Array.from(node.trustLines),
  });
}
