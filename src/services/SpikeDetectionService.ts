/**
 * Main Spike Detection Service
 * Orchestrates token discovery, monitoring, and spike detection
 */

import { DexScreenerService } from './DexScreenerService';
import { TokenUniverseManager } from '../detector/TokenUniverseManager';
import { TokenStateManager } from '../data/TokenState';
import { SpikeDetector } from '../detector/SpikeDetector';
import { TelegramBot } from '../bot/TelegramBot';
import { Config } from '../utils/Config';
import { ErrorHandler } from '../utils/ErrorHandler';
import { RateLimiter } from '../utils/RateLimiter';
import { SpikeAlert } from '../detector/SpikeDetector';

export class SpikeDetectionService {
  public readonly dexScreenerService: DexScreenerService;
  public readonly tokenUniverseManager: TokenUniverseManager;
  public readonly tokenStateManager: TokenStateManager;
  private spikeDetector: SpikeDetector;
  private telegramBot: TelegramBot;
  private config: Config;
  private rateLimiter: RateLimiter;

  private monitoringInterval?: NodeJS.Timeout;
  private discoveryInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  private isRunning = false;

  constructor(telegramBot: TelegramBot) {
    this.dexScreenerService = new DexScreenerService();
    this.tokenUniverseManager = new TokenUniverseManager(this.dexScreenerService);
    this.tokenStateManager = new TokenStateManager();
    this.spikeDetector = new SpikeDetector(this.tokenStateManager);
    this.telegramBot = telegramBot;
    this.config = Config.getInstance();
    
    // Rate limiter: 250 requests per minute (safely under 300 limit)
    this.rateLimiter = new RateLimiter(250, 60 * 1000);
  }

  /**
   * Start the spike detection service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Service is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting Spike Detection Service...');

    // Initial token discovery
    await this.discoverTokens();

    // Start monitoring loop (check for spikes)
    this.startMonitoringLoop();

    // Start periodic token discovery (every 1 hour)
    this.startDiscoveryLoop();

    // Start periodic cleanup (every 6 hours)
    this.startCleanupLoop();

    console.log('✅ Spike Detection Service started successfully');
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('🛑 Stopping Spike Detection Service...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    console.log('✅ Spike Detection Service stopped');
  }

  /**
   * Main monitoring loop - checks for spikes
   */
  private startMonitoringLoop(): void {
    const monitor = async () => {
      if (this.config.isPaused) {
        return; // Skip if paused
      }

      try {
        await this.monitorTokens();
      } catch (error) {
        console.error('Error in monitoring loop:', error);
      }
    };

    // Run immediately, then on interval
    monitor();
    this.monitoringInterval = setInterval(monitor, this.config.pollingIntervalMs);
  }

  /**
   * Monitor all tracked tokens for spikes
   */
  private async monitorTokens(): Promise<void> {
    const trackedTokens = this.tokenUniverseManager.getTrackedTokens();
    
    if (trackedTokens.length === 0) {
      console.log('No tokens tracked yet. Waiting for discovery...');
      return;
    }

    console.log(`📊 Monitoring ${trackedTokens.length} tokens for spikes...`);

    // Process tokens in batches to respect rate limits
    const batchSize = 30; // Max tokens per API request
    const allAlerts: SpikeAlert[] = [];

    for (let i = 0; i < trackedTokens.length; i += batchSize) {
      const batch = trackedTokens.slice(i, i + batchSize);

      try {
        // Wait for rate limit availability
        await this.rateLimiter.waitForAvailability();

        // Fetch pairs for batch
        const pairs = await ErrorHandler.retry(
          () => this.dexScreenerService.getMultipleTokenPairs(batch),
          3,
          1000,
          (error) => ErrorHandler.handleApiError(error, 'monitorTokens')
        );

        this.rateLimiter.recordRequest();

        // Check for spikes
        const alerts = this.spikeDetector.checkMultiplePairs(pairs);
        allAlerts.push(...alerts);

        // Small delay between batches
        await this.delay(200);
      } catch (error: any) {
        ErrorHandler.handleApiError(error, `monitorTokens batch ${i}`);
      }
    }

    // Send alerts
    if (allAlerts.length > 0) {
      console.log(`🚨 Detected ${allAlerts.length} spike(s)!`);
      await this.telegramBot.sendMultipleAlerts(allAlerts);
    } else {
      console.log('✅ No spikes detected in this cycle');
    }

    // Log statistics
    console.log(`📈 Stats: ${trackedTokens.length} tokens tracked, ${this.tokenStateManager.getTokenCount()} tokens with state`);
  }

  /**
   * Discover new tokens periodically
   */
  private startDiscoveryLoop(): void {
    const discover = async () => {
      try {
        await this.discoverTokens();
      } catch (error) {
        console.error('Error in discovery loop:', error);
      }
    };

    // Don't run immediately - initial discovery already happened in start()
    // Just set up the interval to run every hour
    this.discoveryInterval = setInterval(discover, 60 * 60 * 1000);
  }

  /**
   * Discover new tokens from Pump and Bonk launchpads
   */
  private async discoverTokens(): Promise<void> {
    console.log('🔍 Discovering new tokens...');

    try {
      const discoveredTokens = await ErrorHandler.retry(
        () => this.tokenUniverseManager.discoverTokens(),
        2,
        2000,
        (error) => ErrorHandler.handleApiError(error, 'discoverTokens')
      );

      console.log(`✅ Discovered ${discoveredTokens.length} new eligible tokens`);

      // Update eligibility for existing tokens
      const existingTokens = this.tokenUniverseManager.getTrackedTokens();
      let updatedCount = 0;

      for (const tokenAddress of existingTokens) {
        try {
          const stillEligible = await this.tokenUniverseManager.updateTokenEligibility(tokenAddress);
          if (!stillEligible) {
            updatedCount++;
          }
        } catch (error) {
          // Skip errors for individual tokens
        }
      }

      if (updatedCount > 0) {
        console.log(`🔄 Removed ${updatedCount} tokens that no longer meet criteria`);
      }
    } catch (error) {
      console.error('Error discovering tokens:', error);
    }
  }

  /**
   * Cleanup old token states periodically
   */
  private startCleanupLoop(): void {
    const cleanup = () => {
      try {
        // Remove tokens that haven't been seen in 24 hours
        this.tokenStateManager.cleanupOldTokens(24);
        console.log('🧹 Cleanup completed');
      } catch (error) {
        console.error('Error in cleanup:', error);
      }
    };

    // Run every 6 hours
    this.cleanupInterval = setInterval(cleanup, 6 * 60 * 60 * 1000);
  }

  /**
   * Get service statistics
   */
  getStats(): {
    trackedTokens: number;
    tokensWithState: number;
    isRunning: boolean;
    isPaused: boolean;
  } {
    return {
      trackedTokens: this.tokenUniverseManager.getTrackedTokenCount(),
      tokensWithState: this.tokenStateManager.getTokenCount(),
      isRunning: this.isRunning,
      isPaused: this.config.isPaused,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
