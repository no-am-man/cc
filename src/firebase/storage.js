import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import app from './firebase';

const db = getFirestore(app);

// Helper to save a document
export const saveDocument = async (collectionName, docId, data) => {
  try {
    // Merge: true allows updating fields without overwriting the whole doc
    await setDoc(doc(db, collectionName, docId), data, { merge: true });
    console.log(`✅ Saved ${collectionName}/${docId}`);
  } catch (e) {
    console.error(`❌ Error saving ${collectionName}/${docId}:`, e);
    throw e;
  }
};

// Helper to load a document
export const getDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (e) {
    console.error(`❌ Error reading ${collectionName}/${docId}:`, e);
    return null;
  }
};

// Helper to load a collection (for external chains)
export const getCollectionDocs = async (collectionName) => {
    try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const data = [];
        querySnapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() });
        });
        return data;
    } catch (e) {
        console.error(`❌ Error reading collection ${collectionName}:`, e);
        return [];
    }
}

