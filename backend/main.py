from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import asyncpg
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import logging
import json
import locale

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Common token IDs for CoinMarketCap
COINMARKETCAP_IDS = {
    "BTC": 1,
    "ETH": 1027,
    "USDT": 825,
    "BNB": 1839,
    "SOL": 5426,
    "XRP": 52,
    "USDC": 3408,
    "ADA": 2010,
    "AVAX": 5805,
    "DOGE": 74,
    "DOT": 6636,
    "SHIB": 5994,
    "TRX": 1958,
    "LINK": 1975,
    "MATIC": 3890,
    "LTC": 2,
    "TON": 11419
}

def get_default_logo(symbol):
    """Generate a default logo URL based on token symbol"""
    # Use CoinMarketCap IDs for common tokens
    if symbol in COINMARKETCAP_IDS:
        return f"https://s2.coinmarketcap.com/static/img/coins/64x64/{COINMARKETCAP_IDS[symbol]}.png"
    
    # Generate a hash number from the token symbol for other tokens (deterministic)
    # This ensures the same token always gets the same logo
    hash_value = sum(ord(c) for c in symbol) % 10000
    return f"https://s2.coinmarketcap.com/static/img/coins/64x64/{hash_value}.png"

# Load environment variables
load_dotenv()

# Get Token Metrics API key
TOKEN_METRICS_API_KEY = os.getenv("TOKEN_METRICS_API_KEY")
if not TOKEN_METRICS_API_KEY:
    logger.warning("TOKEN_METRICS_API_KEY not found in environment variables")

# Database connection details from environment variables
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not all([DB_HOST, DB_NAME, DB_USER, DB_PASSWORD]):
    logger.warning("Database credentials not fully configured in environment variables")

logger.info("Starting up the application")

app = FastAPI(title="Crypto Converter API")

# Configure CORS for development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176", 
        "http://localhost:5177",  # Current frontend port
        "http://localhost:4173",  # Vite preview
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176", 
        "http://127.0.0.1:5177",
        "http://127.0.0.1:4173",
        "https://crypto-converter-frontend-a3ca.onrender.com",  # Your frontend URL
        "https://crypto-converter-frontend-a3ca.onrender.com:443",  # With explicit port
        "https://crypto-converter-frontend-a3ca.onrender.com/*",    # Wildcard for all paths
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["Content-Type", "Content-Length"]
)

# Models
class ConversionRequest(BaseModel):
    from_currency: str
    to_currency: str
    amount: float

class SupportedToken(BaseModel):
    symbol: str
    name: str
    token_id: Optional[int] = None
    logo: Optional[str] = None
    price_usd: Optional[float] = None

# Fiat currencies we support
FIATS = {
    "USD": "US Dollar",
    "EUR": "Euro",
    "GBP": "British Pound",
    "JPY": "Japanese Yen",
    "CAD": "Canadian Dollar",
    "AUD": "Australian Dollar",
    "CNY": "Chinese Yuan",
    "INR": "Indian Rupee",
    "BRL": "Brazilian Real",
    "CHF": "Swiss Franc",
    "VND": "Vietnamese Dong",
    "NGN": "Nigerian Naira"
}

# Fiat exchange rates relative to USD (1 USD = X units of currency)
FIAT_EXCHANGE_RATES = {
    "USD": 1.0,
    "EUR": 0.93,    # 1 USD = 0.93 EUR
    "GBP": 0.80,    # 1 USD = 0.80 GBP
    "JPY": 156.78,  # 1 USD = 156.78 JPY
    "CAD": 1.37,    # 1 USD = 1.37 CAD
    "AUD": 1.52,    # 1 USD = 1.52 AUD
    "CNY": 7.24,    # 1 USD = 7.24 CNY
    "INR": 83.37,   # 1 USD = 83.37 INR
    "BRL": 5.07,    # 1 USD = 5.07 BRL
    "CHF": 0.91,    # 1 USD = 0.91 CHF
    "VND": 24900,   # 1 USD = 24,900 VND
    "NGN": 1412.76  # 1 USD = 1,412.76 NGN
}

# ISO country codes for flag images
COUNTRY_CODES = {
    "USD": "us",
    "EUR": "eu",
    "GBP": "gb",
    "JPY": "jp",
    "CAD": "ca",
    "AUD": "au",
    "CNY": "cn",
    "INR": "in",
    "BRL": "br",
    "CHF": "ch",
    "VND": "vn",
    "NGN": "ng"
}

def get_fiat_logo(currency_code):
    """Get logo URL for fiat currency using country flag"""
    if currency_code in COUNTRY_CODES:
        country_code = COUNTRY_CODES[currency_code].lower()
        # Using flagcdn.com for reliable flag images
        return f"https://flagcdn.com/w80/{country_code}.png"
    return None

# Configure number formatting for better human readability
try:
    # Try to set the preferred locale
    locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
except locale.Error:
    try:
        # Try a more generic locale
        locale.setlocale(locale.LC_ALL, 'en_US')
    except locale.Error:
        try:
            # Try with just the language code
            locale.setlocale(locale.LC_ALL, 'en')
        except locale.Error:
            # If all else fails, use the default locale
            locale.setlocale(locale.LC_ALL, '')
            logger.warning("Could not set specific locale, using system default")

def format_number(number, decimal_places=2):
    """Format number with thousand separators and fixed decimal places"""
    try:
        # For very small numbers, use more decimal places
        original_number = float(number)
        
        # Use scientific notation for extremely small numbers
        if 0 < original_number < 0.0000001:
            return f"{original_number:.6e}"
            
        # Use adaptive decimal places based on number size
        if original_number < 0.00001:
            decimal_places = 10
        elif original_number < 0.0001:
            decimal_places = 8
        elif original_number < 0.001:
            decimal_places = 6
        elif original_number < 0.1:
            decimal_places = 4
            
        # Round to specified decimal places
        rounded = round(original_number, decimal_places)
        
        # Format with thousand separators - simplified implementation
        integer_part, *decimal_parts = f"{rounded:.{decimal_places}f}".split('.')
        decimal_part = decimal_parts[0] if decimal_parts else ''
        
        # Add thousand separators to integer part
        formatted_integer = ""
        for i, digit in enumerate(reversed(integer_part)):
            if i > 0 and i % 3 == 0:
                formatted_integer = ',' + formatted_integer
            formatted_integer = digit + formatted_integer
            
        # Add negative sign if needed
        if rounded < 0 and not formatted_integer.startswith('-'):
            formatted_integer = '-' + formatted_integer
            
        # Combine parts
        formatted = formatted_integer
        if decimal_places > 0:
            formatted += f".{decimal_part}"
            
        # If the number is a whole number ending in .00, remove the decimal part
        if decimal_places > 0 and formatted.endswith('.' + '0' * decimal_places):
            formatted = formatted[:-decimal_places-1]
            
        # Ensure we never return "0" for small positive values
        if original_number > 0 and formatted == "0":
            return f"{original_number:.6e}"
            
        return formatted
    except (ValueError, TypeError):
        # In case of any error, return the original number as string
        return str(number)

@app.get("/")
async def root():
    return {"message": "Crypto Converter API is running"}

@app.get("/tokens", response_model=List[SupportedToken])
async def get_supported_tokens(limit: int = 15):
    """Get list of supported tokens for conversion"""
    try:
        # Return top tokens by market cap by default, with a smaller default limit
        return await get_top_tokens(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching supported tokens: {str(e)}")

@app.get("/fiats", response_model=List[SupportedToken])
async def get_supported_fiats():
    """Get list of supported fiat currencies"""
    return [
        SupportedToken(
            symbol=symbol, 
            name=name, 
            logo=get_fiat_logo(symbol)
        )
        for symbol, name in FIATS.items()
    ]

@app.post("/convert")
async def convert_currency(request: ConversionRequest):
    """Convert between cryptocurrencies and fiat currencies"""
    try:
        from_currency = request.from_currency.upper()
        to_currency = request.to_currency.upper()
        amount = request.amount
        
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than zero")
        
        # Handle fiat-to-fiat conversion using exchange rates
        if from_currency in FIATS and to_currency in FIATS:
            if from_currency not in FIAT_EXCHANGE_RATES or to_currency not in FIAT_EXCHANGE_RATES:
                raise HTTPException(status_code=400, detail=f"Exchange rate not available for {from_currency} or {to_currency}")
                
            # Calculate using exchange rates relative to USD
            # Example: 1 EUR to JPY = (1 / 0.93) * 156.78 = 168.58 JPY
            from_rate = FIAT_EXCHANGE_RATES[from_currency]  # 1 USD = X from_currency
            to_rate = FIAT_EXCHANGE_RATES[to_currency]      # 1 USD = Y to_currency
            
            # Convert to USD first, then to target currency
            usd_amount = amount / from_rate
            converted_amount = usd_amount * to_rate
            rate = converted_amount / amount
            
            # Format values for display
            formatted_converted = format_number(converted_amount)
            formatted_rate = format_number(rate)
            formatted_amount = format_number(amount)
            
            return {
                "from": from_currency,
                "to": to_currency,
                "from_name": FIATS.get(from_currency, from_currency),
                "to_name": FIATS.get(to_currency, to_currency),
                "from_logo": get_fiat_logo(from_currency),
                "to_logo": get_fiat_logo(to_currency),
                "amount": amount,
                "amount_formatted": formatted_amount,
                "converted_amount": converted_amount,
                "converted_amount_formatted": formatted_converted,
                "rate": rate,
                "rate_formatted": formatted_rate
            }
        
        # Get prices from database
        async with app.state.db_pool.acquire() as conn:
            from_price = None
            to_price = None
            from_logo = None
            to_logo = None
            from_name = from_currency
            to_name = to_currency
            
            # If from_currency is crypto, get its USD price and logo
            if from_currency not in FIATS:
                query = """
                SELECT 
                    "CURRENT_PRICE",
                    "IMAGES",
                    "TOKEN_NAME"
                FROM analytics.crypto_info_hub_current_view 
                WHERE "TOKEN_SYMBOL" = $1
                ORDER BY "MARKET_CAP" DESC NULLS LAST
                LIMIT 1
                """
                from_row = await conn.fetchrow(query, from_currency)
                if from_row:
                    from_price = from_row["CURRENT_PRICE"] if from_row["CURRENT_PRICE"] else 0
                    from_name = from_row["TOKEN_NAME"] if from_row["TOKEN_NAME"] else from_currency
                    
                    # Get default logo
                    from_logo = get_default_logo(from_currency)
                    
                    # Try to get logo from database
                    db_logo = extract_image_from_db(from_row["IMAGES"])
                    if db_logo:
                        from_logo = db_logo
            else:
                # For fiat currencies
                from_price = 1.0
                from_name = FIATS.get(from_currency, from_currency)
                from_logo = get_fiat_logo(from_currency)
            
            # If to_currency is crypto, get its USD price and logo
            if to_currency not in FIATS:
                query = """
                SELECT 
                    "CURRENT_PRICE",
                    "IMAGES",
                    "TOKEN_NAME"
                FROM analytics.crypto_info_hub_current_view 
                WHERE "TOKEN_SYMBOL" = $1
                ORDER BY "MARKET_CAP" DESC NULLS LAST
                LIMIT 1
                """
                to_row = await conn.fetchrow(query, to_currency)
                if to_row:
                    to_price = to_row["CURRENT_PRICE"] if to_row["CURRENT_PRICE"] else 0
                    to_name = to_row["TOKEN_NAME"] if to_row["TOKEN_NAME"] else to_currency
                    
                    # Get default logo
                    to_logo = get_default_logo(to_currency)
                    
                    # Try to get logo from database
                    db_logo = extract_image_from_db(to_row["IMAGES"])
                    if db_logo:
                        to_logo = db_logo
            else:
                # For fiat currencies
                to_price = 1.0
                to_name = FIATS.get(to_currency, to_currency)
                to_logo = get_fiat_logo(to_currency)
            
            # Calculate conversion rate
            if from_price is not None and to_price is not None:
                if from_currency not in FIATS and to_currency not in FIATS:
                    # Both are crypto
                    rate = from_price / to_price
                else:
                    # One is fiat
                    if from_currency in FIATS:
                        # Fiat to crypto: 1/price adjusted for exchange rate
                        # Example: 100 EUR to BTC
                        # 1. Convert EUR to USD: 100 EUR = 107.53 USD (100 / 0.93)
                        # 2. Convert USD to BTC: 107.53 USD = 0.00129 BTC (107.53 / 83000)
                        from_rate = FIAT_EXCHANGE_RATES.get(from_currency, 1.0)
                        usd_amount = amount / from_rate  # Convert to USD first
                        rate = usd_amount * (1 / to_price) / amount  # Then to crypto
                    else:
                        # Crypto to fiat: price adjusted for exchange rate
                        # Example: 1 BTC to EUR
                        # 1. Convert BTC to USD: 1 BTC = 83000 USD
                        # 2. Convert USD to EUR: 83000 USD = 77,190 EUR (83000 * 0.93)
                        to_rate = FIAT_EXCHANGE_RATES.get(to_currency, 1.0)
                        rate = from_price * to_rate  # USD value * exchange rate
                
                converted_amount = amount * rate
                
                # Format values for display
                formatted_converted = format_number(converted_amount)
                formatted_rate = format_number(rate)
                formatted_amount = format_number(amount)
                
                return {
                    "from": from_currency,
                    "to": to_currency,
                    "from_name": from_name,
                    "to_name": to_name,
                    "from_logo": from_logo,
                    "to_logo": to_logo,
                    "amount": amount,
                    "amount_formatted": formatted_amount,
                    "converted_amount": converted_amount,
                    "converted_amount_formatted": formatted_converted,
                    "rate": rate,
                    "rate_formatted": formatted_rate
                }
            else:
                raise HTTPException(status_code=404, detail="Could not determine prices for one or both currencies")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during conversion: {str(e)}")

@app.get("/prices/refresh")
async def refresh_prices():
    """Force refresh prices (now a no-op since we use Supabase)"""
    return {"message": "Using live prices from database, no refresh needed"}

@app.on_event("startup")
async def startup_event():
    """Initialize data on startup"""
    logger.info("Starting up - initializing database connection pool...")
    try:
        # Create a database connection pool
        app.state.db_pool = await asyncpg.create_pool(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            min_size=2,
            max_size=10
        )
        logger.info("Database connection pool created successfully!")
    except Exception as e:
        logger.error(f"Error creating database pool: {str(e)}", exc_info=True)
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    # Close the database connection pool
    await app.state.db_pool.close()

@app.get("/tokens/search")
async def search_tokens(query: str):
    """Search for tokens by name or symbol using direct database connection"""
    if not query or len(query) < 1:
        return []  # Don't search for very short queries
        
    try:
        # First check against our pre-defined list of tokens
        predefined_results = []
        query_lower = query.lower()
        
        # Check in our common tokens first
        for symbol, token_id in COINMARKETCAP_IDS.items():
            if query_lower in symbol.lower():
                # This is a common token, add it to results
                logo = f"https://s2.coinmarketcap.com/static/img/coins/64x64/{token_id}.png"
                predefined_results.append(
                    SupportedToken(
                        symbol=symbol,
                        name=symbol,  # We don't have the name for predefined tokens
                        token_id=token_id,
                        logo=logo,
                        price_usd=0  # We'll need to get the price from DB later
                    )
                )
                
        # Also check in fiats list
        for symbol, name in FIATS.items():
            if query_lower in symbol.lower() or query_lower in name.lower():
                predefined_results.append(
                    SupportedToken(
                        symbol=symbol,
                        name=name,
                        logo=get_fiat_logo(symbol),
                        price_usd=1.0 if symbol == 'USD' else FIAT_EXCHANGE_RATES.get(symbol, 1.0)
                    )
                )
                
        # Now query the database for more matches
        async with app.state.db_pool.acquire() as conn:
            # SQL query for search
            sql_query = """
            SELECT 
                "TOKEN_ID", 
                "TOKEN_NAME", 
                "TOKEN_SYMBOL", 
                "CURRENT_PRICE", 
                "IMAGES"
            FROM 
                analytics.crypto_info_hub_current_view 
            WHERE 
                LOWER("TOKEN_SYMBOL") LIKE LOWER($1) OR 
                LOWER("TOKEN_NAME") LIKE LOWER($1)
            ORDER BY 
                CASE 
                    WHEN LOWER("TOKEN_SYMBOL") = LOWER($2) THEN 1
                    WHEN LOWER("TOKEN_SYMBOL") LIKE LOWER($2 || '%') THEN 2
                    WHEN LOWER("TOKEN_NAME") = LOWER($2) THEN 3
                    WHEN LOWER("TOKEN_NAME") LIKE LOWER($2 || '%') THEN 4
                    ELSE 5
                END,
                "MARKET_CAP" DESC NULLS LAST
            LIMIT 20
            """
            
            # Execute query with timeout
            search_pattern = f'%{query}%'
            try:
                rows = await asyncio.wait_for(
                    conn.fetch(sql_query, search_pattern, query),
                    timeout=3.0  # Reduce timeout to 3 seconds for faster response
                )
            except asyncio.TimeoutError:
                logger.warning(f"Search query timed out for: {query}")
                # Return predefined results if we have any
                if predefined_results:
                    return predefined_results
                raise HTTPException(status_code=504, detail="Database query timed out")
            
            # Process DB results
            db_results = []
            seen_symbols = set(item.symbol for item in predefined_results)
            
            for row in rows:
                symbol = row["TOKEN_SYMBOL"]
                
                # Skip if we already have this symbol from predefined list
                if symbol in seen_symbols:
                    continue
                    
                seen_symbols.add(symbol)
                
                # Get default logo
                default_logo = get_default_logo(symbol)
                
                # Extract logo from database
                db_logo = extract_image_from_db(row["IMAGES"])
                
                # Use database logo if available, otherwise default
                logo = db_logo if db_logo else default_logo
                
                token_obj = SupportedToken(
                    symbol=symbol,
                    name=row["TOKEN_NAME"],
                    token_id=row["TOKEN_ID"],
                    logo=logo,
                    price_usd=row["CURRENT_PRICE"] if row["CURRENT_PRICE"] else 0
                )
                db_results.append(token_obj)
            
            # Update prices for predefined results if we have them in the DB
            for predef_token in predefined_results:
                for db_token in db_results:
                    if predef_token.symbol == db_token.symbol:
                        predef_token.price_usd = db_token.price_usd
                        break
            
            # Combine results, with predefined results first
            combined_results = predefined_results + [
                t for t in db_results if t.symbol not in set(pt.symbol for pt in predefined_results)
            ]
            
            return combined_results
            
    except asyncio.TimeoutError:
        # If we got here, we already tried returning predefined results
        raise HTTPException(status_code=504, detail="Database query timed out")
    except Exception as e:
        logger.error(f"Error in search_tokens: {str(e)}", exc_info=True)
        # Fall back to predefined results if possible
        if predefined_results:
            return predefined_results
        raise HTTPException(status_code=500, detail=f"Error searching tokens: {str(e)}")

@app.get("/tokens/top", response_model=List[SupportedToken])
async def get_top_tokens(limit: int = 50):
    """Get top tokens by market cap"""
    try:
        async with app.state.db_pool.acquire() as conn:
            # Query to get top tokens by market cap
            query = """
            SELECT 
                "TOKEN_ID", 
                "TOKEN_NAME", 
                "TOKEN_SYMBOL", 
                "CURRENT_PRICE", 
                "MARKET_CAP",
                "IMAGES"
            FROM 
                analytics.crypto_info_hub_current_view
            WHERE 
                "MARKET_CAP" IS NOT NULL AND
                "MARKET_CAP" > 0 AND
                "CURRENT_PRICE" IS NOT NULL
            ORDER BY 
                "MARKET_CAP" DESC
            LIMIT $1
            """
            
            rows = await conn.fetch(query, limit)
            logger.info(f"Fetched {len(rows)} tokens from database")
            
            result = []
            for row in rows:
                # Get the default logo
                symbol = row["TOKEN_SYMBOL"]
                default_logo = get_default_logo(symbol)
                
                # Extract logo from database IMAGES
                db_logo = extract_image_from_db(row["IMAGES"])
                
                # Use database logo if available, otherwise use default
                logo = db_logo if db_logo else default_logo
                logger.info(f"Logo for {symbol}: {logo} (default: {default_logo}, db: {db_logo})")
                
                token_obj = SupportedToken(
                    symbol=symbol,
                    name=row["TOKEN_NAME"],
                    token_id=row["TOKEN_ID"],
                    logo=logo,
                    price_usd=row["CURRENT_PRICE"] if row["CURRENT_PRICE"] else 0
                )
                result.append(token_obj)
            
            return result
    except Exception as e:
        logger.error(f"Error in get_top_tokens: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching top tokens: {str(e)}")

@app.get("/test_images")
async def test_images():
    """Test endpoint to debug IMAGES column"""
    try:
        async with app.state.db_pool.acquire() as conn:
            query = """
            SELECT 
                "TOKEN_ID", 
                "TOKEN_NAME", 
                "TOKEN_SYMBOL", 
                "IMAGES"
            FROM 
                analytics.crypto_info_hub_current_view
            WHERE 
                "TOKEN_SYMBOL" IN ('BTC', 'ETH', 'USDT')
            LIMIT 3
            """
            
            rows = await conn.fetch(query)
            
            result = []
            for row in rows:
                symbol = row["TOKEN_SYMBOL"]
                images_raw = row["IMAGES"]
                
                # Check type of IMAGES
                images_type = type(images_raw).__name__
                
                # Try to extract thumb
                thumb = None
                if images_raw and isinstance(images_raw, dict) and "thumb" in images_raw:
                    thumb = images_raw["thumb"]
                
                # Create response
                item = {
                    "symbol": symbol,
                    "images_type": images_type,
                    "has_images": images_raw is not None,
                    "thumb": thumb,
                    "raw_images": str(images_raw)
                }
                result.append(item)
            
            return result
    except Exception as e:
        logger.error(f"Error in test_images: {str(e)}", exc_info=True)
        return {"error": str(e)}

def extract_image_from_db(images_data):
    """Extract image URL from database IMAGES field"""
    if not images_data:
        return None
        
    # If images_data is a string, try to parse it as JSON
    if isinstance(images_data, str):
        try:
            images_data = json.loads(images_data)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse IMAGES JSON: {e}")
            return None
            
    # Now extract the image URL
    if isinstance(images_data, dict):
        if "small" in images_data:
            return images_data["small"]
        elif "thumb" in images_data:
            return images_data["thumb"]
        elif "large" in images_data:
            return images_data["large"]
    
    return None

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 