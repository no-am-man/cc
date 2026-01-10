
import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Head from 'next/head';

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
    return res.json();
  };

  const fetchData = async () => {
    if (!session) return;
    const [infoData, portfolioData, chainData] = await Promise.all([
      api('info'),
      api('portfolio'),
      api('chain'),
    ]);
    setInfo(infoData);
    setPortfolio(portfolioData);
    setChain(chainData);
  };

  useEffect(() => {
    fetchData();
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
        <title>Re-Public Next.js</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1>Re-Public Next.js</h1>

        {!session ? (
          <button onClick={() => signIn('google')}>Sign in with Google</button>
        ) : (
          <div>
            <p>Signed in as {session.user.email}</p>
            <button onClick={() => signOut()}>Sign out</button>

            <div className="grid">
              <div className="card">
                <h3>Node Info</h3>
                {info && <pre>{JSON.stringify(info, null, 2)}</pre>}
              </div>

              <div className="card">
                <h3>Portfolio</h3>
                {portfolio && <pre>{JSON.stringify(portfolio, null, 2)}</pre>}
              </div>

              <div className="card">
                <h3>Blockchain</h3>
                <div className="chain-container">
                  {chain.map((block, i) => (
                    <pre key={i}>{JSON.stringify(block, null, 2)}</pre>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3>Mint Tokens</h3>
                <input
                  type="number"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                />
                <button onClick={handleMint}>Mint</button>
              </div>

              <div className="card">
                <h3>Send Tokens</h3>
                <input
                  type="text"
                  placeholder="Recipient"
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
                  placeholder="Message"
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                />
                <button onClick={handleSend}>Send</button>
              </div>

              <div className="card">
                <h3>Trust Lines</h3>
                 <input
                  type="text"
                  placeholder="User ID"
                  value={trustUser}
                  onChange={(e) => setTrustUser(e.target.value)}
                />
                <button onClick={() => handleTrust('add')}>Add Trust</button>
                <button onClick={() => handleTrust('remove')}>Remove Trust</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .container {
          min-height: 100vh;
          padding: 0 0.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        main {
          padding: 5rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        .grid {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          max-width: 800px;
          margin-top: 3rem;
        }
        .card {
          margin: 1rem;
          flex-basis: 45%;
          padding: 1.5rem;
          text-align: left;
          color: inherit;
          text-decoration: none;
          border: 1px solid #eaeaea;
          border-radius: 10px;
          transition: color 0.15s ease, border-color 0.15s ease;
        }
        .chain-container {
          max-height: 300px;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}
