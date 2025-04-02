# Crypto Converter

A lightweight, fast, and accurate cryptocurrency converter with support for thousands of tokens and fiat currencies.

## Features

- Convert between cryptocurrencies and fiat currencies in real-time
- Powered by Token Metrics API for accurate pricing data
- Support for 10,000+ tokens and multiple fiat currencies
- Modern UI with responsive design
- Fast and efficient conversion
- Data caching for improved performance

## Project Structure

- `frontend/` - React frontend application
- `backend/` - Python FastAPI backend
- `backend/data/` - JSON cache storage for token and price data

## Data Storage

The application uses a hybrid approach for data storage:

1. **Development Mode**: Uses JSON files for caching token and price data:
   - `backend/data/tokens.json` - Stores token metadata including IDs, symbols, and logos
   - `backend/data/prices.json` - Stores cached conversion rates between token pairs

2. **Production Mode**: For a production environment, the JSON storage can be replaced with PostgreSQL by modifying the repository implementation.

The caching mechanism:
- Token data is refreshed daily
- Price data is cached for 5 minutes to balance freshness with performance

## Setup and Installation

### Backend Setup

1. Create a Python virtual environment:
```
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install backend dependencies:
```
cd backend
pip install -r requirements.txt
```

3. Create a `.env` file in the root directory with your Token Metrics API key:
```
TOKEN_METRICS_API_KEY=tm-your-token-metrics-api-key
```

4. Start the backend server:
```
cd backend
uvicorn main:app --reload
```

The backend will run on `http://localhost:8000`.

### Frontend Setup

1. Install frontend dependencies:
```
cd frontend
npm install
```

2. Start the development server:
```
npm run dev
```

The frontend will run on `http://localhost:5173`.

## Production Deployment

For production deployment, follow these steps:

1. Build the frontend:
```
cd frontend
npm run build
```

2. Serve the backend with a production ASGI server like uvicorn with gunicorn:
```
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend.main:app
```

## Notes

- For the TMAI.png image, place it in the `public` folder and update the image reference in `App.jsx`.
- To migrate to PostgreSQL for production, implement the same interface as the TokenRepository class with database connections.
- The Token Metrics API requires specific token IDs for fetching prices, which are obtained and cached by the application. 