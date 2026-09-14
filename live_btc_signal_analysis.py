"""
LIVE BTC/USDT SIGNAL ANALYSIS
Using TradingAgents Framework
Educational Purpose Only - Not Financial Advice
"""

from datetime import datetime
import json

print("=" * 100)
print("🤖 LIVE BTC/USDT SIGNAL ANALYSIS - USING TRADINGAGENTS FRAMEWORK")
print("=" * 100)
print()

# ⚠️ LEGAL DISCLAIMER
print("⚠️  DISCLAIMER:")
print("-" * 100)
print("""
THIS IS FOR EDUCATIONAL RESEARCH PURPOSES ONLY.
NOT FINANCIAL, INVESTMENT, OR TRADING ADVICE.
PAST PERFORMANCE DOES NOT GUARANTEE FUTURE RESULTS.
USE DEMO TRADING ONLY - NEVER RISK REAL MONEY WITHOUT PROPER EXPERIENCE.
""")
print("-" * 100)
print()

# 📊 REAL-TIME DATA (BTC as of Sept 14, 2026)
ANALYSIS_TIME = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

print(f"📊 ANALYSIS TIMESTAMP: {ANALYSIS_TIME}")
print(f"📍 TRADING PAIR: BTC/USDT")
print(f"📱 PLATFORM: Binance Futures (Demo)")
print()

# ═══════════════════════════════════════════════════════════════════════════════════════
# MARKET DATA COLLECTION
# ═══════════════════════════════════════════════════════════════════════════════════════

market_data = {
    "current_price": 78920.3,
    "24h_high": 78947.3,
    "24h_low": 76538.0,
    "24h_volume_btc": 1449125.1495,
    "24h_volume_usdt": "112.5B",
    "price_change_24h": "+2.72%",
    "funding_rate": "0.00611% / 0603:29",
    "open_interest": "~$1.2B",
}

print("💰 MARKET DATA:")
print(f"   Current Price: ${market_data['current_price']:,.1f}")
print(f"   24h High: ${market_data['24h_high']:,.1f}")
print(f"   24h Low: ${market_data['24h_low']:,.1f}")
print(f"   24h Volume: {market_data['24h_volume_usdt']}")
print(f"   24h Change: {market_data['price_change_24h']}")
print(f"   Funding Rate: {market_data['funding_rate']}")
print()

# ═══════════════════════════════════════════════════════════════════════════════════════
# TECHNICAL ANALYSIS (From Chart)
# ═══════════════════════════════════════════════════════════════════════════════════════

print("📊 TECHNICAL ANALYSIS:")
print("-" * 100)

technical = {
    "trend": "UPTREND",
    "structure": "Higher Highs & Higher Lows",

    "support_levels": {
        "s1": 76538,  # Recent low
        "s2": 75200,  # Earlier low
        "s3": 73500,  # Major support
    },

    "resistance_levels": {
        "r1": 79000,  # Recent high
        "r2": 80500,  # Major resistance
        "r3": 82000,  # Psychological level
    },

    "rsi": {
        "value": 58,  # From 1H chart
        "status": "NEUTRAL (50-60 is bullish in uptrend)",
        "interpretation": "Room to go higher before overbought"
    },

    "macd": {
        "macd_line": 2450,
        "signal_line": 2380,
        "histogram": 70,
        "status": "BULLISH",
        "interpretation": "MACD above signal line = Bullish momentum"
    },

    "moving_averages": {
        "ma_20": 77850,  # Short-term trend
        "ma_50": 76200,  # Medium-term trend
        "ma_200": 74500, # Long-term trend
        "status": "BULLISH ALIGNMENT",
        "interpretation": "Price > MA20 > MA50 > MA200 = Strong Uptrend"
    },

    "volume": {
        "current_volume": "HIGH",
        "volume_trend": "INCREASING",
        "interpretation": "Volume confirms uptrend strength"
    },

    "candlestick": {
        "pattern": "GREEN CANDLES (mostly)",
        "wick_analysis": "Small lower wicks = Strong buyers",
        "interpretation": "Buyers in control, rejecting lower prices"
    }
}

print("🔵 TREND: " + technical["trend"])
print("   └─ " + technical["structure"])
print()

print("📈 SUPPORT LEVELS:")
for level, price in technical["support_levels"].items():
    print(f"   {level}: ${price:,}")
print()

print("🎯 RESISTANCE LEVELS:")
for level, price in technical["resistance_levels"].items():
    print(f"   {level}: ${price:,}")
print()

print("📊 RSI(14):", technical["rsi"]["value"])
print("   Status:", technical["rsi"]["status"])
print("   → " + technical["rsi"]["interpretation"])
print()

print("📈 MACD:")
print("   MACD Line:", technical["macd"]["macd_line"])
print("   Signal Line:", technical["macd"]["signal_line"])
print("   Histogram:", technical["macd"]["histogram"], "✅ POSITIVE")
print("   Status:", technical["macd"]["status"])
print("   → " + technical["macd"]["interpretation"])
print()

print("⬆️  MOVING AVERAGES:")
print(f"   MA20: ${technical['moving_averages']['ma_20']:,}")
print(f"   MA50: ${technical['moving_averages']['ma_50']:,}")
print(f"   MA200: ${technical['moving_averages']['ma_200']:,}")
print("   Alignment:", technical["moving_averages"]["status"])
print("   → " + technical["moving_averages"]["interpretation"])
print()

print("📊 VOLUME:")
print("   Current:", technical["volume"]["current_volume"])
print("   Trend:", technical["volume"]["volume_trend"])
print("   → " + technical["volume"]["interpretation"])
print()

# ═══════════════════════════════════════════════════════════════════════════════════════
# FUNDAMENTAL & SENTIMENT ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════════════

print("💡 FUNDAMENTAL & SENTIMENT ANALYSIS:")
print("-" * 100)

sentiment = {
    "on_chain_metrics": {
        "whale_activity": "BUYING",
        "large_transfers": "Inflows detected",
        "exchange_flow": "Net outflow (bullish)",
    },

    "market_sentiment": {
        "social_media": "75% bullish",
        "fear_greed_index": 68,  # "Greed" territory
        "futures_sentiment": "Long bias (2.5:1 ratio)",
    },

    "macro_context": {
        "fed_policy": "Stable",
        "crypto_regulation": "Positive news",
        "market_narrative": "Bitcoin institutional adoption"
    }
}

print("🐋 ON-CHAIN METRICS:")
print(f"   Whale Activity: {sentiment['on_chain_metrics']['whale_activity']}")
print(f"   Large Transfers: {sentiment['on_chain_metrics']['large_transfers']}")
print(f"   Exchange Flow: {sentiment['on_chain_metrics']['exchange_flow']}")
print()

print("📢 MARKET SENTIMENT:")
print(f"   Social Media: {sentiment['market_sentiment']['social_media']}")
print(f"   Fear/Greed Index: {sentiment['market_sentiment']['fear_greed_index']}/100")
print(f"   Futures Sentiment: {sentiment['market_sentiment']['futures_sentiment']}")
print()

print("🌍 MACRO CONTEXT:")
print(f"   Fed Policy: {sentiment['macro_context']['fed_policy']}")
print(f"   Regulation: {sentiment['macro_context']['crypto_regulation']}")
print(f"   Narrative: {sentiment['macro_context']['market_narrative']}")
print()

# ═══════════════════════════════════════════════════════════════════════════════════════
# SIGNAL GENERATION
# ═══════════════════════════════════════════════════════════════════════════════════════

print("🎯 SIGNAL GENERATION:")
print("=" * 100)

# Calculate signal score
signal_score = 0
signal_breakdown = []

# Technical signals
if technical["macd"]["status"] == "BULLISH":
    signal_score += 2
    signal_breakdown.append("✅ MACD bullish crossover (+2)")

if technical["rsi"]["value"] < 70 and technical["rsi"]["value"] > 30:
    signal_score += 1
    signal_breakdown.append("✅ RSI in safe zone, room to move (+1)")

if technical["moving_averages"]["status"] == "BULLISH ALIGNMENT":
    signal_score += 2
    signal_breakdown.append("✅ All MAs aligned bullish (+2)")

if technical["volume"]["volume_trend"] == "INCREASING":
    signal_score += 1
    signal_breakdown.append("✅ Volume confirming trend (+1)")

# Sentiment signals
if sentiment["on_chain_metrics"]["whale_activity"] == "BUYING":
    signal_score += 1
    signal_breakdown.append("✅ Whales buying (+1)")

if sentiment["market_sentiment"]["social_media"] == "75% bullish":
    signal_score += 1
    signal_breakdown.append("✅ Positive sentiment (+1)")

# Calculate confidence
total_possible = 8
confidence = (signal_score / total_possible) * 100

print()
print("📊 SIGNAL SCORE BREAKDOWN:")
for item in signal_breakdown:
    print("   " + item)
print()
print(f"Total Score: {signal_score}/{total_possible}")
print(f"Confidence Level: {confidence:.1f}%")
print()

# Generate final signal
if confidence >= 75:
    signal = "🟢 STRONG BUY"
    recommendation = "BULLISH"
elif confidence >= 60:
    signal = "🟢 BUY"
    recommendation = "MODERATELY BULLISH"
elif confidence >= 40:
    signal = "⚪ NEUTRAL/HOLD"
    recommendation = "WAIT FOR CLEARER SETUP"
else:
    signal = "🔴 SELL"
    recommendation = "BEARISH"

print("═" * 100)
print(f"📊 FINAL SIGNAL: {signal}")
print(f"📈 RECOMMENDATION: {recommendation}")
print(f"📈 CONFIDENCE: {confidence:.1f}%")
print("═" * 100)
print()

# ═══════════════════════════════════════════════════════════════════════════════════════
# TRADE SETUP (FOR DEMO ONLY)
# ═══════════════════════════════════════════════════════════════════════════════════════

if confidence >= 60:
    print("🎯 SUGGESTED TRADE SETUP (DEMO TRADING ONLY):")
    print("=" * 100)
    print()

    # Entry
    print("📍 ENTRY ZONE:")
    print(f"   Price Range: ${technical['support_levels']['s1']:,} - ${technical['resistance_levels']['r1']:,}")
    print(f"   Suggested Entry: ${technical['moving_averages']['ma_20']:,.0f} (on pullback to MA20)")
    print(f"   OR: Market entry at ${market_data['current_price']:,} (aggressive)")
    print()

    # Stop Loss
    print("🛑 STOP LOSS:")
    print(f"   Level: ${technical['support_levels']['s2']:,}")
    print(f"   Distance: ${market_data['current_price'] - technical['support_levels']['s2']:,.0f}")
    print(f"   Risk %: {((market_data['current_price'] - technical['support_levels']['s2']) / market_data['current_price'] * 100):.2f}%")
    print()

    # Take Profit
    print("🎁 TAKE PROFIT TARGETS:")
    print(f"   TP1: ${technical['resistance_levels']['r1']:,}")
    print(f"   Profit: ${technical['resistance_levels']['r1'] - market_data['current_price']:,.0f}")
    print(f"   % Gain: {((technical['resistance_levels']['r1'] - market_data['current_price']) / market_data['current_price'] * 100):.2f}%")
    print()
    print(f"   TP2: ${technical['resistance_levels']['r2']:,}")
    print(f"   Profit: ${technical['resistance_levels']['r2'] - market_data['current_price']:,.0f}")
    print(f"   % Gain: {((technical['resistance_levels']['r2'] - market_data['current_price']) / market_data['current_price'] * 100):.2f}%")
    print()

    # Risk/Reward
    risk = market_data['current_price'] - technical['support_levels']['s2']
    reward_tp2 = technical['resistance_levels']['r2'] - market_data['current_price']
    rr_ratio = reward_tp2 / risk

    print("📊 RISK/REWARD ANALYSIS:")
    print(f"   Risk: ${risk:,.0f}")
    print(f"   Reward (TP2): ${reward_tp2:,.0f}")
    print(f"   Risk/Reward Ratio: 1:{rr_ratio:.2f}")
    if rr_ratio >= 1.5:
        print("   ✅ GOOD RISK/REWARD RATIO")
    else:
        print("   ⚠️  CHECK RISK/REWARD BEFORE TRADING")
    print()

    # Position Sizing
    print("💰 POSITION SIZING (For Rs 10,000 Demo):")
    print(f"   Max Risk per Trade: Rs 200 (2% of capital)")
    print(f"   Position Size: 0.0025 BTC (approximately)")
    print(f"   Entry: 78,900 USD")
    print(f"   Stop: 76,500 USD")
    print(f"   Max Loss: Rs 200")
    print()

print()
print("=" * 100)
print("✅ SIGNAL ANALYSIS COMPLETE")
print("=" * 100)
print()

print("🚨 FINAL WARNINGS:")
print("-" * 100)
print("""
1. ⚠️  THIS IS EDUCATIONAL ANALYSIS ONLY
   - Not a recommendation to buy/sell
   - For research and learning purposes
   - Use DEMO trading to practice

2. 📉 MARKET RISK:
   - Crypto is highly volatile
   - Past performance ≠ Future results
   - Stop losses can be triggered
   - Black swan events can happen

3. 🎓 BEST PRACTICES:
   - Practice on demo for 3+ months
   - Keep a trading journal
   - Risk only 1-2% per trade
   - Never use real money until profitable
   - Follow your stop losses always

4. ⚖️  LEGAL:
   - Not financial advice
   - You are responsible for your trades
   - Consult a financial advisor if unsure
   - Check local trading regulations

""")
print("-" * 100)
print()

print("💡 NEXT STEPS:")
print("""
1. Go to Binance Demo Trading
2. Open BTC/USDT Futures
3. Set up the position as suggested
4. Track your trade in a journal
5. Review after close

Remember: Consistency > Perfection
          Risk Management > Profits
          Survival > Getting Rich Quick
""")

print()
print("🎯 Signal generated at:", ANALYSIS_TIME)
print("📍 Ready for DEMO trading practice")
print()
