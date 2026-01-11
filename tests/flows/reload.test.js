import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import Home from '../../pages/index';
import { useSession } from 'next-auth/react';

// Mocks
jest.mock('next-auth/react');
jest.mock('next/head', () => {
  return {
    __esModule: true,
    default: ({ children }) => <>{children}</>,
  };
});

describe('Reload Persistence Simulation', () => {
    // This simulates the SERVER-SIDE database
    let db = {
        chain: [],
        balance: 0
    };

    beforeEach(() => {
        // Reset "Server DB" before each test
        db = { chain: [], balance: 0 };
        jest.clearAllMocks();
        
        // Mock Session
        useSession.mockReturnValue({
            data: { user: { email: 'test@example.com' } },
            status: 'authenticated',
        });

        // Smart Mock Fetch - acts as the API Server + DB
        global.fetch = jest.fn(async (url, options) => {
            // console.log(`[MockServer] Request: ${url}`);
            
            if (url.includes('/api/info')) {
                return {
                    ok: true,
                    json: async () => ({ 
                        nodeId: 'test@example.com',
                        silverPrice: 0.85,
                        inflationStats: { currentBalance: db.balance, totalMinted: db.balance } 
                    })
                };
            }
            if (url.includes('/api/chain')) {
                return {
                    ok: true,
                    json: async () => db.chain
                };
            }
            if (url.includes('/api/portfolio')) {
                return { ok: true, json: async () => ({}) };
            }
            if (url.includes('/api/mint') && options.method === 'POST') {
                const body = JSON.parse(options.body);
                // Simulate processing time
                await new Promise(r => setTimeout(r, 10));
                
                const newBlock = { 
                    index: db.chain.length + 1, 
                    type: 'MINT', 
                    data: { amount: body.amount },
                    hash: 'hash_' + Date.now() 
                };
                
                // UPDATE SERVER STATE
                db.chain.push(newBlock);
                db.balance += body.amount;
                
                return {
                    ok: true,
                    json: async () => ({ success: true, block: newBlock })
                };
            }
            return { ok: false, status: 404 };
        });
    });

    test('UI should display persisted data after page reload', async () => {
        // --- SESSION 1: The Minting ---
        console.log('--- Mounting App (Session 1) ---');
        const { unmount } = render(<Home />);
        
        // 1. Initial State Check
        await waitFor(() => expect(screen.getByText('Node Status')).toBeInTheDocument());
        
        // 2. Perform Mint
        const mintInput = screen.getByLabelText(/Amount/i);
        const mintButton = screen.getByText('Mint', { selector: 'button' });
        
        await act(async () => {
            fireEvent.change(mintInput, { target: { value: '100' } });
            fireEvent.click(mintButton);
        });

        // 3. Verify Optimistic Update (Session 1)
        await waitFor(() => {
             const updated = screen.getAllByText((content) => content.includes('100 CC'));
             expect(updated.length).toBeGreaterThan(0);
        });
        
        // Verify Server State was updated
        expect(db.balance).toBe(100);

        // --- RELOAD: Unmount and Remount ---
        console.log('--- Reloading Page (Session 2) ---');
        unmount();
        
        // Render NEW instance. 
        // This resets all React state (useState, useRef).
        // It triggers useEffect -> fetch -> calls mock API -> reads from `db` variable.
        render(<Home />);

        // 4. Verify Persistence (Session 2)
        await waitFor(() => {
             // If this passes, it proves the UI correctly fetches and displays stored data on load
             const persisted = screen.getAllByText((content) => content.includes('100 CC'));
             expect(persisted.length).toBeGreaterThan(0);
        });
    });
});

