
import { getSession } from 'next-auth/react';
import { getNodeForUser } from '../../src/core/nodeManager';

export default async function handler(req, res) {
  const session = await getSession({ req });
  const userId = session?.user?.email || process.env.NODE_ID || 'guest_node';
  const node = getNodeForUser(userId);

  res.status(200).json(node.portfolio.getSummary());
}
