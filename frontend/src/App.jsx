import { useState } from 'react';
import CryptoConverter from './components/CryptoConverter';
import tokenMetricsImage from '/tokenmetrics-logo.png';
import './App.css'; // Create a new CSS file for this

function App() {
  const [isActive, setIsActive] = useState(false);

  const handleContainerClick = () => {
    setIsActive(true);
    // Reset the active state after animation completes if user clicks away
    document.addEventListener('click', function resetBorder(e) {
      if (!e.target.closest('.app-container')) {
        setIsActive(false);
        document.removeEventListener('click', resetBorder);
      }
    });
  };

  return (
    <div 
      className={`app-container ${isActive ? 'active' : ''}`}
      onClick={handleContainerClick}
    >
      <div className="app-content">
        {/* Logo */}
        <img className="app-logo" src={tokenMetricsImage} alt="Token Metrics AI" />
        
        {/* Converter */}
        <CryptoConverter />
      </div>
    </div>
  );
}

export default App;
