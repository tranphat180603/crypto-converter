import asyncio
import asyncpg
from pprint import pprint

async def describe_materialized_view():
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
        # Get column information for the materialized view
        column_info = await conn.fetch("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'analytics' AND table_name = 'mv_rating_page'
            ORDER BY ordinal_position
        """)
        
        print(f"Found {len(column_info)} columns in analytics.mv_rating_page:")
        for col in column_info:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            print(f"  {col['column_name']} - {col['data_type']} {nullable}")
        
        # Get a sample of data
        print("\nSample data (5 rows):")
        sample_data = await conn.fetch("""
            SELECT * FROM analytics.mv_rating_page
            LIMIT 5
        """)
        
        for i, row in enumerate(sample_data):
            print(f"\nRow {i+1}:")
            # Convert row to dict for better printing
            row_dict = {k: v for k, v in row.items()}
            # Print without the RecordType formatting
            pprint(row_dict, width=100, sort_dicts=False)
        
        # Get count of rows
        count = await conn.fetchval("""
            SELECT COUNT(*) FROM analytics.mv_rating_page
        """)
        print(f"\nTotal rows in the materialized view: {count:,}")
        
        # Get information about when it was last refreshed
        try:
            last_refresh = await conn.fetchval("""
                SELECT pg_last_refresh_time('analytics.mv_rating_page')
            """)
            print(f"Last refreshed: {last_refresh}")
        except Exception as e:
            print(f"Could not get last refresh time: {str(e)}")
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(describe_materialized_view()) 