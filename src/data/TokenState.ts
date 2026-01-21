/**
 * Token State Management
 * Stores historical snapshots for each token to detect dormant state and spikes
 */

import { TokenPair } from '../services/DexScreenerService';

export interface TokenSnapshot {
  timestamp: number;
  price: number;
  marketCap: number;
  volume5m: number;
  volume24h: number;
  liquidity: number;
  priceChange5m: number;
  priceChange24h: number;
}

export interface TokenState {
  tokenAddress: string;
  baseTokenSymbol: string;
  baseTokenName: string;
  pairAddress: string;
  snapshots: TokenSnapshot[];
  lastAlertTimestamp: {
    tier25?: number;
    tier50?: number;
  };
  lastSeenActive: number; // Timestamp when token was last active
  currentPair?: TokenPair; // Latest pair data
}

/**
 * Token State Manager
 * Manages historical state for all tracked tokens
 */
export class TokenStateManager {
  private tokens: Map<string, TokenState> = new Map();
  private readonly maxSnapshotsPerToken = 144; // Keep last 144 snapshots (24 hours @ 10 min intervals)

  /**
   * Get or create token state
   */
  getTokenState(tokenAddress: string): TokenState | undefined {
    return this.tokens.get(tokenAddress);
  }

  /**
   * Create or update token state with new snapshot
   */
  updateTokenState(
    tokenAddress: string,
    pair: TokenPair,
    snapshot: TokenSnapshot
  ): void {
    let state = this.tokens.get(tokenAddress);

    if (!state) {
      state = {
        tokenAddress,
        baseTokenSymbol: pair.baseToken.symbol,
        baseTokenName: pair.baseToken.name,
        pairAddress: pair.pairAddress,
        snapshots: [],
        lastAlertTimestamp: {},
        lastSeenActive: Date.now(),
        currentPair: pair,
      };
      this.tokens.set(tokenAddress, state);
    }

    // Update current pair
    state.currentPair = pair;

    // Add new snapshot
    state.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (state.snapshots.length > this.maxSnapshotsPerToken) {
      state.snapshots.shift(); // Remove oldest
    }

    // Update last seen active if token shows activity
    if (snapshot.volume5m > 0 || Math.abs(snapshot.priceChange5m) > 1) {
      state.lastSeenActive = snapshot.timestamp;
    }
  }

  /**
   * Get recent snapshots within a time window
   */
  getSnapshotsInWindow(
    tokenAddress: string,
    windowMinutes: number
  ): TokenSnapshot[] {
    const state = this.tokens.get(tokenAddress);
    if (!state) return [];

    const cutoffTime = Date.now() - windowMinutes * 60 * 1000;
    return state.snapshots.filter((snapshot) => snapshot.timestamp >= cutoffTime);
  }

  /**
   * Check if token has been in dormant state
   */
  isDormant(
    tokenAddress: string,
    volatilityThreshold: number,
    volumeThreshold: number,
    baselineMinutes: number
  ): boolean {
    const snapshots = this.getSnapshotsInWindow(tokenAddress, baselineMinutes);

    if (snapshots.length < 3) {
      // Need at least 3 snapshots to determine dormant state
      return false;
    }

    // Calculate price volatility (max - min price change)
    const prices = snapshots.map((s) => s.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const volatility = avgPrice > 0 ? ((maxPrice - minPrice) / avgPrice) * 100 : 0;

    // Calculate total volume
    const totalVolume = snapshots.reduce((sum, s) => sum + s.volume5m, 0);

    // Calculate market cap change
    const marketCapChange = snapshots.length > 1
      ? Math.abs(snapshots[snapshots.length - 1].marketCap - snapshots[0].marketCap)
      : 0;
    const avgMarketCap = snapshots.reduce((sum, s) => sum + s.marketCap, 0) / snapshots.length;
    const marketCapVolatility = avgMarketCap > 0
      ? (marketCapChange / avgMarketCap) * 100
      : 0;

    // Token is dormant if:
    // 1. Low price volatility
    // 2. Low volume
    // 3. Low market cap change
    return (
      volatility <= volatilityThreshold &&
      totalVolume <= volumeThreshold &&
      marketCapVolatility <= volatilityThreshold
    );
  }

  /**
   * Record alert timestamp to enforce cooldown
   */
  recordAlert(tokenAddress: string, tier: 'tier25' | 'tier50'): void {
    const state = this.tokens.get(tokenAddress);
    if (state) {
      state.lastAlertTimestamp[tier] = Date.now();
    }
  }

  /**
   * Check if token is in cooldown period
   */
  isInCooldown(tokenAddress: string, tier: 'tier25' | 'tier50', cooldownMs: number): boolean {
    const state = this.tokens.get(tokenAddress);
    if (!state || !state.lastAlertTimestamp[tier]) {
      return false;
    }

    const timeSinceLastAlert = Date.now() - state.lastAlertTimestamp[tier];
    return timeSinceLastAlert < cooldownMs;
  }

  /**
   * Get all tracked token addresses
   */
  getAllTokenAddresses(): string[] {
    return Array.from(this.tokens.keys());
  }

  /**
   * Remove old tokens that haven't been seen in a while (cleanup)
   */
  cleanupOldTokens(maxAgeHours: number): void {
    const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const tokensToRemove: string[] = [];

    this.tokens.forEach((state, address) => {
      if (state.lastSeenActive < cutoffTime) {
        tokensToRemove.push(address);
      }
    });

    tokensToRemove.forEach((address) => this.tokens.delete(address));
  }

  /**
   * Get token count
   */
  getTokenCount(): number {
    return this.tokens.size;
  }
}
