import dotenv from 'dotenv';
import { TelegramBot } from './bot/TelegramBot';
import { DexScreenerService } from './services/DexScreenerService';
import { SpikeDetectionService } from './services/SpikeDetectionService';

// Load environment variables
dotenv.config();

let spikeDetectionService: SpikeDetectionService | null = null;
let telegramBot: TelegramBot | null = null;

async function main() {
  try {
    // Validate required environment variables
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is required in .env file');
    }

    console.log('🚀 Initializing Solana Dormant Token Spike Detector...\n');

    // Initialize DexScreener service
    const dexScreenerService = new DexScreenerService();

    // Initialize Telegram bot
    telegramBot = new TelegramBot(
      process.env.TELEGRAM_BOT_TOKEN,
      dexScreenerService
    );
    await telegramBot.start();

    // Initialize and start spike detection service
    spikeDetectionService = new SpikeDetectionService(telegramBot);
    
    // Set token managers for /tokens command
    telegramBot.setTokenManagers(
      spikeDetectionService.tokenUniverseManager,
      spikeDetectionService.tokenStateManager
    );
    
    await spikeDetectionService.start();

    console.log('\n✅ Bot started successfully!');
    console.log('📱 Send /start to your bot to begin receiving alerts.\n');

    // Log stats periodically
    setInterval(() => {
      if (spikeDetectionService) {
        const stats = spikeDetectionService.getStats();
        console.log(
          `📊 Stats: ${stats.trackedTokens} tokens tracked, ` +
          `${stats.tokensWithState} with state, ` +
          `Status: ${stats.isPaused ? 'PAUSED' : 'RUNNING'}`
        );
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  } catch (error: any) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

  if (spikeDetectionService) {
    await spikeDetectionService.stop();
  }

  if (telegramBot) {
    await telegramBot.stop();
  }

  console.log('✅ Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

main();
