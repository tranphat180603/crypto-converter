import axios from 'axios';

// Use the environment variable from Vite with a proper fallback for production
const API_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:2003' 
    : '/api');

console.log('Using API URL:', API_URL);

const tokenService = {
  // Get all available tokens
  async getTokens() {
    try {
      console.log('Fetching tokens from:', `${API_URL}/tokens`);
      const response = await axios.get(`${API_URL}/tokens`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      console.log('Tokens response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching tokens:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      // Fall back to mock data if API is unavailable
      return this.getMockTokens();
    }
  },

  // Get all available fiat currencies
  async getFiats() {
    try {
      const response = await axios.get(`${API_URL}/fiats`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching fiats:', error);
      // Fall back to mock data if API is unavailable
      return this.getMockFiats();
    }
  },

  // Convert between currencies
  async convertCurrency(fromCurrency, toCurrency, amount) {
    try {
      const response = await axios.post(`${API_URL}/convert`, {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        amount: parseFloat(amount)
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error converting currency:', error);
      
      // For development, fall back to mock conversion
      console.log('Using mock conversion as fallback');
      return this.mockConvert(fromCurrency, toCurrency, amount);
    }
  },

  // Mock data for development (if API is not available)
  getMockTokens() {
    return [
      { symbol: 'BTC', name: 'Bitcoin', logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' },
      { symbol: 'ETH', name: 'Ethereum', logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
      { symbol: 'USDT', name: 'Tether', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
      { symbol: 'BNB', name: 'Binance Coin', logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' },
      { symbol: 'XRP', name: 'XRP', logo: 'https://cryptologos.cc/logos/xrp-xrp-logo.png' },
      { symbol: 'ADA', name: 'Cardano', logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png' },
      { symbol: 'SOL', name: 'Solana', logo: 'https://cryptologos.cc/logos/solana-sol-logo.png' },
      { symbol: 'DOGE', name: 'Dogecoin', logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
    ];
  },

  getMockFiats() {
    return [
      { symbol: 'USD', name: 'US Dollar' },
      { symbol: 'EUR', name: 'Euro' },
      { symbol: 'GBP', name: 'British Pound' },
      { symbol: 'JPY', name: 'Japanese Yen' },
      { symbol: 'CAD', name: 'Canadian Dollar' },
    ];
  },

  // Mock conversion for development
  mockConvert(fromCurrency, toCurrency, amount) {
    const rates = {
      'BTC-USD': 59000,
      'ETH-USD': 3500,
      'BTC-ETH': 16.85,
      'ETH-BTC': 0.059,
      'BTC-TRX': 356758.26,
      'TRX-BTC': 0.0000028,
      'USD-BTC': 0.000017,
      'USD-ETH': 0.00029,
      'CNY-BTC': 0.0000024,
      'BTC-CNY': 416666.67,
      'CNY-USD': 0.14,
      'USD-CNY': 7.14
    };

    const key = `${fromCurrency}-${toCurrency}`;
    const reverseKey = `${toCurrency}-${fromCurrency}`;
    
    let rate;
    if (rates[key]) {
      rate = rates[key];
    } else if (rates[reverseKey]) {
      rate = 1 / rates[reverseKey];
    } else {
      // Default rate if not found
      rate = 1;
    }
    
    const converted_amount = parseFloat(amount) * rate;
    
    // Format numbers for display with proper thousand separators
    const formatNumber = (num) => {
      // For very small numbers, use more decimal places
      let decimalPlaces = 2;
      
      if (num < 0.00000001) decimalPlaces = 12;
      else if (num < 0.0000001) decimalPlaces = 10;
      else if (num < 0.000001) decimalPlaces = 9;
      else if (num < 0.00001) decimalPlaces = 8;
      else if (num < 0.0001) decimalPlaces = 6;
      else if (num < 0.001) decimalPlaces = 5;
      
      // Ensure very small numbers don't display as zero
      if (num > 0 && num < 0.000000001) {
        return num.toExponential(6);
      }
      
      return new Intl.NumberFormat('en-US', { 
        maximumFractionDigits: decimalPlaces,
        minimumFractionDigits: num < 0.001 ? decimalPlaces : 0,
        useGrouping: true // Ensure thousand separators are used
      }).format(num);
    };
    
    // Ensure we never return zero for positive values
    const safeFormatNumber = (num) => {
      if (num > 0 && formatNumber(num) === "0") {
        return num.toExponential(6);
      }
      return formatNumber(num);
    };
    
    return {
      from: fromCurrency,
      to: toCurrency,
      amount: parseFloat(amount),
      amount_formatted: formatNumber(parseFloat(amount)),
      converted_amount: converted_amount,
      converted_amount_formatted: safeFormatNumber(converted_amount),
      rate: rate,
      rate_formatted: safeFormatNumber(rate)
    };
  },

  // Search for tokens by name or symbol
  async searchTokens(query) {
    if (!query || query.length < 2) {
      return []; // Don't search for very short queries
    }
    
    try {
      const response = await axios.get(`${API_URL}/tokens/search`, {
        params: { query }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching tokens:', error);
      return [];
    }
  }
};

export default tokenService; 