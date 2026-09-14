"""
Quick Scalping Signal Generator
For Rs 10,000 with 50x leverage
"""

import random
from datetime import datetime

# 🎯 CONFIGURATION
CAPITAL = 10000  # Rs
LEVERAGE = 50
TRADING_CAPITAL = CAPITAL * LEVERAGE
POSITION_SIZE = TRADING_CAPITAL * 0.05  # 5% per trade
STOP_LOSS = POSITION_SIZE * 0.02  # 2%
TAKE_PROFIT = POSITION_SIZE * 0.03  # 3%

print("=" * 80)
print("⚠️  SCALPING SIGNAL GENERATOR - PAPER TRADING SIMULATION")
print("=" * 80)
print()
print(f"📊 SETUP:")
print(f"   Capital: Rs {CAPITAL:,}")
print(f"   Leverage: {LEVERAGE}x → Trading Capital: Rs {TRADING_CAPITAL:,}")
print(f"   Position Size: Rs {POSITION_SIZE:,.0f} per trade")
print(f"   Stop Loss: Rs {STOP_LOSS:,.0f} per trade")
print(f"   Take Profit: Rs {TAKE_PROFIT:,.0f} per trade")
print()

# ✨ SIMULATED MARKET ANALYSIS
def generate_scalp_signal(ticker):
    """Generate trading signal based on simulated analysis"""

    print(f"\n🔍 ANALYZING: {ticker}")
    print("-" * 60)

    # Simulated indicators (in real scenario, use technical analysis)
    rsi = random.randint(20, 80)  # Relative Strength Index (0-100)
    macd_signal = random.choice(['BULLISH', 'BEARISH', 'NEUTRAL'])
    volume_trend = random.choice(['HIGH', 'NORMAL', 'LOW'])
    sentiment = random.uniform(0, 1)  # 0=Bearish, 1=Bullish

    print(f"   RSI: {rsi:3d} {'🟢 Oversold' if rsi < 30 else '🔴 Overbought' if rsi > 70 else '⚪ Neutral'}")
    print(f"   MACD: {macd_signal:8s}")
    print(f"   Volume: {volume_trend:6s}")
    print(f"   Sentiment: {sentiment:.1%} {'🟢 BULLISH' if sentiment > 0.6 else '🔴 BEARISH' if sentiment < 0.4 else '⚪ NEUTRAL'}")

    # Generate signal
    bullish_score = 0
    bearish_score = 0

    if rsi < 30:
        bullish_score += 2
    elif rsi > 70:
        bearish_score += 2

    if macd_signal == 'BULLISH':
        bullish_score += 1
    elif macd_signal == 'BEARISH':
        bearish_score += 1

    if sentiment > 0.6:
        bullish_score += 1
    elif sentiment < 0.4:
        bearish_score += 1

    if volume_trend == 'HIGH':
        bullish_score += 1

    confidence = max(bullish_score, bearish_score) / 4

    if bullish_score > bearish_score:
        signal = '🟢 BUY' if confidence > 0.6 else '⚪ WEAK BUY'
    elif bearish_score > bullish_score:
        signal = '🔴 SELL' if confidence > 0.6 else '⚪ WEAK SELL'
    else:
        signal = '⚪ HOLD'

    return signal, confidence, rsi, sentiment

# 📊 SIMULATE SCALP TRADES
def execute_scalp_trade(ticker, signal, confidence, rsi, sentiment):
    """Simulate a scalp trade execution"""

    print(f"\n   Signal: {signal}")
    print(f"   Confidence: {confidence:.1%}")

    if '🟢' in signal or '🔴' in signal:
        # Calculate P&L scenarios
        print(f"\n   📈 Trade Setup:")
        print(f"   • Entry: Market Price")
        print(f"   • Position: Rs {POSITION_SIZE:,.0f}")
        print(f"   • Stop Loss: Rs {STOP_LOSS:,.0f}")
        print(f"   • Take Profit: Rs {TAKE_PROFIT:,.0f}")

        # Simulate trade outcome (confidence-based)
        if random.random() < confidence:
            outcome = '✅ WIN'
            pnl = TAKE_PROFIT
            roi = (pnl / CAPITAL) * 100
        else:
            outcome = '❌ LOSS'
            pnl = -STOP_LOSS
            roi = (pnl / CAPITAL) * 100

        print(f"\n   Result: {outcome}")
        print(f"   PnL: Rs {pnl:+,.0f}")
        print(f"   ROI: {roi:+.2f}%")

        return pnl
    else:
        print(f"   ⏸️  No Trade - Waiting for better setup")
        return 0


# 🚀 MAIN EXECUTION
print("\n" + "=" * 80)
print("💰 SCALPING SIGNALS FOR YOUR Rs 10,000 (50x Leverage)")
print("=" * 80)

tickers = ['AAPL', 'TSLA', 'NVDA', 'BTC/USD', 'ETH/USD']
total_pnl = 0
trade_count = 0

for ticker in tickers:
    signal, confidence, rsi, sentiment = generate_scalp_signal(ticker)
    pnl = execute_scalp_trade(ticker, signal, confidence, rsi, sentiment)

    if pnl != 0:
        total_pnl += pnl
        trade_count += 1

# Final Summary
print("\n" + "=" * 80)
print("📊 SESSION SUMMARY")
print("=" * 80)
print(f"\nTrades Executed: {trade_count}")
print(f"Total PnL: Rs {total_pnl:+,.0f}")
print(f"Account Growth: {(total_pnl/CAPITAL)*100:+.2f}%")

if total_pnl > 0:
    print(f"\n✅ Profit! New Balance: Rs {CAPITAL + total_pnl:,.0f}")
else:
    print(f"\n❌ Loss. New Balance: Rs {CAPITAL + total_pnl:,.0f}")

print("\n" + "=" * 80)
print("⚠️  IMPORTANT WARNINGS:")
print("=" * 80)
print("""
This is a SIMULATION. Real trading is DIFFERENT:

1. 🔥 50x LEVERAGE RISKS:
   - Rs 10,000 × 50 = Rs 500,000 exposure
   - A 2% move = 100% loss of capital
   - Market gaps can trigger LIQUIDATION
   - You can lose MORE than your initial investment

2. 💥 SLIPPAGE & FEES:
   - Your entry/exit won't be exact
   - Brokerage fees eat into thin margins
   - Wide spreads during scalping = less profit

3. 📉 PSYCHOLOGICAL:
   - Scalping is MENTALLY EXHAUSTING
   - Emotions lead to WRONG decisions
   - Overtrading leads to LOSSES

4. ✅ BEST PRACTICES:
   - Start with 1-2x leverage (NOT 50x)
   - Risk only 1% per trade
   - Use STRICT stop losses
   - Keep a trading journal
   - Practice on demo for 3 months first

===============================================
🎯 RECOMMENDED APPROACH:
===============================================
1. Start with Rs 1,000 (1-2x leverage)
2. Master risk management first
3. Get 100+ consistent wins
4. Then increase capital slowly
5. Never rush to scale up

Remember: "The goal of trading is to survive,
           not to get rich quick!" 📚
""")
print("=" * 80)
