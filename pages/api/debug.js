import { getSession } from 'next-auth/react';
import { getDocument, saveDocument } from '../../src/firebase/storage';
import app from '../../src/firebase/firebase';

export default async function handler(req, res) {
  const session = await getSession({ req });
  
  // Replicate logic from nodeManager (with trim)
  const userId = session?.user?.email?.trim().toLowerCase(); 

  const debugInfo = {
    environment: {
      hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      nodeId: process.env.NODE_ID || 'N/A'
    },
    session: {
      authenticated: !!session,
      email: session?.user?.email,
      derivedUserId: userId,
    },
    firebaseApp: {
      name: app ? app.name : 'Not Initialized',
      options: app ? app.options : null
    },
    persistenceCheck: null,
    writeTest: null
  };

  // Explicit Write Test
  if (req.query.testWrite === 'true') {
      try {
          const testId = 'debug_' + Date.now();
          console.log(`[DEBUG] Testing Write to debug_tests/${testId}`);
          await saveDocument('debug_tests', testId, { 
              timestamp: Date.now(), 
              status: 'ok' 
          });
          
          const readBack = await getDocument('debug_tests', testId);
          debugInfo.writeTest = {
              status: readBack && readBack.status === 'ok' ? 'SUCCESS' : 'FAILED_READ',
              docId: testId,
              readData: readBack
          };
      } catch (e) {
          debugInfo.writeTest = {
              status: 'ERROR',
              error: e.message
          };
      }
  }

  if (userId) {
    try {
      console.log(`[DEBUG] Attempting to read Firestore for: chains/${userId}`);
      const data = await getDocument('chains', userId);
      
      if (data) {
        debugInfo.persistenceCheck = {
          status: 'FOUND',
          blockCount: data.chain ? data.chain.length : 0,
          lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toISOString() : 'Unknown',
          rawDataSample: data.chain ? JSON.stringify(data.chain.slice(0, 1)) : 'No Chain Array'
        };
      } else {
        debugInfo.persistenceCheck = {
          status: 'NOT_FOUND',
          message: `Document 'chains/${userId}' returned null.`
        };
      }
    } catch (e) {
      debugInfo.persistenceCheck = {
        status: 'ERROR',
        error: e.message,
        stack: e.stack
      };
    }
  } else {
    debugInfo.persistenceCheck = {
      status: 'SKIPPED',
      reason: 'No User ID from Session'
    };
  }

  res.status(200).json(debugInfo);
}

