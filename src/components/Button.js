export default function Button({ onClick, children, variant = 'primary' }) {
  return (
    <button onClick={onClick} className={`btn ${variant}`}>
      {children}
      <style jsx>{`
        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 1rem;
          transition: background 0.2s ease;
          margin: 0.5rem 0;
        }
        .primary {
          background: #0070f3;
          color: white;
        }
        .primary:hover {
          background: #0051a2;
        }
        .secondary {
          background: #eaeaea;
          color: black;
        }
        .secondary:hover {
          background: #ccc;
        }
      `}</style>
    </button>
  );
}

