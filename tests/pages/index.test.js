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
global.fetch = jest.fn();

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
    // Need 3 promises for Promise.all, if one fails, Promise.all fails
    // So mocking just one failure is enough to trigger the catch block

    await act(async () => {
      render(<Home />);
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch data'), expect.any(Error));
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
        jest.advanceTimersByTime(5000);
    });

    expect(global.fetch).toHaveBeenCalled(); // Should fetch again
    jest.useRealTimers();
  });
});
