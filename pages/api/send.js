
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getNodeForUser } from '../../src/core/nodeManager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Method Not Allowed
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session && !process.env.NODE_ID) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
  }

  const userId = session?.user?.email || process.env.NODE_ID;
  const node = await getNodeForUser(userId);
  
  console.log(`[Send API] User: ${userId}, Sending from Node: '${node.userId}'`);

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
