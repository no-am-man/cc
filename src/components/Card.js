export default function Card({ title, children }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {children}
      <style jsx>{`
        .card {
          margin: 1rem;
          padding: 1.5rem;
          text-align: left;
          color: inherit;
          text-decoration: none;
          border: 1px solid #eaeaea;
          border-radius: 10px;
          transition: color 0.15s ease, border-color 0.15s ease;
          background: white;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .card:hover {
          border-color: #0070f3;
        }
        h3 {
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
        }
      `}</style>
    </div>
  );
}

