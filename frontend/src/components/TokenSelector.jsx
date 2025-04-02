import { useState, useEffect, useRef } from 'react';
import tokenService from '../api/tokenService';

const DEFAULT_CRYPTO_ICON = "https://cryptologos.cc/logos/question-mark.png";

const TokenSelector = ({ label, value, onChange, tokens, onAmountChange, amount, readOnly }) => {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  
  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }

    // Add the event listener when dropdown is showing
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // Clean up
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);
  
  // Debounced search effect
  useEffect(() => {
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (!search || search.length < 2) {
      // When no search term or too short, just show the default tokens
      setFilteredTokens(tokens);
      return;
    }
    
    // First filter local tokens immediately
    const localMatches = tokens.filter(token => 
      token.symbol.toLowerCase().includes(search.toLowerCase()) || 
      token.name.toLowerCase().includes(search.toLowerCase())
    );
    
    setFilteredTokens(localMatches);
    
    // Then search API after a delay (debounce)
    if (localMatches.length < 5) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          setIsSearching(true);
          const apiResults = await tokenService.searchTokens(search);
          
          // Filter out tokens we already have locally to avoid duplicates
          const newTokens = apiResults.filter(
            apiToken => !localMatches.some(localToken => 
              localToken.symbol === apiToken.symbol
            )
          );
          
          // Combine local and API results
          setFilteredTokens([...localMatches, ...newTokens]);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsSearching(false);
        }
      }, 500); // 500ms debounce delay
    }
  }, [search, tokens]);
  
  const handleTokenSelect = (token) => {
    onChange(token);
    setShowDropdown(false);
    setSearch('');
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="token-input flex justify-between items-center">
        <div className="flex-1">
          <input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-full bg-transparent text-2xl font-medium focus:outline-none"
            placeholder="0.00"
            disabled={readOnly}
          />
        </div>
        
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="token-selector flex items-center gap-2 p-2 rounded-lg"
            type="button"
          >
            <img 
              src={value?.logo || DEFAULT_CRYPTO_ICON} 
              alt={value?.symbol || 'Select'} 
              className="w-8 h-8 rounded-full object-contain border border-gray-700"
              onError={(e) => { e.target.src = DEFAULT_CRYPTO_ICON; }}
            />
            <span className="font-medium">{value?.symbol || 'Select'}</span>
          </button>
          
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-accent rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
              <div className="p-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full p-2 bg-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Search tokens..."
                  autoFocus
                />
              </div>
              <ul>
                {isSearching && (
                  <li className="px-4 py-2 text-gray-400">Searching...</li>
                )}
                {!isSearching && filteredTokens.map((token) => (
                  <li key={token.symbol}>
                    <button
                      onClick={() => handleTokenSelect(token)}
                      className="w-full text-left px-4 py-2 hover:bg-white hover:bg-opacity-10 hover:backdrop-blur-sm flex items-center gap-2"
                    >
                      <img 
                        src={token.logo || DEFAULT_CRYPTO_ICON} 
                        alt={token.symbol} 
                        className="w-8 h-8 rounded-full object-contain border border-gray-700"
                        onError={(e) => { 
                          console.log(`Failed to load image for ${token.symbol}`, e);
                          e.target.src = DEFAULT_CRYPTO_ICON; 
                        }}
                      />
                      <div>
                        <div className="font-medium">{token.symbol}</div>
                        <div className="text-xs text-gray-400">{token.name}</div>
                      </div>
                    </button>
                  </li>
                ))}
                {!isSearching && filteredTokens.length === 0 && (
                  <li className="px-4 py-2 text-gray-400">
                    {search && search.length >= 2 
                      ? 'No tokens found. Try a different search.' 
                      : 'Type at least 2 characters to search'}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenSelector; 