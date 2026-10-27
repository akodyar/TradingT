
import os
import json
import time
import logging
from decimal import Decimal

from dotenv import load_dotenv

from exchange import BinanceDemo
from strategy import get_signal


load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)

SYMBOL = os.getenv("SYMBOL", "BTCUSDT")
INTERVAL = os.getenv("INTERVAL", "1h")
QUOTE_ORDER_SIZE = Decimal(
    os.getenv("QUOTE_ORDER_SIZE", "20")
)
POLL_SECONDS = int(os.getenv("POLL_SECONDS", "60"))

STATE_FILE = "state.json"


def load_state():
    if not os.path.exists(STATE_FILE):
        return {
            "position_qty": "0",
            "last_candle": None
        }

    with open(STATE_FILE, "r") as f:
        return json.load(f)


def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def get_balance(account, asset):
    for item in account["balances"]:
        if item["asset"] == asset:
            return Decimal(item["free"])

    return Decimal("0")


def main():
    exchange = BinanceDemo()
    state = load_state()

    logging.info("Connected to Binance Spot Demo Mode")
    logging.info("Symbol: %s | Interval: %s", SYMBOL, INTERVAL)

    while True:
        try:
            candles = exchange.candles(
                SYMBOL, INTERVAL, limit=100
            )

            # Latest completed candle
            closed_candle = candles[-2]
            candle_time = str(closed_candle[0])

            # Do not process the same candle twice
            if candle_time == state["last_candle"]:
                time.sleep(POLL_SECONDS)
                continue

            signal = get_signal(candles)

            position_qty = Decimal(state["position_qty"])

            logging.info(
                "Signal: %s | Position: %s BTC",
                signal, position_qty
            )

            if signal == "BUY" and position_qty == 0:
                account = exchange.account()
                usdt_balance = get_balance(account, "USDT")

                if usdt_balance < QUOTE_ORDER_SIZE:
                    logging.warning(
                        "Insufficient demo USDT: %s",
                        usdt_balance
                    )
                else:
                    order = exchange.market_buy(
                        SYMBOL, QUOTE_ORDER_SIZE
                    )

                    bought_qty = Decimal(order["executedQty"])

                    if bought_qty > 0:
                        state["position_qty"] = str(bought_qty)

                    logging.info("BUY order: %s", order)

            elif signal == "SELL" and position_qty > 0:
                step = exchange.quantity_step(SYMBOL)

                sell_qty = exchange.round_quantity(
                    position_qty, step
                )

                if sell_qty > 0:
                    order = exchange.market_sell(
                        SYMBOL, sell_qty
                    )

                    sold_qty = Decimal(order["executedQty"])

                    remaining_qty = max(
                        Decimal("0"),
                        position_qty - sold_qty
                    )

                    state["position_qty"] = str(remaining_qty)

                    logging.info("SELL order: %s", order)

            # Save even on HOLD, so we don't reprocess this candle
            state["last_candle"] = candle_time
            save_state(state)

        except Exception:
            logging.exception("Bot iteration failed")

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
