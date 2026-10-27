from dotenv import load_dotenv
from exchange import BinanceDemo

load_dotenv()

exchange = BinanceDemo()
account = exchange.account()

print("Binance Demo Account Balances")
print("---------------------------")

for asset in ["BTC", "USDT"]:
    for item in account["balances"]:
        if item["asset"] == asset:
            print(f"{asset} Free: {item['free']}")
            print(f"{asset} Locked: {item['locked']}")
            break