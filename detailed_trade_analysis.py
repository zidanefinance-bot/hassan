"""
DETAILED TRADE ANALYSIS WITH CLEAR SETUP
Educational Example for Paper Trading
⚠️ NOT FINANCIAL ADVICE - FOR LEARNING ONLY
"""

import json
from datetime import datetime, timedelta

print("=" * 100)
print("🎯 DETAILED TRADE ANALYSIS - STEP BY STEP BREAKDOWN")
print("=" * 100)
print()

# ═══════════════════════════════════════════════════════════════
# TRADE #1: APPLE (AAPL) - LONG SCALP
# ═══════════════════════════════════════════════════════════════

TRADE_1 = {
    "trade_id": 1,
    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "asset": "AAPL",
    "strategy": "SCALP LONG",
    "timeframe": "5-minute",

    # 📊 ANALYSIS
    "technical_analysis": {
        "price": 195.50,
        "rsi_14": 28,  # Oversold = Bullish
        "macd": {
            "line": 0.45,
            "signal": 0.38,
            "histogram": 0.07,
            "status": "BULLISH CROSSOVER"  # Line > Signal = BUY
        },
        "moving_averages": {
            "ma_20": 196.20,
            "ma_50": 197.80,
            "current_price": 195.50,
            "status": "Price below MA20 = Reversal opportunity"
        },
        "support_resistance": {
            "support_1": 194.00,
            "support_2": 192.50,
            "resistance_1": 197.00,
            "resistance_2": 199.00,
            "current_price": 195.50
        }
    },

    "fundamental_analysis": {
        "earnings": "Last reported strong revenue growth",
        "pe_ratio": 28.5,
        "sector_sentiment": "Technology sector rallying",
        "news": "Positive AI chip announcement"
    },

    "sentiment_analysis": {
        "social_media": "75% bullish mentions",
        "news_sentiment": "Positive (3:1 ratio)",
        "institutional_flow": "Net buying detected",
        "overall_score": 0.78  # 0-1 scale, 0.78 = Strong Bullish
    },

    # 🎯 ENTRY SETUP
    "entry": {
        "type": "MARKET ORDER",
        "price": 195.50,
        "reasoning": "RSI oversold + MACD bullish crossover + price above support"
    },

    # 💰 POSITION SIZING (Rs 10,000 with 50x leverage)
    "position_sizing": {
        "account_balance": 10000,
        "leverage": 50,
        "trading_capital": 500000,
        "risk_per_trade_pct": 0.02,  # 2% = Aggressive
        "risk_amount": 200,  # 2% of 10,000
        "position_size_usd": 25000,  # Rs 25,000 equivalent
        "shares": 128,  # 128 shares @ $195.50
        "notional_exposure": 25000
    },

    # 🛑 STOP LOSS & TAKE PROFIT
    "risk_management": {
        "stop_loss_price": 193.50,
        "stop_loss_distance": 2.00,  # $2 below entry
        "stop_loss_pct": 1.02,
        "stop_loss_amount": -256,  # -(128 * 2)

        "take_profit_1": 197.50,
        "tp1_distance": 2.00,
        "tp1_amount": 256,
        "tp1_size_pct": 0.50,  # Take half at TP1

        "take_profit_2": 200.00,
        "tp2_distance": 4.50,
        "tp2_amount": 576,
        "tp2_size_pct": 0.50,  # Take rest at TP2

        "risk_reward_ratio": 2.25  # TP2 / SL
    },

    # ✅ TRADE EXECUTION
    "execution": {
        "status": "ENTERED",
        "entry_time": "09:45 AM EST",
        "entry_price": 195.50,
        "entry_shares": 128,
        "entry_cost": 25024,
        "commission": 10,  # $10 commission
        "total_entry_cost": 25034,
    },

    # 📈 TRADE PROGRESSION
    "progression": [
        {
            "time": "09:47 AM",
            "price": 196.20,
            "change": "+0.70",
            "status": "✅ Profitable, momentum building"
        },
        {
            "time": "09:50 AM",
            "price": 197.30,
            "change": "+1.80",
            "status": "Approaching TP1"
        },
        {
            "time": "09:52 AM",
            "price": 197.55,
            "change": "+2.05",
            "status": "🎯 HIT TP1 - Sell 64 shares"
        }
    ],

    # 💵 PROFIT/LOSS CALCULATION
    "results": {
        "sold_at_tp1": {
            "shares": 64,
            "price": 197.55,
            "proceeds": 12643,
            "profit": 640,
            "commission": 10,
            "net_profit": 630
        },
        "remaining_position": {
            "shares": 64,
            "entry_price": 195.50,
            "current_price": 197.55,
            "unrealized_profit": 130
        },
        "final_exit": {
            "price": 200.00,  # TP2 hit
            "proceeds": 12800,
            "profit": 576,
            "net_profit": 566
        },
        "total_pnl": 1196,  # 630 + 566
        "roi_pct": 11.96,
        "roi_on_capital": 0.012  # 1.2% of account
    }
}

# ═══════════════════════════════════════════════════════════════
# TRADE #2: TESLA (TSLA) - SHORT SCALP
# ═══════════════════════════════════════════════════════════════

TRADE_2 = {
    "trade_id": 2,
    "timestamp": (datetime.now() + timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S"),
    "asset": "TSLA",
    "strategy": "SCALP SHORT",
    "timeframe": "5-minute",

    # 📊 ANALYSIS
    "technical_analysis": {
        "price": 242.80,
        "rsi_14": 72,  # Overbought = Bearish
        "macd": {
            "line": -0.32,
            "signal": -0.28,
            "histogram": -0.04,
            "status": "BEARISH DIVERGENCE"
        },
        "moving_averages": {
            "ma_20": 240.50,
            "ma_50": 238.20,
            "current_price": 242.80,
            "status": "Price well above MAs - potential pullback"
        },
        "support_resistance": {
            "support_1": 240.00,
            "support_2": 237.50,
            "resistance_1": 245.00,
            "resistance_2": 250.00,
            "current_price": 242.80
        }
    },

    "fundamental_analysis": {
        "earnings": "Next earnings in 2 weeks",
        "pe_ratio": 65.2,
        "sector_sentiment": "Profit taking after rally",
        "news": "Minor production delay reported"
    },

    "sentiment_analysis": {
        "social_media": "55% bullish (declining)",
        "news_sentiment": "Mixed (warnings of high valuation)",
        "institutional_flow": "Net selling detected",
        "overall_score": 0.42  # Bearish
    },

    # 🎯 ENTRY SETUP
    "entry": {
        "type": "MARKET ORDER",
        "price": 242.80,
        "reasoning": "RSI overbought + MACD bearish divergence + profit taking"
    },

    # 💰 POSITION SIZING
    "position_sizing": {
        "account_balance": 10000,
        "leverage": 50,
        "trading_capital": 500000,
        "risk_per_trade_pct": 0.02,
        "risk_amount": 200,
        "position_size_usd": 20000,  # Slightly smaller for SHORT
        "shares": 82,  # 82 shares @ $242.80
        "notional_exposure": 19870
    },

    # 🛑 STOP LOSS & TAKE PROFIT
    "risk_management": {
        "stop_loss_price": 245.80,  # Above resistance
        "stop_loss_distance": 3.00,
        "stop_loss_pct": 1.23,
        "stop_loss_amount": -246,

        "take_profit_1": 240.50,
        "tp1_distance": 2.30,
        "tp1_amount": 189,
        "tp1_size_pct": 0.50,

        "take_profit_2": 237.00,
        "tp2_distance": 5.80,
        "tp2_amount": 476,
        "tp2_size_pct": 0.50,

        "risk_reward_ratio": 1.93
    },

    # ✅ TRADE EXECUTION
    "execution": {
        "status": "ENTERED SHORT",
        "entry_time": "10:00 AM EST",
        "entry_price": 242.80,
        "entry_shares": 82,  # Short 82 shares
        "entry_proceeds": 19910,
        "commission": 10,
        "net_proceeds": 19900,
    },

    # 📉 TRADE PROGRESSION
    "progression": [
        {
            "time": "10:02 AM",
            "price": 241.90,
            "change": "-0.90",
            "status": "✅ In profit immediately"
        },
        {
            "time": "10:05 AM",
            "price": 240.70,
            "change": "-2.10",
            "status": "Approaching TP1"
        },
        {
            "time": "10:08 AM",
            "price": 240.50,
            "change": "-2.30",
            "status": "🎯 HIT TP1 - Buy back 41 shares"
        }
    ],

    # 💵 PROFIT/LOSS CALCULATION
    "results": {
        "closed_at_tp1": {
            "shares": 41,
            "price": 240.50,
            "cost": 9861,
            "profit": 95,
            "commission": 10,
            "net_profit": 85
        },
        "remaining_short": {
            "shares": 41,
            "entry_price": 242.80,
            "current_price": 240.50,
            "unrealized_profit": 95
        },
        "final_exit": {
            "price": 237.00,  # TP2 hit
            "cost": 9717,
            "profit": 214,
            "net_profit": 204
        },
        "total_pnl": 289,  # 85 + 204
        "roi_pct": 2.89,
        "roi_on_capital": 0.0029  # 0.29% of account
    }
}

# ═══════════════════════════════════════════════════════════════
# TRADE #3: BITCOIN (BTC) - LONG SCALP
# ═══════════════════════════════════════════════════════════════

TRADE_3 = {
    "trade_id": 3,
    "timestamp": (datetime.now() + timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S"),
    "asset": "BTC/USD",
    "strategy": "SCALP LONG - CRYPTO",
    "timeframe": "1-minute",

    # 📊 ANALYSIS
    "technical_analysis": {
        "price": 42350,
        "rsi_14": 25,
        "macd": {
            "status": "BULLISH"
        },
        "volume": "High volume on bounce",
        "trend": "Bouncing off daily support"
    },

    "sentiment_analysis": {
        "whale_activity": "Large buyers detected",
        "social_media": "85% bullish",
        "overall_score": 0.85
    },

    # 🎯 ENTRY SETUP
    "entry": {
        "type": "MARKET ORDER",
        "price": 42350,
        "reasoning": "Major support bounce + whale buying + RSI oversold"
    },

    # 💰 POSITION SIZING (Crypto needs smaller position)
    "position_sizing": {
        "account_balance": 10000,
        "leverage": 30,  # Lower leverage for crypto
        "trading_capital": 300000,
        "btc_amount": 0.0071,  # ~0.007 BTC
        "usd_value": 300,  # Conservative
        "notional_exposure": 300,
        "risk_per_trade_pct": 0.03,
        "risk_amount": 300
    },

    # 🛑 RISK MANAGEMENT
    "risk_management": {
        "stop_loss_price": 41850,
        "stop_loss_distance": 500,
        "stop_loss_pct": 1.18,
        "stop_loss_amount": -150,

        "take_profit_1": 42700,
        "tp1_distance": 350,
        "tp1_amount": 150,
        "tp1_size_pct": 0.50,

        "take_profit_2": 43050,
        "tp2_distance": 700,
        "tp2_amount": 200,
        "tp2_size_pct": 0.50,

        "risk_reward_ratio": 1.4
    },

    # ✅ RESULTS
    "results": {
        "outcome": "✅ HIT TP2",
        "total_pnl": 497,
        "roi_pct": 4.97,
        "roi_on_capital": 0.0497,
        "status": "CLOSED with profit"
    }
}

# ═══════════════════════════════════════════════════════════════
# PRINT ALL TRADES WITH CLEAR DETAILS
# ═══════════════════════════════════════════════════════════════

def print_trade_details(trade):
    """Print comprehensive trade details"""

    print()
    print("╔" + "═" * 98 + "╗")
    print(f"║ TRADE #{trade['trade_id']}: {trade['asset']} - {trade['strategy']:<40} {trade['timestamp']} ║")
    print("╚" + "═" * 98 + "╝")
    print()

    # ANALYSIS
    print("📊 TECHNICAL ANALYSIS:")
    print(f"   Price: ${trade['technical_analysis']['price']:,.2f}")
    print(f"   RSI(14): {trade['technical_analysis']['rsi_14']} {'🔴 Overbought' if trade['technical_analysis']['rsi_14'] > 70 else '🟢 Oversold' if trade['technical_analysis']['rsi_14'] < 30 else '⚪ Neutral'}")
    print(f"   MACD: {trade['technical_analysis']['macd'].get('status', 'N/A')}")
    print()

    print("📰 SENTIMENT SCORE:", f"{trade['sentiment_analysis']['overall_score']:.0%}",
          "🟢 BULLISH" if trade['sentiment_analysis']['overall_score'] > 0.6 else "🔴 BEARISH")
    print()

    # ENTRY
    print("🎯 ENTRY SETUP:")
    print(f"   Type: {trade['entry']['type']}")
    print(f"   Price: ${trade['entry']['price']:,.2f}")
    print(f"   Reason: {trade['entry']['reasoning']}")
    print()

    # POSITION
    print("💰 POSITION SIZING:")
    print(f"   Account: Rs {trade['position_sizing']['account_balance']:,}")
    print(f"   Leverage: {trade['position_sizing']['leverage']}x")
    print(f"   Position Size: ${trade['position_sizing']['notional_exposure']:,.0f}")
    print(f"   Risk per Trade: Rs {trade['position_sizing']['risk_amount']}")
    print()

    # RISK
    print("🛑 STOP LOSS & TAKE PROFIT:")
    print(f"   Stop Loss: ${trade['risk_management']['stop_loss_price']:,.2f} (Loss: -Rs {abs(trade['risk_management']['stop_loss_amount']):,.0f})")
    print(f"   Take Profit 1: ${trade['risk_management']['take_profit_1']:,.2f} (Profit: +Rs {trade['risk_management']['tp1_amount']:,.0f})")
    if 'take_profit_2' in trade['risk_management']:
        print(f"   Take Profit 2: ${trade['risk_management']['take_profit_2']:,.2f} (Profit: +Rs {trade['risk_management']['tp2_amount']:,.0f})")
    print(f"   Risk/Reward: 1:{trade['risk_management']['risk_reward_ratio']:.2f}")
    print()

    # RESULTS
    if 'progression' in trade:
        print("📈 TRADE PROGRESSION:")
        for prog in trade['progression']:
            print(f"   {prog['time']}: ${prog['price']:,.2f} {prog['change']:>6} → {prog['status']}")
        print()

    print("💵 RESULTS:")
    print(f"   Total PnL: Rs +{trade['results']['total_pnl']:,.0f}")
    print(f"   ROI on Position: {trade['results']['roi_pct']:+.2f}%")
    print(f"   ROI on Account: {trade['results']['roi_on_capital']:+.2%}")
    print()


# Print all trades
print_trade_details(TRADE_1)
print_trade_details(TRADE_2)
print_trade_details(TRADE_3)

# SUMMARY
print()
print("╔" + "═" * 98 + "╗")
print("║" + " " * 40 + "📊 TRADING SESSION SUMMARY" + " " * 32 + "║")
print("╚" + "═" * 98 + "╝")
print()

total_pnl = TRADE_1['results']['total_pnl'] + TRADE_2['results']['total_pnl'] + TRADE_3['results']['total_pnl']
total_roi = (total_pnl / 10000) * 100

print(f"Total Trades: 3")
print(f"Wins: 3 (100%)")
print(f"Losses: 0")
print()
print(f"Session PnL: Rs +{total_pnl:,.0f}")
print(f"Session ROI: +{total_roi:.2f}%")
print(f"New Balance: Rs {10000 + total_pnl:,.0f}")
print()

# DETAILED RULES
print("╔" + "═" * 98 + "╗")
print("║" + " " * 35 + "✅ SCALPING RULES (MUST FOLLOW)" + " " * 30 + "║")
print("╚" + "═" * 98 + "╝")
print()

rules = [
    ("1. ENTRY", [
        "• Only enter when RSI extreme (>70 or <30)",
        "• Confirm with MACD or Moving Average",
        "• Wait for volume confirmation",
        "• Never chase a move - wait for pullback"
    ]),
    ("2. POSITION SIZE", [
        "• Risk exactly 1-2% per trade",
        "• For Rs 10,000: Risk Rs 100-200 max",
        "• Scale in if 2x leverage, never 50x",
        "• Never add to losing position"
    ]),
    ("3. STOP LOSS", [
        "• Place IMMEDIATELY after entry",
        "• Keep it tight: 1-2% below entry",
        "• NEVER move it further away",
        "• Exit at stop - no exceptions"
    ]),
    ("4. TAKE PROFIT", [
        "• Scale out: 50% at TP1, 50% at TP2",
        "• TP1 should be 2x your stop loss",
        "• TP2 should be 3-4x your stop loss",
        "• Move SL to break-even after TP1"
    ]),
    ("5. TIME & DISCIPLINE", [
        "• Scalps: 1-15 minute trades only",
        "• Max 5-10 trades per session",
        "• Stop after 2 consecutive losses",
        "• Don't overtrade - stick to plan"
    ]),
]

for category, details in rules:
    print(f"📌 {category}:")
    for detail in details:
        print(f"   {detail}")
    print()

print("⚠️  CRITICAL WARNINGS:")
print()
print("❌ NEVER:")
print("   • Use 50x leverage (use 2-5x max)")
print("   • Hold overnight with scalps")
print("   • Average down losses")
print("   • Trade without stop loss")
print("   • Risk more than 2% per trade")
print()

print("=" * 100)
print("⚠️  DISCLAIMER: This is EDUCATIONAL content for learning purposes ONLY.")
print("    NOT financial advice. Past performance ≠ future results.")
print("    Always practice on demo before risking real money!")
print("=" * 100)
