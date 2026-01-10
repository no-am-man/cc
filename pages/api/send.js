
import { getSession } from 'next-auth/react';
import { getNodeForUser } from '../../src/core/nodeManager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Method Not Allowed
  }

  const session = await getSession({ req });
  const userId = session?.user?.email || process.env.NODE_ID || 'guest_node';
  const node = await getNodeForUser(userId);

  const { amount, to, asset, message } = req.body;
  const targetAsset = asset || node.userId;

  try {
    const result = await node.sendAsset(targetAsset, amount, to, message);
    
    // The new UserNode handles broadcasting internally via Firebase
    res.status(200).json({ success: true, result });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
