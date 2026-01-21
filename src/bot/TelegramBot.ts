import TelegramBotApi from 'node-telegram-bot-api';
import { Config } from '../utils/Config';
import { AlertFormatter } from './AlertFormatter';
import { SpikeAlert } from '../detector/SpikeDetector';
import { DexScreenerService } from '../services/DexScreenerService';
import { TokenUniverseManager } from '../detector/TokenUniverseManager';
import { TokenStateManager } from '../data/TokenState';

export class TelegramBot {
  private bot: TelegramBotApi;
  private config: Config;
  private alertFormatter: AlertFormatter;
  private authorizedChatIds: Set<number> = new Set();
  private tokenUniverseManager?: TokenUniverseManager;
  private tokenStateManager?: TokenStateManager;
  private dexScreenerService: DexScreenerService;

  constructor(token: string, dexScreenerService: DexScreenerService) {
    this.bot = new TelegramBotApi(token, { polling: true });
    this.config = Config.getInstance();
    this.alertFormatter = new AlertFormatter(dexScreenerService);
    this.dexScreenerService = dexScreenerService;
    this.setupCommands();
  }

  /**
   * Set token managers for /tokens command
   */
  setTokenManagers(
    tokenUniverseManager: TokenUniverseManager,
    tokenStateManager: TokenStateManager
  ): void {
    this.tokenUniverseManager = tokenUniverseManager;
    this.tokenStateManager = tokenStateManager;
  }

  private setupCommands(): void {
    // /start command
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.authorizedChatIds.add(chatId);
      const welcomeText = `
🤖 <b>Solana Dormant Token Spike Detector</b>

Welcome! I monitor dormant Solana tokens for sudden price breakouts.

I detect:
• +25% price spikes within 5 minutes
• +50% price spikes within 5 minutes

All alerts include token details, market data, and trading links.

Use /help to see all available commands.
      `.trim();
      this.bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
    });

    // /help command
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const helpText = `
📚 <b>Available Commands:</b>

/start - Start the bot
/status - Show current configuration
/tokens - Show all tracked tokens
/threshold - Enable or disable 25% / 50% alerts
/age - Set minimum token age filter
/pause - Pause alerting
/resume - Resume alerting
/help - Display this help message

<b>Usage Examples:</b>
/threshold 25 on - Enable 25% alerts
/threshold 50 off - Disable 50% alerts
/age 6 - Set minimum age to 6 hours
      `.trim();
      this.bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
    });

    // /status command
    this.bot.onText(/\/status/, (msg) => {
      const chatId = msg.chat.id;
      const statusText = this.config.formatForDisplay();
      this.bot.sendMessage(chatId, statusText, { parse_mode: 'HTML' });
    });

    // /threshold command
    this.bot.onText(/\/threshold(?:\s+(\d+))?(?:\s+(on|off))?/i, (msg, match) => {
      const chatId = msg.chat.id;
      
      if (!match || !match[1] || !match[2]) {
        const currentStatus = `
📊 <b>Current Alert Thresholds:</b>
• 25% alerts: ${this.config.alertThreshold25 ? '✅ Enabled' : '❌ Disabled'}
• 50% alerts: ${this.config.alertThreshold50 ? '✅ Enabled' : '❌ Disabled'}

<b>Usage:</b> /threshold [25|50] [on|off]
<b>Examples:</b>
/threshold 25 on - Enable 25% alerts
/threshold 50 off - Disable 50% alerts
        `.trim();
        this.bot.sendMessage(chatId, currentStatus, { parse_mode: 'HTML' });
        return;
      }

      const tier = match[1] as '25' | '50';
      const action = match[2].toLowerCase();
      const enabled = action === 'on';

      if (tier !== '25' && tier !== '50') {
        this.bot.sendMessage(chatId, '❌ Invalid tier. Use 25 or 50.');
        return;
      }

      this.config.setAlertThreshold(tier, enabled);
      const status = enabled ? '✅ enabled' : '❌ disabled';
      this.bot.sendMessage(chatId, `✅ ${tier}% alerts ${status}.`);
    });

    // /age command
    this.bot.onText(/\/age(?:\s+(\d+))?/i, (msg, match) => {
      const chatId = msg.chat.id;

      if (!match || !match[1]) {
        const currentAge = this.config.minTokenAgeHours;
        const ageText = `
⏰ <b>Current Minimum Token Age:</b> ${currentAge} hour(s)

<b>Usage:</b> /age [hours]
<b>Examples:</b>
/age 1 - Set to 1 hour
/age 6 - Set to 6 hours
/age 24 - Set to 24 hours
        `.trim();
        this.bot.sendMessage(chatId, ageText, { parse_mode: 'HTML' });
        return;
      }

      const hours = parseInt(match[1], 10);
      
      if (isNaN(hours) || hours < 0) {
        this.bot.sendMessage(chatId, '❌ Invalid age. Please provide a valid number of hours.');
        return;
      }

      try {
        this.config.setMinTokenAge(hours);
        this.bot.sendMessage(chatId, `✅ Minimum token age set to ${hours} hour(s).`);
      } catch (error: any) {
        this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      }
    });

    // /pause command
    this.bot.onText(/\/pause/, (msg) => {
      const chatId = msg.chat.id;
      this.config.pause();
      this.bot.sendMessage(chatId, '⏸ Alerting paused. Use /resume to continue.');
    });

    // /resume command
    this.bot.onText(/\/resume/, (msg) => {
      const chatId = msg.chat.id;
      this.config.resume();
      this.bot.sendMessage(chatId, '▶️ Alerting resumed.');
    });

    // /tokens command
    this.bot.onText(/\/tokens/, async (msg) => {
      const chatId = msg.chat.id;
      await this.handleTokensCommand(chatId);
    });

    // Error handling
    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error);
    });

    this.bot.on('error', (error) => {
      console.error('Telegram bot error:', error);
    });
  }

  /**
   * Send spike alert to all authorized chats
   */
  async sendAlert(alert: SpikeAlert): Promise<void> {
    if (this.config.isPaused) {
      return; // Bot is paused, don't send alerts
    }

    const message = this.alertFormatter.formatAlert(alert);
    const promises: Promise<any>[] = [];

    // Send to all authorized chats
    this.authorizedChatIds.forEach((chatId) => {
      promises.push(
        this.bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }).catch((error) => {
          console.error(`Error sending alert to chat ${chatId}:`, error);
        })
      );
    });

    await Promise.allSettled(promises);
  }

  /**
   * Send multiple alerts
   */
  async sendMultipleAlerts(alerts: SpikeAlert[]): Promise<void> {
    if (alerts.length === 0 || this.config.isPaused) {
      return;
    }

    // Send each alert separately for better formatting
    for (const alert of alerts) {
      await this.sendAlert(alert);
      // Small delay between alerts to avoid rate limiting
      await this.delay(500);
    }
  }

  /**
   * Send informational message
   */
  async sendMessage(chatId: number, message: string): Promise<void> {
    await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  }

  /**
   * Handle /tokens command - show all tracked tokens
   */
  private async handleTokensCommand(chatId: number): Promise<void> {
    if (!this.tokenUniverseManager || !this.tokenStateManager) {
      this.bot.sendMessage(chatId, '❌ Token tracking not initialized yet.');
      return;
    }

    const trackedTokens = this.tokenUniverseManager.getTrackedTokens();

    if (trackedTokens.length === 0) {
      this.bot.sendMessage(
        chatId,
        '📭 No tokens are currently being tracked.\n\nTokens will be discovered automatically from Pump and Bonk launchpads.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Send loading message
    const loadingMsg = await this.bot.sendMessage(chatId, '⏳ Fetching token information...');

    try {
      // Fetch current data for all tokens (in batches to avoid rate limits)
      const tokenInfo: Array<{
        address: string;
        symbol: string;
        name: string;
        chainId: string;
        dexId: string;
        price: number;
        marketCap: number;
        priceChange5m: number;
        priceChange1h: number;
        priceChange24h: number;
        volume5m: number;
        volume24h: number;
        liquidity: number;
        pairCreatedAt?: number;
        url: string;
        jupiterUrl: string;
      }> = [];

      const batchSize = 10;
      for (let i = 0; i < trackedTokens.length; i += batchSize) {
        const batch = trackedTokens.slice(i, i + batchSize);

        try {
          const pairs = await this.dexScreenerService.getMultipleTokenPairs(batch);

          for (const pair of pairs) {
            const tokenAddress = pair.baseToken.address;
            const priceChange5m = pair.priceChange?.['m5'] || 0;
            const priceChange1h = pair.priceChange?.['h1'] || 0;
            const priceChange24h = pair.priceChange?.['h24'] || 0;
            const volume5m = pair.volume?.['m5'] || 0;
            const volume24h = pair.volume?.['h24'] || 0;
            const liquidity = pair.liquidity?.usd || 0;

            tokenInfo.push({
              address: tokenAddress,
              symbol: pair.baseToken.symbol,
              name: pair.baseToken.name,
              chainId: pair.chainId || 'unknown',
              dexId: pair.dexId || 'unknown',
              price: parseFloat(pair.priceUsd) || 0,
              marketCap: pair.fdv || 0,
              priceChange5m,
              priceChange1h,
              priceChange24h,
              volume5m,
              volume24h,
              liquidity,
              pairCreatedAt: pair.pairCreatedAt,
              url: this.dexScreenerService.getDexScreenerUrl(pair),
              jupiterUrl: this.dexScreenerService.getJupiterUrl(tokenAddress),
            });
          }

          // Small delay between batches
          if (i + batchSize < trackedTokens.length) {
            await this.delay(500);
          }
        } catch (error) {
          console.error(`Error fetching batch ${i}:`, error);
        }
      }

      if (tokenInfo.length === 0) {
        await this.bot.editMessageText(
          '📭 No token data available at the moment.',
          {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
          }
        );
        return;
      }

      // Sort by market cap (highest first)
      tokenInfo.sort((a, b) => b.marketCap - a.marketCap);

      // Telegram message limit is 4096 characters
      // We'll split into multiple messages if needed
      const MAX_MESSAGE_LENGTH = 4000; // Leave some buffer
      
      // Delete the loading message first
      try {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      } catch (error) {
        // Ignore if message already deleted or doesn't exist
      }

      // Format and send messages in chunks
      let messageIndex = 0;
      let currentMessage = '';
      
      for (let i = 0; i < tokenInfo.length; i++) {
        const token = tokenInfo[i];
        const priceChange5mEmoji = token.priceChange5m >= 0 ? '📈' : '📉';
        const priceChange1hEmoji = token.priceChange1h >= 0 ? '📈' : '📉';
        const priceChange24hEmoji = token.priceChange24h >= 0 ? '📈' : '📉';
        const priceChange5mSign = token.priceChange5m >= 0 ? '+' : '';
        const priceChange1hSign = token.priceChange1h >= 0 ? '+' : '';
        const priceChange24hSign = token.priceChange24h >= 0 ? '+' : '';
        const shortAddress = `${token.address.substring(0, 8)}...${token.address.substring(token.address.length - 6)}`;

        // Calculate token age if available
        let ageInfo = '';
        if (token.pairCreatedAt) {
          const ageHours = (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60);
          if (ageHours < 24) {
            ageInfo = `⏰ Age: ${ageHours.toFixed(1)}h`;
          } else {
            const ageDays = ageHours / 24;
            ageInfo = `⏰ Age: ${ageDays.toFixed(1)}d`;
          }
        }

        // Build token block
        let tokenBlock = `━━━━━━━━━━━━━━━━━━━━\n`;
        tokenBlock += `${i + 1}. <b>${token.symbol}</b> - ${token.name}\n`;
        tokenBlock += `━━━━━━━━━━━━━━━━━━━━\n`;
        tokenBlock += `🌐 <b>Chain:</b> ${token.chainId.toUpperCase()}\n`;
        tokenBlock += `🏪 <b>DEX:</b> ${token.dexId}\n`;
        tokenBlock += `💰 <b>Price:</b> $${token.price.toFixed(8)}\n`;
        tokenBlock += `💵 <b>Market Cap:</b> $${token.marketCap.toLocaleString()}\n`;
        tokenBlock += `💧 <b>Liquidity:</b> $${token.liquidity.toLocaleString()}\n\n`;
        
        tokenBlock += `<b>Price Changes:</b>\n`;
        tokenBlock += `  ${priceChange5mEmoji} 5m:  ${priceChange5mSign}${token.priceChange5m.toFixed(2)}%\n`;
        tokenBlock += `  ${priceChange1hEmoji} 1h:  ${priceChange1hSign}${token.priceChange1h.toFixed(2)}%\n`;
        tokenBlock += `  ${priceChange24hEmoji} 24h: ${priceChange24hSign}${token.priceChange24h.toFixed(2)}%\n\n`;
        
        tokenBlock += `<b>Volume:</b>\n`;
        tokenBlock += `  📊 5m:  $${token.volume5m.toLocaleString()}\n`;
        tokenBlock += `  📊 24h: $${token.volume24h.toLocaleString()}\n\n`;
        
        if (ageInfo) {
          tokenBlock += `${ageInfo}\n`;
        }
        
        tokenBlock += `<b>Links:</b>\n`;
        tokenBlock += `  🔗 <a href="${token.url}">DexScreener</a>\n`;
        tokenBlock += `  🪐 <a href="${token.jupiterUrl}">Jupiter</a>\n`;
        tokenBlock += `  📍 <code>${shortAddress}</code>\n\n`;

        // Check if adding this token would exceed the limit
        const header = messageIndex === 0 
          ? `📊 <b>Tracked Tokens (${tokenInfo.length})</b>\n\n`
          : `📊 <b>Tracked Tokens (${tokenInfo.length})</b> - Page ${messageIndex + 1}\n\n`;
        
        const testMessage = messageIndex === 0 
          ? header + currentMessage + tokenBlock
          : header + currentMessage + tokenBlock;

        if (testMessage.length > MAX_MESSAGE_LENGTH && currentMessage.length > 0) {
          // Send current message and start a new one
          const messageToSend = messageIndex === 0
            ? `📊 <b>Tracked Tokens (${tokenInfo.length})</b>\n\n${currentMessage.trim()}`
            : `📊 <b>Tracked Tokens (${tokenInfo.length})</b> - Page ${messageIndex + 1}\n\n${currentMessage.trim()}`;
          
          await this.bot.sendMessage(chatId, messageToSend, {
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          });
          
          // Small delay between messages
          await this.delay(300);
          
          // Start new message
          currentMessage = tokenBlock;
          messageIndex++;
        } else {
          // Add token to current message
          if (currentMessage === '') {
            currentMessage = header;
          }
          currentMessage += tokenBlock;
        }
      }

      // Send remaining message
      if (currentMessage.trim().length > 0) {
        const messageToSend = messageIndex === 0
          ? currentMessage.trim()
          : `📊 <b>Tracked Tokens (${tokenInfo.length})</b> - Page ${messageIndex + 1}\n\n${currentMessage.replace(/^📊.*?\n\n/, '').trim()}`;
        
        await this.bot.sendMessage(chatId, messageToSend, {
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        });
      }
    } catch (error: any) {
      console.error('Error in handleTokensCommand:', error);
      await this.bot.editMessageText(
        '❌ Error fetching token information. Please try again later.',
        {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
        }
      );
    }
  }

  /**
   * Get authorized chat IDs
   */
  getAuthorizedChatIds(): number[] {
    return Array.from(this.authorizedChatIds);
  }

  async start(): Promise<void> {
    console.log('Telegram bot initialized and listening for commands');
  }

  async stop(): Promise<void> {
    this.bot.stopPolling();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
