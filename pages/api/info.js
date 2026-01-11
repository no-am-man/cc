
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getNodeForUser } from '../../src/core/nodeManager';
import Oracle from '../../src/Oracle';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  console.log('[API/Info] Session check:', { 
      hasSession: !!session, 
      user: session?.user?.email, 
      cookieLength: req.headers.cookie?.length 
  });
  
  if (!session && !process.env.NODE_ID) {
      return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session?.user?.email || process.env.NODE_ID;
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
