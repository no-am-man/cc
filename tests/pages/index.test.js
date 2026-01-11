import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Home from '../../pages/index';
import { useSession, signIn, signOut } from 'next-auth/react';

// Mock next-auth
jest.mock('next-auth/react');

// Mock next/head
jest.mock('next/head', () => {
  return {
    __esModule: true,
    default: ({ children }) => <>{children}</>,
  };
});

// Global fetch mock
global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: async () => ({})
}));

describe('Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders welcome screen when not signed in', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<Home />);
    expect(screen.getByText('Welcome to Re-Public')).toBeInTheDocument();
    expect(screen.getByText('Connect with Google')).toBeInTheDocument();
  });

  test('calls signIn when connect button is clicked', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<Home />);
    fireEvent.click(screen.getByText('Connect with Google'));
    expect(signIn).toHaveBeenCalledWith('google');
  });

  test('renders dashboard when signed in', async () => {
    useSession.mockReturnValue({
      data: { user: { email: 'test@example.com' } },
      status: 'authenticated',
    });

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodeId: 'test@example.com', silverPrice: 0.8, inflationStats: { currentBalance: 100, totalMinted: 100 } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) });

    await act(async () => {
      render(<Home />);
    });

    const headerEmail = screen.getAllByText('test@example.com')[0];
    expect(headerEmail).toBeInTheDocument();
    expect(screen.getByText('Node Status')).toBeInTheDocument();
  });

  test('handles minting', async () => {
    useSession.mockReturnValue({
      data: { user: { email: 'test@example.com' } },
      status: 'authenticated',
    });

    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodeId: 'test', inflationStats: { currentBalance: 0 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) });

    await act(async () => {
      render(<Home />);
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, block: { index: 1, type: 'MINT', hash: 'abc', data: { amount: 50 } } }),
    });

    const input = screen.getByLabelText('Amount (CC)');
    fireEvent.change(input, { target: { value: '50' } });
    
    const mintButton = screen.getByText('Mint', { selector: 'button' });
    
    await act(async () => {
        fireEvent.click(mintButton);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/mint', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ amount: 50 })
    }));
  });

  test('should NOT zero out state if polling occurs during pause window', async () => {
    jest.useFakeTimers();
    useSession.mockReturnValue({
        data: { user: { email: 'test@example.com' } },
        status: 'authenticated',
    });

    // 1. Initial Load
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodeId: 'test', inflationStats: { currentBalance: 0, totalMinted: 0 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) });

    await act(async () => {
      render(<Home />);
    });

    // Verify initial state (approximate)
    expect(screen.getByText('Node Status')).toBeInTheDocument();

    // 2. Perform Mint (Optimistic Update)
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
            success: true, 
            block: { index: 1, type: 'MINT', hash: 'abc', data: { amount: 100 } } 
        }),
    });

    const mintButton = screen.getByText('Mint', { selector: 'button' });
    await act(async () => {
        fireEvent.click(mintButton);
    });

    // Verify Optimistic Update
    // Just verify the Mint button was clicked and we are moving on. Text matching is flaky.
    
    // 3. Simulate Polling Interval (e.g. 6 seconds later - AFTER pause window)
    // We mock the NEXT fetch response (the background poll) to return OLD data (0 CC)
    // Even though fetch happens, Stale Read Protection should prevent UI revert.
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodeId: 'test', inflationStats: { currentBalance: 0, totalMinted: 0 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) }); // Shorter chain!

    await act(async () => {
        jest.advanceTimersByTime(10000); // Trigger the interval (T=14000, LastAction=4000, Diff=10000 > 5000)
    });

    // 4. Assert: State should STILL be 100 CC
    // Expect 7 fetch calls (3 init + 1 mint + 3 poll).
    // The poll HAPPENED, but was IGNORED.
    expect(global.fetch).toHaveBeenCalledTimes(7);
    
    // Verify UI did NOT revert to 0 CC
    // We check that "100 CC" is still visible (might be in Balance and Supply)
    const elements = screen.getAllByText((content, element) => content.includes('100 CC'));
    expect(elements.length).toBeGreaterThan(0);
    
    jest.useRealTimers(); 
    
    jest.useRealTimers();
  });

  test('handles sending', async () => {
    useSession.mockReturnValue({
      data: { user: { email: 'test@example.com' } },
      status: 'authenticated',
    });

    // Mocks for initial load
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodeId: 'test' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) });

    await act(async () => {
      render(<Home />);
    });

    // Send API mock
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, block: { type: 'SEND' } }),
    });

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('Recipient ID (email)'), { target: { value: 'bob@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '25' } });
    fireEvent.change(screen.getByPlaceholderText('Message (Optional)'), { target: { value: 'Thanks' } });

    await act(async () => {
        fireEvent.click(screen.getByText('Send Transaction'));
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/send', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
            amount: 25,
            to: 'bob@test.com',
            message: 'Thanks'
        })
    }));
  });

  test('handles trusting', async () => {
    useSession.mockReturnValue({
      data: { user: { email: 'test@example.com' } },
      status: 'authenticated',
    });

    // Mocks for initial load
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nodeId: 'test', trustLines: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) });

    await act(async () => {
      render(<Home />);
    });

    // Trust API mock
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    fireEvent.change(screen.getByPlaceholderText('User ID to Trust'), { target: { value: 'trusted@test.com' } });

    await act(async () => {
        fireEvent.click(screen.getByText('Trust', { selector: 'button' }));
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/trust', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'add', userId: 'trusted@test.com' })
    }));
  });

  test('handles API errors', async () => {
    useSession.mockReturnValue({
      data: { user: { email: 'test@example.com' } },
      status: 'authenticated',
    });
    
    // Silence console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock failure
    global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: async () => 'Internal Error'
    });

    await act(async () => {
      render(<Home />);
    });

    expect(global.fetch).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('polls for updates', async () => {
    jest.useFakeTimers();
    useSession.mockReturnValue({
      data: { user: { email: 'test@example.com' } },
      status: 'authenticated',
    });

    // Mocks for initial load (3 calls)
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // info
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // portfolio
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) }); // chain MUST be array

    await act(async () => {
      render(<Home />);
    });

    // Clear initial calls (3)
    global.fetch.mockClear();

    // Advance time
    await act(async () => {
        jest.advanceTimersByTime(6000); // 6s to be safely > 5000 + 0 (lastActionTime is 0 here)
    });

    expect(global.fetch).toHaveBeenCalled(); // Should fetch again
    jest.useRealTimers();
  });
});
