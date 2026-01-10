import { getFirestore, collection, addDoc, onSnapshot } from "firebase/firestore";
import app from './firebase';

/**
 * Broadcasts a new block to the network using Firestore.
 * @param {object} block - The block to be broadcasted.
 */
const broadcastBlock = async (block) => {
  const db = getFirestore(app);
  try {
    // Firestore cannot accept custom classes, so we convert to a plain object
    const plainBlock = Object.assign({}, block);
    const docRef = await addDoc(collection(db, "blocks"), plainBlock);
    console.log("Block broadcasted with ID: ", docRef.id);
  } catch (e) {
    console.error("Error broadcasting block: ", e);
  }
};

/**
 * Listens for new blocks from the network using Firestore.
 * @param {function} callback - The function to be called when a new block is received.
 * @returns {function} - The unsubscribe function.
 */
const listenForBlocks = (callback) => {
  const db = getFirestore(app);
  const q = collection(db, "blocks");

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    querySnapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        callback(change.doc.data());
      }
    });
  });

  return unsubscribe;
};

export { broadcastBlock, listenForBlocks };
