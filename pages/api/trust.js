
import { getSession } from 'next-auth/react';
import { getNodeForUser } from '../../src/core/nodeManager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Method Not Allowed
  }

  const session = await getSession({ req });
  const userId = session?.user?.email || process.env.NODE_ID || 'guest_node';
  const node = await getNodeForUser(userId);

  const { userId: targetUserId, action } = req.body;

  if (action === 'add') {
    node.addTrustLine(targetUserId);
  } else {
    node.removeTrustLine(targetUserId);
  }

  res.status(200).json({ success: true, trustLines: Array.from(node.trustLines) });
}
