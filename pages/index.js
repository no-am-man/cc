import { useState, useEffect, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Head from 'next/head';
import Card from '../src/components/Card';
import Button from '../src/components/Button';

export default function Home() {
  const { data: session } = useSession();
  const [info, setInfo] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [mintAmount, setMintAmount] = useState(100);
  const [sendAmount, setSendAmount] = useState(10);
  const [sendTo, setSendTo] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [trustUser, setTrustUser] = useState('');
  const [chain, setChain] = useState([]);
  const [loginLoopDetected, setLoginLoopDetected] = useState(false);

  const api = async (path, options = {}) => {
    const res = await fetch(`/api/${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        credentials: 'include', // Force cookies to be sent (fix for session loss in API)
    });
    if (!res.ok) {
        if (res.status === 401) {
            console.warn(`[API] 401 Unauthorized for ${path}.`);
            
            // Prevent infinite loops using localStorage
            if (typeof window !== 'undefined') {
                const lastLogout = localStorage.getItem('last_force_logout');
                // If we forced logout recently (within 15s), STOP and show error.
                if (lastLogout && Date.now() - Number(lastLogout) < 15000) {
                     console.error("Login loop detected.");
                     setLoginLoopDetected(true);
                     return null;
                }

                // Retry logic: If this is the first 401, maybe just wait a bit?
                // No, if session is invalid, we must re-login.
                console.warn("Backend rejected session (401). Frontend session exists. Mismatch detected.");
                
                // Only force logout if we have a session but API rejects it
                if (session) {
                    console.warn("Attempting to sign out (hard redirect)...");
                    localStorage.setItem('last_force_logout', Date.now());
                    window.location.href = '/api/auth/signout?callbackUrl=/';
                }
            }
            return null;
        }
        const text = await res.text();
        console.error(`API Error ${path}:`, text);
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
    }
    // If successful, clear the force logout flag so we don't carry over "bad reputation"
    if (typeof window !== 'undefined') {
        localStorage.removeItem('last_force_logout');
    }
    return res.json();
  };

  // Use Ref to avoid stale closures in setInterval
  const lastActionTimeRef = useRef(0);
  const chainRef = useRef([]);

  // Keep chainRef in sync with state
  useEffect(() => {
      chainRef.current = chain;
  }, [chain]);

  const fetchData = async () => {
    if (!session || loginLoopDetected) return;
    
    // Skip fetch if we just performed an action
    const timeSinceLastAction = Date.now() - lastActionTimeRef.current;
    
    // Use <= to ensure we skip even if interval aligns exactly with the pause duration
    if (timeSinceLastAction <= 5000) {
        return;
    }

    try {
        const [infoData, portfolioData, chainData] = await Promise.all([
        api('info'),
        api('portfolio'),
        api('chain'),
        ]);

        // Stale Read Protection:
        // If the server returns a shorter chain than we currently have locally (optimistically),
        // it means the server is stale (eventual consistency). Ignore this update.
        // We assume the chain only grows.
        if (Array.isArray(chainData) && chainData.length < chainRef.current.length) {
            console.warn(`[Stale Read] Server chain height ${chainData.length} < Local ${chainRef.current.length}. Ignoring update.`);
            return; 
        }

        setInfo(infoData);
        setPortfolio(portfolioData);
        setChain(Array.isArray(chainData) ? chainData : []);
    } catch (e) {
        console.error("Failed to fetch data", e);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [session]);

  const handleMint = async () => {
    const data = await api('mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(mintAmount) }),
    });
    
    // Optimistic / Immediate Update from Response
    if (data.success && data.block) {
        console.log(`[UI] Minted successfully for Node ID: '${data.nodeId}'`);
        lastActionTimeRef.current = Date.now(); // Pause polling
        setChain(prev => [...prev, data.block]);
        
        setInfo(prev => {
            if (!prev) return prev;
            const currentStats = prev.inflationStats || { currentBalance: 0, totalMinted: 0 };
            return {
                ...prev,
                inflationStats: {
                    ...currentStats,
                    currentBalance: currentStats.currentBalance + Number(mintAmount),
                    totalMinted: currentStats.totalMinted + Number(mintAmount)
                }
            };
        });
        // We avoid calling fetchData() immediately to prevent overwriting with stale data
        // The polling interval will catch up eventually
    }
  };

  const handleSend = async () => {
    await api('send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(sendAmount),
        to: sendTo,
        message: sendMessage,
      }),
    });
    lastActionTimeRef.current = Date.now(); // Pause polling
    // fetchData(); // Let the poll pick it up later or implement optimistic update here too
  };

  const handleTrust = async (action) => {
    await api('trust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: trustUser }),
    });
    lastActionTimeRef.current = Date.now(); // Pause polling
    // fetchData();
  };

  const handleViewChain = () => {
      const jsonString = JSON.stringify(chain, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      window.open(href, '_blank');
  };

  const handleResetAccount = async () => {
      if (!confirm("⚠️ DANGER ZONE: RESET ACCOUNT? \n\nThis will PERMANENTLY DELETE your:\n- Blockchain & Balance\n- Private Keys\n- Trust Network\n\nIt will be as if you never existed. This cannot be undone.")) {
          return;
      }
      
      try {
          await api('delete', { method: 'POST' });
          alert("Account reset successfully. Redirecting...");
          // Force a full clean sign out and reload
          window.location.href = '/api/auth/signout?callbackUrl=/';
      } catch (e) {
          alert("Failed to reset: " + e.message);
      }
  };

  return (
    <div className="container">
      <Head>
        <title>Re-Public Network</title>
        <meta name="description" content="A decentralized personal economy network" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="header">
        <div className="logo">Re-Public</div>
        {session && (
            <div className="user-info">
                <span>{session.user.email}</span>
                <Button onClick={handleViewChain}>View Blockchain</Button>
                <Button onClick={handleResetAccount} variant="danger">Reset Account</Button>
                <Button variant="secondary" onClick={() => signOut()}>Sign Out</Button>
            </div>
        )}
      </header>

      <main>
        {!session ? (
          <div className="landing-page">
            <section className="landing-hero">
                <h1>The Platform State</h1>
                <p>A Proposal for Polycentric Federalism. Reimagining the nation-state as a neutral operating system for competing jurisdictions.</p>
                <div style={{ marginTop: '2rem' }}>
                    <Button onClick={() => signIn('google')} size="large">Connect to the Platform</Button>
                </div>
            </section>

            <section className="landing-section">
                <h2 className="section-title">The Theoretical Crisis</h2>
                <div className="landing-grid">
                    <div className="feature-card">
                        <h3>The Problem of the Republic</h3>
                        <p>Centralized states provide stability and common defense but inevitably suffer from the "Ratchet Effect"—a continuous expansion of power that erodes individual liberty and imposes "one-size-fits-all" policies on diverse populations.</p>
                    </div>
                    <div className="feature-card">
                        <h3>The Problem of Anarchy</h3>
                        <p>Pure private law societies (Anarcho-Capitalism) offer maximum liberty and market efficiency but suffer from high transaction costs in dispute resolution and vulnerability to foreign conquest ("The Warlord Problem").</p>
                    </div>
                    <div className="feature-card" style={{ border: '2px solid #2563eb' }}>
                        <h3 style={{ color: '#2563eb' }}>The Synthesis: PubFed</h3>
                        <p>We propose a "Public Federation" that acts as a constitutional shell, hosting internal "Special Economic Zones" (SEZs) that function as market-driven governance providers.</p>
                    </div>
                </div>
            </section>

            <section className="landing-section" style={{ background: 'white' }}>
                <h2 className="section-title">The Architecture</h2>
                <div className="landing-grid">
                    <div className="feature-card">
                        <h3>1. The Kernel</h3>
                        <p><strong>The Federal Government (Hardware Layer)</strong></p>
                        <p>Function strictly limited to maintaining the physical integrity of the platform: National Defense and the "Meta-Constitution". Forbidden from enacting social or economic legislation.</p>
                    </div>
                    <div className="feature-card">
                        <h3>2. The Applications</h3>
                        <p><strong>The Zones (Software Layer)</strong></p>
                        <p>Autonomous Charter Zones providing day-to-day governance: police, contract law, education, healthcare. Zones compete for residents.</p>
                    </div>
                    <div className="feature-card">
                        <h3>3. The SLA</h3>
                        <p><strong>The Meta-Constitution</strong></p>
                        <p>Acts as a Service Level Agreement enforcing negative rights: Right of Exit, Right of Due Process, and the "No Warlords" Clause.</p>
                    </div>
                </div>
            </section>

            <section className="landing-section">
                <h2 className="section-title">A Day in the Life (2045)</h2>
                <div className="story-timeline">
                    <div className="story-event">
                        <span className="story-time">07:00 AM</span>
                        <h3>The Commute</h3>
                        <p>Elias wakes up in "San Futuro" (Zone A), a hyper-capitalist Tech Zone with 0% tax but high subscription fees. He boards the maglev train to work.</p>
                    </div>
                    <div className="story-event">
                        <span className="story-time">08:30 AM</span>
                        <h3>Crossing the Border</h3>
                        <p>He enters "New Solidarity" (Zone B), a Syndicalist Collective. His smart-glasses notify him: "Speed limits enforced. Public drug use illegal." His phone switches to the local mesh network.</p>
                    </div>
                    <div className="story-event">
                        <span className="story-time">09:00 AM</span>
                        <h3>The Office</h3>
                        <p>Elias works in New Solidarity because of its strong IP protections for artists. When a client in "Arcadia" (Zone C) fails to pay, the Federal Tribunal AI issues a summary judgment in 3 seconds based on their smart contract.</p>
                    </div>
                    <div className="story-event">
                        <span className="story-time">06:00 PM</span>
                        <h3>The "Exit" Decision</h3>
                        <p>His friend Sarah decides to leave "Ironhold" (Zone D) because the governor raised security fees. Thanks to the Federal Right of Exit, she instantly books a move to a coastal zone matching her lifestyle.</p>
                    </div>
                </div>
            </section>

            <section className="landing-section" style={{ textAlign: 'center' }}>
                <h2 className="section-title">Join the Network</h2>
                <p style={{ maxWidth: '600px', margin: '0 auto 2rem', fontSize: '1.2rem', color: '#64748b' }}>
                    It is not Utopia. It is simply a market where the product is "Law," and the consumer is King.
                </p>
                <Button onClick={() => signIn('google')} size="large">Connect to the Platform</Button>
            </section>
          </div>
        ) : loginLoopDetected ? (
            <div className="hero">
                <h1>Connection Issue</h1>
                <p>We detected a login loop due to stale cookies.</p>
                <Button onClick={() => {
                    localStorage.removeItem('last_force_logout');
                    // Force a hard reload to clear application state
                    window.location.href = '/api/auth/signout?callbackUrl=/'; 
                }}>
                    Reset Connection
                </Button>
            </div>
        ) : (
          <div className="dashboard">
            
            {/* Top Row: Stats */}
            <div className="stats-row">
                <Card title="Node Status">
                    {info ? (
                        <div className="stat-grid">
                            <div><strong>Node ID:</strong> {info.nodeId}</div>
                            <div><strong>Silver Price:</strong> ${info.silverPrice}/g</div>
                            <div><strong>Balance:</strong> {info.inflationStats?.currentBalance} CC</div>
                            <div><strong>Supply:</strong> {info.inflationStats?.totalMinted} CC</div>
                        </div>
                    ) : <p>Loading...</p>}
                </Card>
                <Card title="Portfolio">
                    {portfolio ? (
                        <div className="portfolio-list">
                            {/* Assuming portfolio is an object or array */}
                            <pre>{JSON.stringify(portfolio, null, 2)}</pre>
                        </div>
                    ) : <p>Loading...</p>}
                </Card>
            </div>

            {/* Middle Row: Actions */}
            <div className="actions-row">
                <Card title="Mint Currency">
                    <div className="form-group">
                        <label htmlFor="mintAmount">Amount (CC)</label>
                        <input
                            id="mintAmount"
                            type="number"
                            value={mintAmount}
                            onChange={(e) => setMintAmount(e.target.value)}
                        />
                        <Button onClick={handleMint}>Mint</Button>
                    </div>
                </Card>

                <Card title="Send / Pay">
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="Recipient ID (email)"
                            value={sendTo}
                            onChange={(e) => setSendTo(e.target.value)}
                        />
                        <input
                            type="number"
                            placeholder="Amount"
                            value={sendAmount}
                            onChange={(e) => setSendAmount(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Message (Optional)"
                            value={sendMessage}
                            onChange={(e) => setSendMessage(e.target.value)}
                        />
                        <Button onClick={handleSend}>Send Transaction</Button>
                    </div>
                </Card>

                <Card title="Trust Network">
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="User ID to Trust"
                            value={trustUser}
                            onChange={(e) => setTrustUser(e.target.value)}
                        />
                        <div className="btn-group">
                            <Button onClick={() => handleTrust('add')}>Trust</Button>
                            <Button variant="secondary" onClick={() => handleTrust('remove')}>Untrust</Button>
                        </div>
                    </div>
                    <div className="trust-list">
                        <h4>Trusted Peers:</h4>
                        <ul>
                            {info?.trustLines?.map(t => <li key={t}>{t}</li>)}
                        </ul>
                    </div>
                </Card>
            </div>

            {/* Bottom Row: Chain */}
            <div className="chain-row">
                <Card title="Blockchain Ledger">
                    <div className="chain-container">
                        {chain.length === 0 ? <p>No blocks yet.</p> : (
                            <table className="chain-table">
                                <thead>
                                    <tr>
                                        <th>Idx</th>
                                        <th>Type</th>
                                        <th>Hash</th>
                                        <th>Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chain.slice().reverse().map((block) => (
                                        <tr key={block.hash}>
                                            <td>{block.index}</td>
                                            <td><span className={`badge ${block.type}`}>{block.type}</span></td>
                                            <td title={block.hash}>{block.hash.substring(0, 10)}...</td>
                                            <td><pre>{JSON.stringify(block.data)}</pre></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </Card>
            </div>

          </div>
        )}
      </main>

      <style jsx>{`
        .container {
          min-height: 100vh;
          background-color: #f8fafc; /* slate-50 */
          color: #0f172a; /* slate-900 */
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .header {
            background: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            position: sticky;
            top: 0;
            z-index: 50;
        }
        .logo {
            font-size: 1.5rem;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.05em;
        }
        .user-info {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        main {
          padding: 0;
          max-width: 100%;
          margin: 0 auto;
        }
        
        /* Landing Page Styles */
        .landing-section {
            padding: 5rem 2rem;
            max-width: 1200px;
            margin: 0 auto;
        }
        .landing-hero {
            text-align: center;
            padding: 8rem 2rem;
            background: linear-gradient(to bottom, #f8fafc, #e2e8f0);
        }
        .landing-hero h1 {
            font-size: 4rem;
            font-weight: 900;
            margin-bottom: 1rem;
            letter-spacing: -0.05em;
            background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .landing-hero p {
            font-size: 1.5rem;
            color: #64748b;
            max-width: 800px;
            margin: 0 auto 3rem;
            line-height: 1.6;
        }
        .landing-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 3rem;
            margin-top: 3rem;
        }
        .feature-card {
            background: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
            border: 1px solid #e2e8f0;
        }
        .feature-card h3 {
            font-size: 1.5rem;
            margin-bottom: 1rem;
            color: #0f172a;
        }
        .feature-card p {
            color: #64748b;
            line-height: 1.6;
        }
        .section-title {
            text-align: center;
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 3rem;
            color: #0f172a;
        }
        .story-timeline {
            position: relative;
            max-width: 800px;
            margin: 0 auto;
            border-left: 2px solid #e2e8f0;
            padding-left: 2rem;
        }
        .story-event {
            margin-bottom: 3rem;
            position: relative;
        }
        .story-event::before {
            content: '';
            position: absolute;
            left: -2.6rem;
            top: 0.5rem;
            width: 1rem;
            height: 1rem;
            background: #2563eb;
            border-radius: 50%;
            border: 4px solid white;
            box-shadow: 0 0 0 1px #e2e8f0;
        }
        .story-time {
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 0.5rem;
            display: block;
        }
        
        /* Dashboard Styles */
        .dashboard {
            display: flex;
            flex-direction: column;
            gap: 2rem;
            padding: 2rem;
            max-width: 1200px;
            margin: 0 auto;
        }
        .stats-row, .actions-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
        }
        .stat-grid {
            display: grid;
            gap: 0.5rem;
        }
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 0.8rem;
        }
        .form-group input {
            padding: 0.8rem;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            font-size: 1rem;
            transition: all 0.2s;
        }
        .form-group input:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .btn-group {
            display: flex;
            gap: 0.5rem;
        }
        .chain-container {
            overflow-x: auto;
        }
        .chain-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 0.9rem;
        }
        .chain-table th {
            text-align: left;
            padding: 1rem;
            border-bottom: 2px solid #e2e8f0;
            color: #64748b;
            font-weight: 600;
            background-color: #f8fafc;
        }
        .chain-table td {
            padding: 1rem;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
        }
        .badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .badge.MINT { background-color: #dcfce7; color: #15803d; }
        .badge.SEND { background-color: #fef9c3; color: #a16207; }
        .badge.RECEIVE { background-color: #dbeafe; color: #1d4ed8; }
        .badge.CONTRACT { background-color: #f1f5f9; color: #475569; }
      `}</style>
      <style jsx global>{`
        body {
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
        }
        * {
            box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}
