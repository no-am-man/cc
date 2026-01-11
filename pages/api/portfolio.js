
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getNodeForUser } from '../../src/core/nodeManager';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session && !process.env.NODE_ID) {
      return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session?.user?.email || process.env.NODE_ID;
  const node = await getNodeForUser(userId);

  res.status(200).json(node.portfolio.getSummary());
}
