
import os
import time
import hmac
import hashlib
from decimal import Decimal, ROUND_DOWN
from urllib.parse import urlencode

import requests


BASE_URL = "https://testnet.binance.vision/api"


class BinanceDemo:
    def __init__(self):
        self.api_key = os.environ["BINANCE_API_KEY"]
        self.api_secret = os.environ["BINANCE_API_SECRET"]
        self.session = requests.Session()
        self.session.headers.update({
            "X-MBX-APIKEY": self.api_key
        })

        # Adjust timestamps using Binance server time
        server_time = self.session.get(
            BASE_URL + "/v3/time", timeout=10
        ).json()["serverTime"]

        self.time_offset = server_time - int(time.time() * 1000)

    def request(self, method, path, params=None, signed=False):
        params = params or {}

        if signed:
            params["timestamp"] = (
                int(time.time() * 1000) + self.time_offset
            )
            params["recvWindow"] = 5000

            query = urlencode(params)
            signature = hmac.new(
                self.api_secret.encode(),
                query.encode(),
                hashlib.sha256
            ).hexdigest()

            params["signature"] = signature

        response = self.session.request(
            method,
            BASE_URL + path,
            params=params,
            timeout=15
        )

        response.raise_for_status()
        return response.json()

    def candles(self, symbol, interval, limit=100):
        return self.request(
            "GET",
            "/v3/klines",
            {
                "symbol": symbol,
                "interval": interval,
                "limit": limit
            }
        )

    def account(self):
        return self.request(
            "GET", "/v3/account", signed=True
        )

    def ticker_price(self, symbol="BTCUSDT"):
        return self.request(
            "GET",
            "/v3/ticker/price",
            {"symbol": symbol}
        )

    def ticker_24hr(self, symbol="BTCUSDT"):
        return self.request(
            "GET",
            "/v3/ticker/24hr",
            {"symbol": symbol}
        )

    def open_orders(self, symbol=None):
        params = {"symbol": symbol} if symbol else {}
        return self.request(
            "GET",
            "/v3/openOrders",
            params=params,
            signed=True
        )

    def my_trades(self, symbol="BTCUSDT", limit=20):
        return self.request(
            "GET",
            "/v3/myTrades",
            {"symbol": symbol, "limit": limit},
            signed=True
        )


    def market_buy(self, symbol, quote_amount):
        return self.request(
            "POST",
            "/v3/order",
            {
                "symbol": symbol,
                "side": "BUY",
                "type": "MARKET",
                "quoteOrderQty": str(quote_amount),
                "newOrderRespType": "FULL"
            },
            signed=True
        )

    def market_sell(self, symbol, quantity):
        return self.request(
            "POST",
            "/v3/order",
            {
                "symbol": symbol,
                "side": "SELL",
                "type": "MARKET",
                "quantity": str(quantity),
                "newOrderRespType": "FULL"
            },
            signed=True
        )

    def quantity_step(self, symbol):
        info = self.request(
            "GET",
            "/v3/exchangeInfo",
            {"symbol": symbol}
        )

        filters = info["symbols"][0]["filters"]

        lot_filter = next(
            f for f in filters if f["filterType"] == "LOT_SIZE"
        )

        return Decimal(lot_filter["stepSize"])

    @staticmethod
    def round_quantity(quantity, step):
        quantity = Decimal(str(quantity))
        step = Decimal(str(step))

        return (
            (quantity / step).to_integral_value(
                rounding=ROUND_DOWN
            ) * step
        )
