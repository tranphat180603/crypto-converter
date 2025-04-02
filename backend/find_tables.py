import asyncio
import asyncpg

async def find_tables():
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
        # Find tables with 'rating' in their name
        tables = await conn.fetch("""
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name ILIKE '%rating%' 
            ORDER BY table_schema, table_name
        """)
        
        if tables:
            print(f"Found {len(tables)} tables with 'rating' in the name:")
            for table in tables:
                schema = table['table_schema']
                name = table['table_name']
                print(f"  {schema}.{name}")
        else:
            print("No tables found with 'rating' in the name")
            
        # Also look for materialized views
        print("\nLooking for materialized views with 'rating' in the name:")
        # PostgreSQL stores materialized views in pg_matviews
        mv_query = """
            SELECT schemaname, matviewname 
            FROM pg_matviews 
            WHERE matviewname ILIKE '%rating%'
            ORDER BY schemaname, matviewname
        """
        
        try:
            materialized_views = await conn.fetch(mv_query)
            if materialized_views:
                print(f"Found {len(materialized_views)} materialized views with 'rating' in the name:")
                for mv in materialized_views:
                    schema = mv['schemaname']
                    name = mv['matviewname']
                    print(f"  {schema}.{name}")
            else:
                print("No materialized views found with 'rating' in the name")
        except Exception as e:
            print(f"Error querying materialized views: {str(e)}")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(find_tables()) 