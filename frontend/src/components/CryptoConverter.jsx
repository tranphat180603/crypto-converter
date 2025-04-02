import { useState, useEffect, useRef } from 'react';
import TokenSelector from './TokenSelector';
import tokenService from '../api/tokenService';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';

const CryptoConverter = () => {
  const [tokens, setTokens] = useState([]);
  const [fiats, setFiats] = useState([]);
  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);
  const [fromAmount, setFromAmount] = useState('1.00');
  const [toAmount, setToAmount] = useState('0.00');
  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [showToTokenDropdown, setShowToTokenDropdown] = useState(false);
  const [showFromTokenDropdown, setShowFromTokenDropdown] = useState(false);
  const [displayedResult, setDisplayedResult] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [toSearchQuery, setToSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const fromDropdownRef = useRef(null);
  const toDropdownRef = useRef(null);
  
  // New animation states
  const [showParticles, setShowParticles] = useState(false);
  const [showNumberMorphing, setShowNumberMorphing] = useState(false);
  const [showGlowPulse, setShowGlowPulse] = useState(false);
  const particlesContainerRef = useRef(null);
  const resultRef = useRef(null);
  const particlesRef = useRef(null);
  
  // Add a new ref for the "To" box
  const toBoxRef = useRef(null);
  
  // Add a new state variable to track the last time the convert button was clicked
  const [lastClickTime, setLastClickTime] = useState(0);
  
  // Particles initialization
  const particlesInit = async (engine) => {
    await loadFull(engine);
  };

  // Load tokens and fiats on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setInitialLoading(true);
        // Get actual data from backend API
        const tokensData = await tokenService.getTokens();
        const fiatsData = await tokenService.getFiats();
        
        // Include basic information about token count
        console.log(`Loaded ${tokensData.length} tokens and ${fiatsData.length} fiats`);
        
        // Filter out tokens with no price or extremely low prices to avoid showing
        // thousands of low-quality tokens in the UI
        const validTokens = tokensData.filter(token => token.price_usd && token.price_usd > 0.000001);
        
        setTokens(validTokens);
        setFiats(fiatsData);
        
        // Set default tokens
        if (validTokens.length > 0) {
          const btcToken = validTokens.find(t => t.symbol.toUpperCase() === 'BTC');
          setFromToken(btcToken || validTokens[0]);
          
          if (validTokens.length > 1) {
            const ethToken = validTokens.find(t => t.symbol.toUpperCase() === 'ETH');
            setToToken(ethToken || (validTokens[1].symbol !== btcToken?.symbol ? validTokens[1] : validTokens[2] || validTokens[0]));
          }
        }
      } catch (err) {
        setError('Failed to load currencies');
        console.error(err);
        
        // Fallback to mock data if API fails
        const mockTokens = tokenService.getMockTokens();
        const mockFiats = tokenService.getMockFiats();
        setTokens(mockTokens);
        setFiats(mockFiats);
        setFromToken(mockTokens[0]);
        setToToken(mockTokens[1]);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle outside clicks to close dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (fromDropdownRef.current && !fromDropdownRef.current.contains(event.target)) {
        setShowFromTokenDropdown(false);
      }
      
      if (toDropdownRef.current && !toDropdownRef.current.contains(event.target)) {
        setShowToTokenDropdown(false);
      }
    }
    
    // Only add the listeners if either dropdown is open
    if (showFromTokenDropdown || showToTokenDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFromTokenDropdown, showToTokenDropdown]);

  // Reset values when tokens change
  useEffect(() => {
    // Only reset if we're not in initial loading and tokens are defined
    if (!initialLoading && fromToken && toToken) {
      setFromAmount('1.00');
      setToAmount('0.00');
      setRate(null);
    }
  }, [fromToken, toToken, initialLoading]);

  // Type writer effect for result
  useEffect(() => {
    if (isAnimating && toAmount) {
      setDisplayedResult('');
      let i = 0;
      const resultStr = toAmount.toString();
      
      // Adjust animation speed based on string length
      const typingSpeed = Math.max(10, Math.min(40, 50 - resultStr.length)); // Faster for longer strings
      
      const typingInterval = setInterval(() => {
        if (i < resultStr.length) {
          // Update the displayed result all at once up to the current position
          setDisplayedResult(resultStr.substring(0, i + 1));
          i++;
        } else {
          clearInterval(typingInterval);
          setIsAnimating(false);
        }
      }, typingSpeed); // Dynamic speed of typing
      
      // Add a safety timeout to ensure animation completes even if something goes wrong
      const safetyTimeout = setTimeout(() => {
        setIsAnimating(false);
        setDisplayedResult(toAmount);
      }, resultStr.length * typingSpeed + 500); // Add 500ms buffer
      
      return () => {
        clearInterval(typingInterval);
        clearTimeout(safetyTimeout);
      };
    }
  }, [isAnimating, toAmount]);

  // Helper function to format numbers consistently
  const formatNumberWithCommas = (num) => {
    // Parse the input regardless of whether it's a string or number
    let number;
    
    // If it's a string with commas, first remove them before parsing
    if (typeof num === 'string' && num.includes(',')) {
      // Remove all commas and parse
      number = parseFloat(num.replace(/,/g, ''));
    } else {
      // Otherwise parse as normal
      number = typeof num === 'string' ? parseFloat(num) : num;
    }
    
    // If parsing failed or resulted in NaN, return the original
    if (isNaN(number)) {
      return num;
    }
    
    // Handle small numbers with appropriate decimal places
    let decimalPlaces = 2;
    if (number < 0.00000001) decimalPlaces = 12;
    else if (number < 0.0000001) decimalPlaces = 10;
    else if (number < 0.000001) decimalPlaces = 9;
    else if (number < 0.00001) decimalPlaces = 8;
    else if (number < 0.0001) decimalPlaces = 6;
    else if (number < 0.001) decimalPlaces = 5;
    
    // For very small numbers, use scientific notation
    if (number > 0 && number < 0.000000001) {
      return number.toExponential(6);
    }
    
    // Use Intl.NumberFormat for consistent comma formatting
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: decimalPlaces,
      minimumFractionDigits: number < 0.001 ? decimalPlaces : 0
    }).format(number);
  };

  // Convert currency when inputs change
  useEffect(() => {
    const convert = async () => {
      if (!fromToken || !toToken || !fromAmount || initialLoading) {
        setToAmount('0.00');
        return;
      }

      try {
        setLoading(true);
        setError('');
        
        // Use the API for conversion
        const result = await tokenService.convertCurrency(
          fromToken.symbol,
          toToken.symbol,
          parseFloat(fromAmount)
        );
        
        if (result) {
          // Use the pre-formatted value from the server
          // Ensure we don't display "0" for very small positive values
          let formattedResult;
          if (result.converted_amount > 0 && result.converted_amount_formatted === "0") {
            formattedResult = result.converted_amount.toExponential(6);
          } else {
            formattedResult = result.converted_amount_formatted || result.converted_amount.toString();
          }
          
          // Ensure proper formatting with commas
          formattedResult = formatNumberWithCommas(formattedResult);
          
          setToAmount(formattedResult);
          
          // For automatic conversions, just update the displayed result without animation
          // to prevent animation loops
          setDisplayedResult(formattedResult);
          
          setRate({
            value: result.rate,
            rate_formatted: result.rate_formatted
          });
        } else {
          setError('Failed to get conversion rate');
          setToAmount('0.00');
          setDisplayedResult('0.00');
        }
      } catch (err) {
        setError('Failed to convert: ' + (err.message || 'Unknown error'));
        console.error(err);
        setToAmount('0.00');
        setDisplayedResult('0.00');
      } finally {
        setLoading(false);
      }
    };

    convert();
  }, [fromToken, toToken, fromAmount, initialLoading]);

  // Handle token selections
  const handleFromTokenChange = (token) => {
    if (token.symbol !== fromToken?.symbol) {
      setFromToken(token);
      // Reset is handled by the useEffect above
    }
  };

  const handleToTokenChange = (token) => {
    console.log("Selecting token:", token.symbol); // Debug logging
    if (token.symbol !== toToken?.symbol) {
      setToToken(token);
      // Reset is handled by the useEffect above
    }
    setShowToTokenDropdown(false);
  };

  // Handle conversion button click with animation
  const handleConvert = async () => {
    // Check if we're within the 1 second cooldown period
    const now = Date.now();
    if (now - lastClickTime < 1000) {
      // If less than 1 second has passed, do nothing
      return;
    }
    
    // Update the last click time
    setLastClickTime(now);
    
    // Proceed with the normal conversion process
    if (!fromToken || !toToken || !fromAmount || loading || initialLoading) return;
    
    try {
      setLoading(true);
      setError('');
      
      // Trigger particle animation from "From" to "To"
      setShowParticles(true);
      
      const result = await tokenService.convertCurrency(
        fromToken.symbol,
        toToken.symbol,
        parseFloat(fromAmount)
      );
      
      if (result) {
        // Use the pre-formatted value from the server
        // Ensure we don't display "0" for very small positive values
        let formattedResult;
        if (result.converted_amount > 0 && result.converted_amount_formatted === "0") {
          formattedResult = result.converted_amount.toExponential(6);
        } else {
          formattedResult = result.converted_amount_formatted || result.converted_amount.toString();
        }
        
        // Ensure proper formatting with commas
        formattedResult = formatNumberWithCommas(formattedResult);
        
        setToAmount(formattedResult);
        
        // Always do full typewriter animation for manual conversions
        setDisplayedResult(''); // Clear for animation
        setIsAnimating(true);
        
        // Trigger number morphing animation
        setShowNumberMorphing(true);
        
        // After animations complete, show the glow pulse effect
        setTimeout(() => {
          setShowGlowPulse(true);
          
          // Reset glow pulse after 2 seconds
          setTimeout(() => {
            setShowGlowPulse(false);
          }, 2000);
        }, 1000);
        
        // Reset particles animation after 1.5 seconds
        setTimeout(() => {
          setShowParticles(false);
        }, 1500);
        
        // Reset number morphing after animation completes
        setTimeout(() => {
          setShowNumberMorphing(false);
        }, 1000);
        
        // Ensure loading state is reset even if animation is still running
        setLoading(false);
        
        // Also add a fallback to ensure loading state is reset
        setTimeout(() => {
          setLoading(false);
        }, 3000); // Max 3 seconds
        
        setRate({
          value: result.rate,
          rate_formatted: result.rate_formatted
        });
      } else {
        setError('Failed to get conversion rate');
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to convert: ' + (err.message || 'Unknown error'));
      console.error(err);
      setLoading(false);
    }
  };

  const combineTokensAndFiats = () => {
    // Combine tokens and fiats, avoiding duplicates
    const combined = [...tokens];
    
    // Add fiats if they don't already exist as tokens
    fiats.forEach(fiat => {
      if (!combined.some(item => item.symbol === fiat.symbol)) {
        combined.push(fiat);
      }
    });
    
    return combined;
  };

  // Handle search query changes and search for tokens
  const handleSearchChange = async (query, isFromDropdown = true) => {
    if (isFromDropdown) {
      setSearchQuery(query);
    } else {
      setToSearchQuery(query);
    }
    
    if (!query) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    
    try {
      // First search in the list of already loaded tokens and fiats
      const combined = combineTokensAndFiats();
      const localResults = combined.filter(token => 
        token.symbol.toLowerCase().includes(query.toLowerCase()) || 
        token.name.toLowerCase().includes(query.toLowerCase())
      );
      
      // Then search from the API if query is at least 2 characters
      if (query.length >= 2) {
        const apiResults = await tokenService.searchTokens(query);
        
        // Combine results, removing duplicates
        const allResults = [...localResults];
        
        apiResults.forEach(apiToken => {
          if (!allResults.some(token => token.symbol === apiToken.symbol)) {
            allResults.push(apiToken);
          }
        });
        
        setSearchResults(allResults);
      } else {
        setSearchResults(localResults);
      }
    } catch (err) {
      console.error('Search error:', err);
      // Fall back to local search only
      const combined = combineTokensAndFiats();
      const localResults = combined.filter(token => 
        token.symbol.toLowerCase().includes(query.toLowerCase()) || 
        token.name.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(localResults);
    } finally {
      setSearchLoading(false);
    }
  };

  // Add a new function to calculate particle direction
  const calculateParticleDirection = () => {
    if (!fromDropdownRef.current || !resultRef.current) return { x: 0, y: 1 };
    
    const fromRect = fromDropdownRef.current.getBoundingClientRect();
    const resultRect = resultRef.current.getBoundingClientRect();
    
    const fromCenter = {
      x: fromRect.left + fromRect.width / 2,
      y: fromRect.top + fromRect.height / 2,
    };
    
    const resultCenter = {
      x: resultRect.left + resultRect.width / 2,
      y: resultRect.top + resultRect.height / 2,
    };
    
    // Calculate vector from "From" to "Result"
    const vector = {
      x: resultCenter.x - fromCenter.x,
      y: resultCenter.y - fromCenter.y,
    };
    
    // Normalize the vector
    const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    return {
      x: vector.x / magnitude,
      y: vector.y / magnitude,
    };
  };

  // Update the useEffect to create a more focused particle flow
  useEffect(() => {
    if (showParticles && toBoxRef.current && resultRef.current) {
      // Set a timer to hide particles after animation completes
      const timer = setTimeout(() => {
        setShowParticles(false);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [showParticles]);

  if (initialLoading) {
    return (
      <div className="max-w-xl w-full mx-auto p-4 flex justify-center items-center">
        <p className="text-lg">Loading available currencies...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-8">
        {/* Particles animation container */}
        <div 
          ref={particlesContainerRef} 
          className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
          style={{
            opacity: showParticles ? 1 : 0,
            position: 'absolute',
            top: '55%', // Keep aligned with the To box
            left: 0,
            width: '100%',
            height: '20%', // Reduce height to stop at the Result box
            maxHeight: '150px' // Limit maximum height
          }}
        >
          {showParticles && (
            <Particles
              id="tsparticles"
              init={particlesInit}
              loaded={(container) => {
                particlesRef.current = container;
              }}
              options={{
                fullScreen: false,
                fpsLimit: 120,
                particles: {
                  number: {
                    value: 100, // Increase particle count significantly
                    density: {
                      enable: true,
                      value_area: 100 // Extremely dense particles
                    }
                  },
                  color: {
                    value: "#f6cd00" // Token Metrics yellow color
                  },
                  shape: {
                    type: "circle"
                  },
                  opacity: {
                    value: 0.85, // Full opacity
                    random: false,
                    anim: {
                      enable: false
                    }
                  },
                  size: {
                    value: 2, // Smaller particles
                    random: false,
                    anim: {
                      enable: false
                    }
                  },
                  move: {
                    enable: true,
                    speed: 2, // Faster speed
                    direction: "bottom", // Flow downward to the result box
                    random: false,
                    straight: true, // Strictly straight path
                    outMode: "destroy",
                    attract: {
                      enable: false
                    },
                    gravity: {
                      enable: false
                    },
                    path: {
                      enable: false
                    }
                  },
                  life: {
                    duration: {
                      value: 0.75, // Shorter lifespan
                      sync: true
                    },
                    count: 1
                  }
                },
                emitters: {
                  position: {
                    x: 50,
                    y: 40,
                  },
                  rate: {
                    quantity: 8,
                    delay: 0.5
                  },
                  size: {
                    width: 10,
                    height: 2
                  },
                  direction: "bottom",
                  life: {
                    duration: 0.3,
                    count: 0.5
                  }
                },
                detectRetina: true
              }}
            />
          )}
        </div>
        
        {/* From Currency Selection */}
        <div className="flex flex-col relative" ref={fromDropdownRef}>
          {/* From Label */}
          <div className="flex items-center gap-4 mb-3">
            <div className="label-pill">
              From
            </div>
          </div>
          <div className="solid-button-container">
            <div className="solid-input-field">
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  inputMode="decimal"
                  value={fromAmount}
                  onChange={(e) => {
                    // Allow only numbers and decimal points
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    // Prevent multiple decimal points
                    const decimalCount = (value.match(/\./g) || []).length;
                    if (decimalCount <= 1) {
                      setFromAmount(value);
                    }
                  }}
                  className="w-full bg-transparent text-2xl font-medium focus:outline-none"
                  placeholder="0.00"
                />
                <div className="absolute right-0 flex flex-col items-center">
                  <button 
                    className="stepper-btn up-btn flex items-center justify-center"
                    onClick={() => {
                      const currentValue = parseFloat(fromAmount) || 0;
                      setFromAmount((currentValue + 1).toString());
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                  </button>
                  <button 
                    className="stepper-btn down-btn flex items-center justify-center"
                    onClick={() => {
                      const currentValue = parseFloat(fromAmount) || 0;
                      if (currentValue > 0) {
                        setFromAmount((Math.max(0, currentValue - 1)).toString());
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div 
                className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                onClick={() => setShowFromTokenDropdown(!showFromTokenDropdown)}
              >
                <img 
                  src={fromToken?.logo} 
                  alt={fromToken?.symbol} 
                  className="w-8 h-8 rounded-full object-contain border border-gray-700"
                  onError={(e) => { e.target.src = "https://cryptologos.cc/logos/question-mark.png"; }}
                />
                <span className="font-medium">{fromToken?.symbol}</span>
              </div>
            </div>
          </div>
          
          {/* Dropdown for From Currency */}
          {showFromTokenDropdown && (
            <div className="token-dropdown solid-button-container mt-2">
              <div className="dropdown-inner">
                <div className="p-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value, true)}
                    placeholder="Search tokens..."
                    className="w-full p-2 bg-gray-900 text-white rounded-md focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {searchLoading && (
                    <div className="p-3 text-center text-gray-400">
                      Searching...
                    </div>
                  )}
                  
                  {!searchLoading && searchQuery && searchResults.length === 0 && (
                    <div className="p-3 text-center text-gray-400">
                      No tokens found
                    </div>
                  )}
                  
                  {(searchQuery ? searchResults : combineTokensAndFiats()).map(token => (
                    <div
                      key={token.symbol}
                      className="p-3 hover:bg-gray-800 cursor-pointer flex items-center gap-2"
                      onClick={() => {
                        handleFromTokenChange(token);
                        setShowFromTokenDropdown(false);
                        setSearchQuery('');
                      }}
                    >
                      <img 
                        src={token.logo} 
                        alt={token.symbol} 
                        className="w-8 h-8 rounded-full object-contain border border-gray-700"
                        onError={(e) => { e.target.src = "https://cryptologos.cc/logos/question-mark.png"; }}
                      />
                      <div>
                        <div className="font-medium">{token.symbol}</div>
                        <div className="text-xs text-gray-400">{token.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* To Currency Selection */}
        <div className="flex flex-col relative" ref={toDropdownRef}>
          {/* To Label */}
          <div className="flex items-center gap-4 mb-3">
            <div className="label-pill">
              To
            </div>
          </div>
          <div className="solid-button-container">
            <div 
              className="solid-button flex justify-center"
              onClick={() => setShowToTokenDropdown(!showToTokenDropdown)}
            >
              <div className="flex items-center gap-2">
                <img 
                  src={toToken?.logo} 
                  alt={toToken?.symbol} 
                  className="w-8 h-8 rounded-full object-contain border border-gray-700"
                  onError={(e) => { e.target.src = "https://cryptologos.cc/logos/question-mark.png"; }}
                />
                <span className="font-medium">{toToken?.symbol}</span>
              </div>
            </div>
          </div>
          
          {/* Dropdown for To Currency - Match From dropdown exactly */}
          {showToTokenDropdown && (
            <div className="token-dropdown solid-button-container mt-2">
              <div className="dropdown-inner">
                <div className="p-2">
                  <input
                    type="text"
                    value={toSearchQuery}
                    onChange={(e) => handleSearchChange(e.target.value, false)}
                    placeholder="Search tokens..."
                    className="w-full p-2 bg-gray-900 text-white rounded-md focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {searchLoading && (
                    <div className="p-3 text-center text-gray-400">
                      Searching...
                    </div>
                  )}
                  
                  {!searchLoading && toSearchQuery && searchResults.length === 0 && (
                    <div className="p-3 text-center text-gray-400">
                      No tokens found
                    </div>
                  )}
                  
                  {(toSearchQuery ? searchResults : combineTokensAndFiats()).map(token => (
                    <div
                      key={token.symbol}
                      className="p-3 hover:bg-gray-800 cursor-pointer flex items-center gap-2"
                      onClick={() => {
                        handleToTokenChange(token);
                        setShowToTokenDropdown(false);
                        setToSearchQuery('');
                      }}
                    >
                      <img 
                        src={token.logo} 
                        alt={token.symbol} 
                        className="w-8 h-8 rounded-full object-contain border border-gray-700"
                        onError={(e) => { e.target.src = "https://cryptologos.cc/logos/question-mark.png"; }}
                      />
                      <div>
                        <div className="font-medium">{token.symbol}</div>
                        <div className="text-xs text-gray-400">{token.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Space for transition */}
        <div className="h-8"></div>

        {/* Result Display section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4 mb-2">
            <div className="label-pill">
              Result
            </div>
          </div>
          
          <motion.div 
            className={`solid-button-container ${showGlowPulse ? 'glow-pulse' : ''}`}
            ref={resultRef}
            animate={{
              boxShadow: showGlowPulse 
                ? ['0 0 0 rgba(246, 205, 0, 0)', '0 0 30px rgba(246, 205, 0, 0.8)', '0 0 0 rgba(246, 205, 0, 0)'] 
                : '0 0 0 rgba(246, 205, 0, 0)'
            }}
            transition={{ duration: 2, ease: "easeInOut", times: [0, 0.5, 1] }}
          >
            <div className="solid-button flex justify-between items-center">
              {/* Token symbol on the left */}
              {toToken && (
                <div className="flex items-center gap-2">
                  <img 
                    src={toToken?.logo} 
                    alt={toToken?.symbol} 
                    className="w-8 h-8 rounded-full object-contain border border-gray-700"
                    onError={(e) => { e.target.src = "https://cryptologos.cc/logos/question-mark.png"; }}
                  />
                  <span className="font-medium">{toToken?.symbol}</span>
                </div>
              )}
              
              {/* Result value */}
              <div className="text-3xl font-bold">
                {showNumberMorphing && parseFloat(toAmount) > 0 ? (
                  <CountUp
                    start={0}
                    end={parseFloat(toAmount.replace(/,/g, ''))}
                    duration={1}
                    separator=","
                    decimals={parseFloat(toAmount) < 0.01 ? 8 : 2}
                    decimal="."
                    prefix=""
                    suffix=""
                  />
                ) : (
                  <span>{isAnimating ? displayedResult : toAmount}</span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
        
        {/* Error display */}
        {error && (
          <div className="text-red-500 text-center">{error}</div>
        )}
        
        {/* Convert Button */}
        <button 
          className={`convert-button ${loading ? 'opacity-70' : ''}`} 
          onClick={handleConvert}
          disabled={loading || !fromToken || !toToken}
        >
          {loading ? 'Converting...' : 'Convert Now'}
        </button>
      </div>
      
      {/* CSS Animations */}
      <style jsx>{`
        /* Result container with gradient border */
        .result-container {
          position: relative;
          border-radius: 12px;
          padding: 2px;
          background: linear-gradient(90deg, #FFD700, #FFA500, #FF8C00, #FF7F50, #FFD700);
          background-size: 400% 400%;
          animation: gradient 3s ease infinite;
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
          overflow: hidden;
          opacity: 1;
          transition: opacity 0.5s ease;
          width: 100%;
        }
        
        /* Fade in animation for result container */
        .fade-in {
          animation: fadeIn 0.5s ease forwards;
        }
        
        @keyframes fadeIn {
          0% { opacity: 0.7; transform: scale(0.98); }
          100% { opacity: 1; transform: scale(1); }
        }
        
        /* Black background for result */
        .result-inner {
          background: #000;
          border-radius: 10px;
          padding: 16px;
          position: relative;
          z-index: 2;
          transition: all 0.3s ease;
        }
        
        /* Typing cursor animation */
        .typing-cursor {
          display: inline-block;
          width: 2px;
          animation: blink 0.7s infinite;
          margin-left: 2px;
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        
        /* Improved label style - pill shape */
        .label-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 16px;
          background-color: #000;
          color: white;
          font-size: 14px;
          font-weight: 500;
          border-radius: 50px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
        }
        
        /* Solid button container with subtle glow */
        .solid-button-container {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          padding: 2px;
          background: linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.15);
          width: 100%;
        }
        
        /* Token dropdown styling */
        .token-dropdown {
          position: absolute;
          left: 0;
          right: 0;
          z-index: 20;
        }
        
        .dropdown-inner {
          background-color: #000;
          border-radius: 14px;
          overflow: hidden;
        }
        
        /* Black background for buttons and input fields */
        .solid-button, .solid-input-field {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-radius: 14px;
          background-color: #000;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        /* Input field layout */
        .solid-input-field {
          justify-content: space-between;
        }
        
        /* Hover effects */
        .solid-button:hover, .solid-input-field:hover {
          background-color: #1a1a1a;
        }
        
        .solid-button:active {
          transform: scale(0.98);
        }
        
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        /* Add explicit width to all container elements */
        .solid-button-container, 
        .solid-button, 
        .solid-input-field,
        .convert-button {
          width: 100%;
        }
        
        /* Hide default spinner buttons for number inputs */
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
        
        /* Custom stepper buttons styling */
        .stepper-btn {
          width: 20px;
          height: 16px;
          border: none;
          background: transparent;
          color: rgba(246, 205, 0, 0.7);
          transition: all 0.2s ease;
          cursor: pointer;
          padding: 0;
          opacity: 0.6;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .stepper-btn:hover {
          color: #f6cd00;
          opacity: 1;
          transform: scale(1.1);
        }
        
        .stepper-btn:active {
          transform: scale(0.95);
        }
        
        .up-btn {
          margin-bottom: -2px; /* Adjust spacing between buttons */
        }
        
        .down-btn {
          margin-top: -2px; /* Adjust spacing between buttons */
        }
      `}</style>
    </div>
  );
};

export default CryptoConverter; 