import asyncio
import asyncpg
from tabulate import tabulate
import pandas as pd

async def query_top_cryptocurrencies():
    # Database connection details from main.py
    DB_HOST = "db.qgmdcuovhxolcgrrgsgd.supabase.co"
    DB_PORT = "5432"
    DB_NAME = "tokenmetrics_prod"
    DB_USER = "tm_production"
    DB_PASSWORD = "TokenmetricsProd2025"
    
    # Connect to the database
    conn = await asyncpg.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    
    try:
        # Query top cryptocurrencies by market cap that have TM grades
        # Only get the most relevant columns
        query = """
            SELECT 
                TOKEN_SYMBOL, 
                TOKEN_NAME,
                CURRENT_PRICE,
                MARKET_CAP,
                MARKET_CAP_RANK,
                VOLUME_24H,
                TM_TRADER_GRADE,
                TM_INVESTOR_GRADE,
                PRICE_CHANGE_PERCENTAGE_24H_IN_CURRENCY as PRICE_CHANGE_24H,
                PRICE_CHANGE_PERCENTAGE_7D_IN_CURRENCY as PRICE_CHANGE_7D
            FROM 
                analytics.mv_rating_page
            WHERE 
                MARKET_CAP IS NOT NULL
                AND CURRENT_PRICE > 0
            ORDER BY 
                MARKET_CAP DESC NULLS LAST
            LIMIT 20
        """
        
        results = await conn.fetch(query)
        
        if not results:
            print("No data found matching the criteria")
            return
        
        # Convert to dictionaries for easier handling
        data = [dict(row) for row in results]
        
        # Format values for better display
        for row in data:
            if row['CURRENT_PRICE'] is not None:
                row['CURRENT_PRICE'] = f"${float(row['CURRENT_PRICE']):,.4f}"
            
            if row['MARKET_CAP'] is not None:
                mc = float(row['MARKET_CAP'])
                if mc >= 1_000_000_000:
                    row['MARKET_CAP'] = f"${mc/1_000_000_000:.2f}B"
                else:
                    row['MARKET_CAP'] = f"${mc/1_000_000:.2f}M"
            
            if row['VOLUME_24H'] is not None:
                vol = float(row['VOLUME_24H'])
                if vol >= 1_000_000_000:
                    row['VOLUME_24H'] = f"${vol/1_000_000_000:.2f}B"
                elif vol >= 1_000_000:
                    row['VOLUME_24H'] = f"${vol/1_000_000:.2f}M"
                else:
                    row['VOLUME_24H'] = f"${vol:,.0f}"
                    
            if row['PRICE_CHANGE_24H'] is not None:
                row['PRICE_CHANGE_24H'] = f"{float(row['PRICE_CHANGE_24H']):+.2f}%"
                
            if row['PRICE_CHANGE_7D'] is not None:
                row['PRICE_CHANGE_7D'] = f"{float(row['PRICE_CHANGE_7D']):+.2f}%"
        
        # Create a pandas DataFrame for better display
        df = pd.DataFrame(data)
        
        # Print the table
        print("\nTop 20 Cryptocurrencies by Market Cap:")
        print(tabulate(df, headers='keys', tablefmt='pretty', showindex=False))
        
        # Now let's get tokens with the highest trader grades
        query_high_trader = """
            SELECT 
                TOKEN_SYMBOL, 
                TOKEN_NAME,
                CURRENT_PRICE,
                TM_TRADER_GRADE,
                TM_INVESTOR_GRADE,
                PRICE_CHANGE_PERCENTAGE_24H_IN_CURRENCY as PRICE_CHANGE_24H
            FROM 
                analytics.mv_rating_page
            WHERE 
                TM_TRADER_GRADE IS NOT NULL
                AND CURRENT_PRICE > 0
            ORDER BY 
                TM_TRADER_GRADE DESC NULLS LAST
            LIMIT 10
        """
        
        trader_results = await conn.fetch(query_high_trader)
        trader_data = [dict(row) for row in trader_results]
        
        # Format values
        for row in trader_data:
            if row['CURRENT_PRICE'] is not None:
                row['CURRENT_PRICE'] = f"${float(row['CURRENT_PRICE']):,.4f}"
                
            if row['PRICE_CHANGE_24H'] is not None:
                row['PRICE_CHANGE_24H'] = f"{float(row['PRICE_CHANGE_24H']):+.2f}%"
        
        # Create DataFrame
        trader_df = pd.DataFrame(trader_data)
        
        # Print the table
        print("\nTop 10 Tokens by TM Trader Grade:")
        print(tabulate(trader_df, headers='keys', tablefmt='pretty', showindex=False))
        
    finally:
        await conn.close()

if __name__ == "__main__":
    try:
        # Try to import tabulate and pandas, install if not available
        import importlib.util
        if importlib.util.find_spec("tabulate") is None:
            print("Installing tabulate...")
            import subprocess
            subprocess.check_call(["pip", "install", "tabulate"])
        
        if importlib.util.find_spec("pandas") is None:
            print("Installing pandas...")
            import subprocess
            subprocess.check_call(["pip", "install", "pandas"])
            
        asyncio.run(query_top_cryptocurrencies())
    except ImportError:
        print("Error: Required packages not available. Please install them with:")
        print("pip install tabulate pandas") 