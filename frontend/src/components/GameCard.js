const GameCard = ({ title, subtitle, colors }) => {
  return (
    <div className="panel game-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="section-title">{title}</p>
          <p style={{ margin: 0, color: '#b8c9ff' }}>{subtitle}</p>
        </div>
        <div style={{ color: '#ff7cb8', fontSize: '1.75rem' }}>✨</div>
      </div>
      {colors && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          {colors.map((color) => (
            <span key={color} className="info-chip">{color}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export default GameCard;
