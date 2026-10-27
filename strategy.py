
import pandas as pd


def get_signal(candles):
    """
    candles: Binance kline response
    Returns: BUY, SELL, or HOLD
    """

    if len(candles) < 55:
        return "HOLD"

    # Binance candle index 4 = close price
    closes = pd.Series(
        [float(candle[4]) for candle in candles]
    )

    short_ma = closes.rolling(20).mean()
    long_ma = closes.rolling(50).mean()

    # -1 is the current unfinished candle
    # -2 and -3 are the latest completed candles

    previous_short = short_ma.iloc[-3]
    previous_long = long_ma.iloc[-3]

    current_short = short_ma.iloc[-2]
    current_long = long_ma.iloc[-2]

    if pd.isna(previous_long) or pd.isna(current_long):
        return "HOLD"

    if (
        previous_short <= previous_long
        and current_short > current_long
    ):
        return "BUY"

    if (
        previous_short >= previous_long
        and current_short < current_long
    ):
        return "SELL"

    return "HOLD"
