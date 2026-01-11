
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getNodeForUser } from '../../src/core/nodeManager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Method Not Allowed
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session && !process.env.NODE_ID) {
      return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session?.user?.email || process.env.NODE_ID;
  const node = await getNodeForUser(userId);

  const { userId: targetUserId, action } = req.body;

  if (action === 'add') {
    node.addTrustLine(targetUserId);
  } else {
    node.removeTrustLine(targetUserId);
  }

  res.status(200).json({ success: true, trustLines: Array.from(node.trustLines) });
}
