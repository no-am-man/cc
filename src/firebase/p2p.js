
const { getFirestore, collection, addDoc, onSnapshot } = require("firebase/firestore");

/**
 * Broadcasts a new block to the network using Firestore.
 * @param {object} block - The block to be broadcasted.
 */
const broadcastBlock = async (block) => {
  const db = getFirestore();
  try {
    const docRef = await addDoc(collection(db, "blocks"), block);
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
  const db = getFirestore();
  const q = collection(db, "blocks");

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    querySnapshot.forEach((doc) => {
      callback(doc.data());
    });
  });

  return unsubscribe;
};

module.exports = { broadcastBlock, listenForBlocks };
