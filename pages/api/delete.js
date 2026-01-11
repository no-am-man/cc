import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { evictNode } from '../../src/core/nodeManager';
import { deleteDocument } from '../../src/firebase/storage';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Method Not Allowed
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session && !process.env.NODE_ID) {
      return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session?.user?.email || process.env.NODE_ID;
  
  try {
    console.log(`[Delete API] Deleting chain for: ${userId}`);
    
    // 1. Delete from Firestore (All User Data)
    await Promise.all([
        deleteDocument('chains', userId),
        deleteDocument('keys', userId),
        deleteDocument('trust', userId)
    ]);
    
    // 2. Evict from Memory
    evictNode(userId);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Delete API Error]", error);
    res.status(500).json({ error: error.message });
  }
}

