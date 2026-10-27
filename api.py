import os
import json
import logging
from decimal import Decimal
from datetime import datetime
from typing import Dict, Any, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from exchange import BinanceDemo
from strategy import get_signal

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(
    title="Trading Bot Mobile API",
    description="API for mobile app to view balances, positions, and trading bot status",
    version="1.0.0"
)

# Enable CORS for mobile app (Expo) and browsers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATE_FILE = "state.json"
SYMBOL = os.getenv("SYMBOL", "BTCUSDT")
INTERVAL = os.getenv("INTERVAL", "1h")
QUOTE_ORDER_SIZE = os.getenv("QUOTE_ORDER_SIZE", "20")

_exchange_instance = None

def get_exchange():
    global _exchange_instance
    if _exchange_instance is None:
        _exchange_instance = BinanceDemo()
    return _exchange_instance

def load_state() -> Dict[str, Any]:
    if not os.path.exists(STATE_FILE):
        return {"position_qty": "0", "last_candle": None}
    try:
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        logging.error("Failed to load state: %s", e)
        return {"position_qty": "0", "last_candle": None}

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Trading Bot Mobile API",
        "symbol": SYMBOL,
        "interval": INTERVAL,
        "docs_url": "/docs"
    }

@app.get("/api/overview")
def get_overview():
    """Main endpoint for the mobile app home screen"""
    try:
        exchange = get_exchange()
        
        # 1. Fetch 24hr Ticker & Current Price
        ticker = exchange.ticker_24hr(SYMBOL)
        current_price = Decimal(ticker.get("lastPrice", "0"))
        price_change_percent = Decimal(ticker.get("priceChangePercent", "0"))
        high_24h = Decimal(ticker.get("highPrice", "0"))
        low_24h = Decimal(ticker.get("lowPrice", "0"))

        # 2. Fetch Account Balances
        account = exchange.account()
        balances_list: List[Dict[str, Any]] = []
        total_usdt_value = Decimal("0")

        # Map major prices for estimation
        price_map = {
            "USDT": Decimal("1.0"),
            "BTC": current_price
        }

        for item in account.get("balances", []):
            free = Decimal(item["free"])
            locked = Decimal(item["locked"])
            total = free + locked
            asset = item["asset"]

            if total > 0:
                asset_price = price_map.get(asset, Decimal("0"))
                value_usdt = total * asset_price
                total_usdt_value += value_usdt

                balances_list.append({
                    "asset": asset,
                    "free": f"{free:.8f}".rstrip("0").rstrip(".") if "." in f"{free:.8f}" else str(free),
                    "locked": f"{locked:.8f}".rstrip("0").rstrip(".") if "." in f"{locked:.8f}" else str(locked),
                    "total": f"{total:.8f}".rstrip("0").rstrip(".") if "." in f"{total:.8f}" else str(total),
                    "free_raw": float(free),
                    "locked_raw": float(locked),
                    "total_raw": float(total),
                    "value_usdt": float(value_usdt)
                })

        # Sort balances: USDT first, then BTC, then highest value
        balances_list.sort(key=lambda x: (x["asset"] != "USDT", x["asset"] != "BTC", -x["value_usdt"]))

        # 3. Fetch Strategy Signal & Candles (before positions so signal is available)
        candles = exchange.candles(SYMBOL, INTERVAL, limit=60)
        signal = get_signal(candles)

        last_candle_ts = None
        if len(candles) >= 2:
            last_candle_ts = int(candles[-2][0])
            last_candle_dt = datetime.fromtimestamp(last_candle_ts / 1000).strftime("%Y-%m-%d %H:%M UTC")
        else:
            last_candle_dt = "N/A"

        # 4. Read Bot State & Positions
        state = load_state()
        bot_position_qty = Decimal(state.get("position_qty", "0"))

        usdt_holding = next((b for b in balances_list if b["asset"] == "USDT"), None)
        usdt_free = usdt_holding["free_raw"] if usdt_holding else 0.0

        btc_holding = next((b for b in balances_list if b["asset"] == "BTC"), None)
        btc_free = btc_holding["free_raw"] if btc_holding else 0.0

        positions = [
            {
                "id": "buy_side",
                "side": "BUY",
                "name": "Buy Position / Cash Ready",
                "symbol": SYMBOL,
                "asset": "USDT",
                "targetAsset": "BTC",
                "availableCash": usdt_free,
                "value_usdt": usdt_free,
                "current_price": float(current_price),
                "maxPurchasable": usdt_free / float(current_price) if float(current_price) > 0 else 0,
                "status": "READY TO BUY" if usdt_free >= 20 else "LOW CASH",
                "signal": signal,
                "type": "Buying Power (Quote Asset)"
            },
            {
                "id": "sell_side",
                "side": "SELL",
                "name": "Sell Position / Active Holdings",
                "symbol": SYMBOL,
                "asset": "BTC",
                "targetAsset": "USDT",
                "quantity": btc_free,
                "botQuantity": float(bot_position_qty),
                "value_usdt": btc_free * float(current_price),
                "current_price": float(current_price),
                "status": "READY TO SELL" if btc_free > 0 else "NO HOLDINGS",
                "signal": signal,
                "type": "Spot Inventory (Base Asset)"
            }
        ]

        # Sparkline data (recent 20 close prices for mini chart)
        sparkline = [float(c[4]) for c in candles[-24:]] if candles else []

        return {
            "success": True,
            "timestamp": int(datetime.utcnow().timestamp() * 1000),
            "total_portfolio_usdt": float(total_usdt_value),
            "market": {
                "symbol": SYMBOL,
                "price": float(current_price),
                "change_percent_24h": float(price_change_percent),
                "high_24h": float(high_24h),
                "low_24h": float(low_24h),
                "sparkline": sparkline
            },
            "balances": balances_list,
            "positions": positions,
            "bot": {
                "symbol": SYMBOL,
                "interval": INTERVAL,
                "quote_order_size": QUOTE_ORDER_SIZE,
                "current_signal": signal,
                "position_qty": str(bot_position_qty),
                "last_candle_time": last_candle_dt,
                "status": "RUNNING"
            }
        }
    except Exception as e:
        logging.exception("Error in /api/overview")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/balances")
def get_balances():
    try:
        exchange = get_exchange()
        account = exchange.account()
        ticker = exchange.ticker_price(SYMBOL)
        btc_price = Decimal(ticker.get("price", "0"))

        balances = []
        total_usdt = Decimal("0")

        for item in account.get("balances", []):
            free = Decimal(item["free"])
            locked = Decimal(item["locked"])
            total = free + locked
            asset = item["asset"]

            if total > 0:
                price = btc_price if asset == "BTC" else (Decimal("1.0") if asset == "USDT" else Decimal("0"))
                val = total * price
                total_usdt += val

                balances.append({
                    "asset": asset,
                    "free": float(free),
                    "locked": float(locked),
                    "total": float(total),
                    "value_usdt": float(val)
                })

        return {
            "total_portfolio_usdt": float(total_usdt),
            "balances": balances
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/positions")
def get_positions():
    overview = get_overview()
    return {
        "positions": overview["positions"],
        "total_portfolio_usdt": overview["total_portfolio_usdt"],
        "market_price": overview["market"]["price"]
    }

@app.get("/api/trades")
def get_trades(limit: int = 15):
    try:
        exchange = get_exchange()
        trades = exchange.my_trades(SYMBOL, limit=limit)
        return {"trades": trades}
    except Exception as e:
        return {"trades": [], "error": str(e)}

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
