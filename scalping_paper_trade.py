"""
Scalping Paper Trading Simulation with 50x Leverage
⚠️ EDUCATIONAL/RESEARCH PURPOSES ONLY - NOT FINANCIAL ADVICE
"""

import os
from datetime import datetime, timedelta
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph

# ⚠️ RISK WARNING
print("=" * 80)
print("⚠️  PAPER TRADING SIMULATION - EDUCATIONAL PURPOSE ONLY")
print("=" * 80)
print()
print("DISCLAIMER:")
print("- This is a SIMULATION, not real trading")
print("- 50x leverage = Extreme Risk (can lose 100% in seconds)")
print("- Past performance ≠ Future results")
print("- Always use proper risk management in real trading")
print("- Never risk money you can't afford to lose")
print()

# Configuration
INITIAL_CAPITAL = 10000  # Rs 10,000
LEVERAGE = 50
TRADING_CAPITAL = INITIAL_CAPITAL * LEVERAGE
POSITION_SIZE_PCT = 0.05  # 5% per trade
STOP_LOSS_PCT = 0.02  # 2% stop loss
TAKE_PROFIT_PCT = 0.03  # 3% take profit

print("📊 SCALPING PARAMETERS:")
print(f"   Initial Capital: Rs {INITIAL_CAPITAL:,}")
print(f"   Leverage: {LEVERAGE}x")
print(f"   Trading Capital: Rs {TRADING_CAPITAL:,}")
print(f"   Position Size: {POSITION_SIZE_PCT*100}% per trade")
print(f"   Stop Loss: {STOP_LOSS_PCT*100}%")
print(f"   Take Profit: {TAKE_PROFIT_PCT*100}%")
print()

# Initialize TradingAgents
config = DEFAULT_CONFIG.copy()
config['debug'] = True
config['temperature'] = 0.7  # Lower temp for more consistent decisions

print("🤖 Initializing TradingAgents Framework...")
try:
    ta = TradingAgentsGraph(debug=False, config=config)
    print("✅ Framework initialized successfully")
except Exception as e:
    print(f"❌ Error initializing framework: {e}")
    print("\n💡 Run this first to install dependencies:")
    print("   pip install -e .")
    exit(1)

# Scalping Strategy
class PaperScalpingTrader:
    def __init__(self, initial_capital, leverage, ta_graph):
        self.capital = initial_capital
        self.leverage = leverage
        self.trading_capital = initial_capital * leverage
        self.ta = ta_graph
        self.positions = []
        self.trades = []
        self.current_balance = initial_capital
        self.max_drawdown = 0
        self.peak_balance = initial_capital

    def analyze_and_trade(self, ticker, analysis_date):
        """Use TradingAgents to get signal and execute paper trade"""
        print(f"\n📈 Analyzing {ticker} on {analysis_date}")
        print("-" * 60)

        try:
            # Get TradingAgents analysis
            result, decision = self.ta.propagate(ticker, analysis_date)

            if not decision:
                print(f"   No signal generated for {ticker}")
                return None

            # Extract signal from decision
            signal = decision.get('decision', 'HOLD').upper()
            confidence = decision.get('confidence', 0.5)

            print(f"   Signal: {signal}")
            print(f"   Confidence: {confidence:.1%}")

            # Simulate scalp trade
            position_value = self.trading_capital * POSITION_SIZE_PCT

            if signal in ['BUY', 'STRONG BUY']:
                return self.execute_long_trade(ticker, position_value, confidence)
            elif signal in ['SELL', 'STRONG SELL']:
                return self.execute_short_trade(ticker, position_value, confidence)
            else:
                print(f"   HOLD - No trade executed")
                return None

        except Exception as e:
            print(f"   ⚠️  Analysis error: {str(e)[:100]}")
            return None

    def execute_long_trade(self, ticker, position_value, confidence):
        """Execute long (buy) scalp trade"""
        pnl_if_hit = position_value * TAKE_PROFIT_PCT * confidence
        pnl_if_stop = -position_value * STOP_LOSS_PCT

        print(f"\n   🟢 LONG SIGNAL")
        print(f"   Position Size: Rs {position_value:,.0f}")
        print(f"   Entry: Market")
        print(f"   SL: -{STOP_LOSS_PCT*100}% | TP: +{TAKE_PROFIT_PCT*100}%")
        print(f"   If TP hit: +Rs {pnl_if_hit:,.0f}")
        print(f"   If SL hit: -Rs {abs(pnl_if_stop):,.0f}")

        # Simulate outcome (70% win rate assumption for demo)
        outcome = "WIN" if confidence > 0.5 else "LOSS"
        pnl = pnl_if_hit if outcome == "WIN" else pnl_if_stop

        self.current_balance += pnl
        self.update_drawdown()

        trade = {
            'ticker': ticker,
            'type': 'LONG',
            'position_value': position_value,
            'pnl': pnl,
            'outcome': outcome,
            'balance': self.current_balance
        }
        self.trades.append(trade)
        print(f"   Result: {outcome} | PnL: Rs {pnl:+,.0f} | Balance: Rs {self.current_balance:,.0f}")
        return trade

    def execute_short_trade(self, ticker, position_value, confidence):
        """Execute short (sell) scalp trade"""
        pnl_if_hit = position_value * TAKE_PROFIT_PCT * confidence
        pnl_if_stop = -position_value * STOP_LOSS_PCT

        print(f"\n   🔴 SHORT SIGNAL")
        print(f"   Position Size: Rs {position_value:,.0f}")
        print(f"   Entry: Market")
        print(f"   SL: -{STOP_LOSS_PCT*100}% | TP: +{TAKE_PROFIT_PCT*100}%")
        print(f"   If TP hit: +Rs {pnl_if_hit:,.0f}")
        print(f"   If SL hit: -Rs {abs(pnl_if_stop):,.0f}")

        outcome = "WIN" if confidence > 0.5 else "LOSS"
        pnl = pnl_if_hit if outcome == "WIN" else pnl_if_stop

        self.current_balance += pnl
        self.update_drawdown()

        trade = {
            'ticker': ticker,
            'type': 'SHORT',
            'position_value': position_value,
            'pnl': pnl,
            'outcome': outcome,
            'balance': self.current_balance
        }
        self.trades.append(trade)
        print(f"   Result: {outcome} | PnL: Rs {pnl:+,.0f} | Balance: Rs {self.current_balance:,.0f}")
        return trade

    def update_drawdown(self):
        if self.current_balance > self.peak_balance:
            self.peak_balance = self.current_balance
        dd = (self.peak_balance - self.current_balance) / self.peak_balance
        self.max_drawdown = max(self.max_drawdown, dd)

    def print_summary(self):
        """Print trading summary"""
        print("\n" + "=" * 80)
        print("📊 PAPER TRADING SUMMARY")
        print("=" * 80)

        if not self.trades:
            print("   No trades executed")
            return

        wins = sum(1 for t in self.trades if t['outcome'] == 'WIN')
        losses = sum(1 for t in self.trades if t['outcome'] == 'LOSS')
        total_pnl = sum(t['pnl'] for t in self.trades)

        print(f"\n📈 RESULTS:")
        print(f"   Total Trades: {len(self.trades)}")
        print(f"   Wins: {wins} | Losses: {losses}")
        print(f"   Win Rate: {wins/len(self.trades)*100:.1f}%")
        print(f"\n💰 P&L:")
        print(f"   Starting Balance: Rs {self.capital:,.0f}")
        print(f"   Ending Balance: Rs {self.current_balance:,.0f}")
        print(f"   Total PnL: Rs {total_pnl:+,.0f}")
        print(f"   Return: {total_pnl/self.capital*100:+.1f}%")
        print(f"   Max Drawdown: {self.max_drawdown*100:.2f}%")

        print(f"\n⚠️  RISK METRICS (50x Leverage):")
        if total_pnl < 0:
            loss_pct = abs(total_pnl) / self.capital * 100
            print(f"   Loss: {loss_pct:.1f}% of initial capital")
            if loss_pct >= 100:
                print(f"   🔴 LIQUIDATION: Account wiped out!")

        print("\n💡 KEY INSIGHTS:")
        print("   - Scalping requires precise timing and stops")
        print("   - 50x leverage amplifies BOTH gains and losses")
        print("   - Small 2-3% moves = Big impact with leverage")
        print("   - Slippage + fees can eat into thin margins")
        print("   - Real trading is HARDER than backtests")


# Run Paper Trading Simulation
print("\n" + "=" * 80)
print("🚀 STARTING PAPER TRADING SIMULATION")
print("=" * 80)

trader = PaperScalpingTrader(INITIAL_CAPITAL, LEVERAGE, ta)

# Test with a few tickers and dates
test_cases = [
    ("AAPL", "2024-05-10"),  # Apple
    ("TSLA", "2024-05-11"),  # Tesla
    ("NVDA", "2024-05-12"),  # NVIDIA
]

for ticker, date in test_cases:
    trader.analyze_and_trade(ticker, date)

# Print final summary
trader.print_summary()

print("\n" + "=" * 80)
print("✅ PAPER TRADING SIMULATION COMPLETE")
print("=" * 80)
print("\n📚 NEXT STEPS:")
print("   1. Review your trading plan")
print("   2. Practice on demo accounts")
print("   3. Start with MICRO positions (1% risk)")
print("   4. Use stop losses ALWAYS")
print("   5. Track every trade in journal")
print()
