/**
 * Token Universe Manager
 * Discovers and maintains a list of eligible tokens from Pump and Bonk launchpads
 */

import { DexScreenerService, TokenPair } from '../services/DexScreenerService';
import { Config } from '../utils/Config';

export class TokenUniverseManager {
  private dexScreenerService: DexScreenerService;
  private config: Config;
  private trackedTokens: Set<string> = new Set();

  constructor(dexScreenerService: DexScreenerService) {
    this.dexScreenerService = dexScreenerService;
    this.config = Config.getInstance();
  }

  /**
   * Discover new tokens from Pump, Bonk, and Bags launchpads
   * This searches for pairs that might be from these launchpads
   */
  async discoverTokens(): Promise<string[]> {
    const discoveredTokens: string[] = [];

    try {
      // Search for Pump.fun tokens (common pattern: search for pump-related queries)
      // Note: This is a heuristic approach. You may need to refine based on actual API responses
      const pumpSearchTerms = ['pump', 'PUMP'];
      for (const term of pumpSearchTerms) {
        try {
          const pairs = await this.dexScreenerService.searchPairs(term);
          const eligiblePairs = this.filterEligiblePairs(pairs);

          for (const pair of eligiblePairs) {
            const address = pair.baseToken.address;
            if (!this.trackedTokens.has(address)) {
              discoveredTokens.push(address);
              this.trackedTokens.add(address);
            }
          }

          // Rate limit protection
          await this.delay(500);
        } catch (error) {
          console.error(`Error searching for ${term}:`, error);
        }
      }

      // Search for Bonk tokens
      try {
        const bonkPairs = await this.dexScreenerService.searchPairs('bonk');
        const eligiblePairs = this.filterEligiblePairs(bonkPairs);

        for (const pair of eligiblePairs) {
          const address = pair.baseToken.address;
          if (!this.trackedTokens.has(address)) {
            discoveredTokens.push(address);
            this.trackedTokens.add(address);
          }
        }

        // Rate limit protection
        await this.delay(500);
      } catch (error) {
        console.error('Error searching for BONK tokens:', error);
      }

      // Search for Bags tokens
      try {
        const bagsPairs = await this.dexScreenerService.searchPairs('bags');
        const eligiblePairs = this.filterEligiblePairs(bagsPairs);

        for (const pair of eligiblePairs) {
          const address = pair.baseToken.address;
          if (!this.trackedTokens.has(address)) {
            discoveredTokens.push(address);
            this.trackedTokens.add(address);
          }
        }
      } catch (error) {
        console.error('Error searching for BAGS tokens:', error);
      }
    } catch (error) {
      console.error('Error in discoverTokens:', error);
    }

    return discoveredTokens;
  }

  /**
   * Filter pairs based on eligibility criteria
   */
  private filterEligiblePairs(pairs: TokenPair[]): TokenPair[] {
    return pairs.filter((pair) => {
      // Check market cap
      const marketCap = pair.fdv || 0;
      if (marketCap >= this.config.maxMarketCap || marketCap === 0) {
        return false;
      }

      // Check if from Pump, Bonk, or Bags (heuristic check)
      if (!this.dexScreenerService.isFromPumpOrBonk(pair)) {
        return false;
      }

      // Check if pair has necessary data
      if (!pair.priceUsd || parseFloat(pair.priceUsd) <= 0) {
        return false;
      }

      // Check age if pair creation timestamp is available
      if (pair.pairCreatedAt) {
        const ageHours = (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60);
        if (ageHours < this.config.minTokenAgeHours) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Add token to tracking list
   */
  addToken(tokenAddress: string): void {
    this.trackedTokens.add(tokenAddress);
  }

  /**
   * Remove token from tracking list
   */
  removeToken(tokenAddress: string): void {
    this.trackedTokens.delete(tokenAddress);
  }

  /**
   * Get all tracked token addresses
   */
  getTrackedTokens(): string[] {
    return Array.from(this.trackedTokens);
  }

  /**
   * Check if token is being tracked
   */
  isTracked(tokenAddress: string): boolean {
    return this.trackedTokens.has(tokenAddress);
  }

  /**
   * Update token eligibility (re-check filters)
   */
  async updateTokenEligibility(tokenAddress: string): Promise<boolean> {
    try {
      const pairs = await this.dexScreenerService.getTokenPairs(tokenAddress);
      const eligiblePairs = this.filterEligiblePairs(pairs);

      if (eligiblePairs.length > 0) {
        if (!this.trackedTokens.has(tokenAddress)) {
          this.trackedTokens.add(tokenAddress);
        }
        return true;
      } else {
        // Token no longer meets criteria
        this.trackedTokens.delete(tokenAddress);
        return false;
      }
    } catch (error) {
      console.error(`Error updating eligibility for ${tokenAddress}:`, error);
      return false;
    }
  }

  /**
   * Get count of tracked tokens
   */
  getTrackedTokenCount(): number {
    return this.trackedTokens.size;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
