import '@testing-library/jest-dom';

// Mock TextEncoder/TextDecoder for Node.js environment in JSDOM
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn((query, callback) => {
    // Return a dummy unsubscribe function
    return () => {};
  }),
}));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}));
