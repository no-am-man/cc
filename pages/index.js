import { useState, useEffect } from 'react';
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

  const api = async (path, options) => {
    const res = await fetch(`/api/${path}`, options);
    if (!res.ok) {
        const text = await res.text();
        console.error(`API Error ${path}:`, text);
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  };

  const fetchData = async () => {
    if (!session) return;
    try {
        const [infoData, portfolioData, chainData] = await Promise.all([
        api('info'),
        api('portfolio'),
        api('chain'),
        ]);
        setInfo(infoData);
        setPortfolio(portfolioData);
        setChain(chainData);
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
    await api('mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(mintAmount) }),
    });
    fetchData();
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
    fetchData();
  };

  const handleTrust = async (action) => {
    await api('trust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: trustUser }),
    });
    fetchData();
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
                <Button variant="secondary" onClick={() => signOut()}>Sign Out</Button>
            </div>
        )}
      </header>

      <main>
        {!session ? (
          <div className="hero">
            <h1>Welcome to Re-Public</h1>
            <p>Your Personal Economy on the Blockchain.</p>
            <Button onClick={() => signIn('google')}>Connect with Google</Button>
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
                        <label>Amount (CC)</label>
                        <input
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
          background-color: #f7f9fc;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
        }
        .header {
            background: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .logo {
            font-size: 1.5rem;
            font-weight: bold;
            color: #333;
        }
        .user-info {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        main {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        .hero {
            text-align: center;
            padding: 5rem 0;
        }
        .dashboard {
            display: flex;
            flex-direction: column;
            gap: 2rem;
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
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 1rem;
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
            border-collapse: collapse;
            font-size: 0.9rem;
        }
        .chain-table th, .chain-table td {
            text-align: left;
            padding: 0.75rem;
            border-bottom: 1px solid #eee;
        }
        .chain-table th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        .badge {
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        .badge.MINT { background-color: #e6f4ea; color: #1e7e34; }
        .badge.SEND { background-color: #fff3cd; color: #856404; }
        .badge.RECEIVE { background-color: #d1ecf1; color: #0c5460; }
        .badge.CONTRACT { background-color: #e2e3e5; color: #383d41; }
      `}</style>
      <style jsx global>{`
        body {
            margin: 0;
            padding: 0;
            background-color: #f7f9fc;
        }
        * {
            box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}
