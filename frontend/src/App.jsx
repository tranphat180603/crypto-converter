import CryptoConverter from './components/CryptoConverter';
import tokenMetricsImage from '/tokenmetrics-logo.png';
import './App.css'; // Create a new CSS file for this

function App() {
  return (
    <div className="app-container">
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
