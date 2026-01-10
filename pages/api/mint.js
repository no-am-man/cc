
import { getSession } from 'next-auth/react';
import { getNodeForUser } from '../../src/core/nodeManager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Method Not Allowed
  }

  const session = await getSession({ req });
  const userId = session?.user?.email || process.env.NODE_ID || 'guest_node';
  const node = await getNodeForUser(userId);

  const { amount } = req.body;

  try {
    const block = await node.mint(amount);
    // In a real app, you would broadcast this to other nodes
    res.status(200).json({ success: true, block });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
