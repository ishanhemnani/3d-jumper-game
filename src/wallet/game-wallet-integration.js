// Game state for token tracking
let gameTokens = {
    coinsCollectedThisLevel: 0,
    tokensAwardedThisLevel: 0,
    levelsCompleted: 0
};

// Module cache
let tokenModule = null;
let walletUIModule = null;
let hasInitialized = false;

/**
 * Initialize the wallet integration with the game
 * @param {Object} gameInstance - Reference to the game instance or API
 */
export function initWalletGameIntegration(gameInstance) {
    if (hasInitialized) return;
    
    console.log('Initializing wallet integration with game');
    
    // Load modules dynamically to avoid circular dependencies
    Promise.all([
        import('./token.js'),
        import('./wallet-ui.js')
    ]).then(([token, walletUI]) => {
        tokenModule = token;
        walletUIModule = walletUI;
        
        // Add wallet UI to the game once it's loaded
        if (document.readyState === 'complete') {
            initializeWalletUI();
        } else {
            window.addEventListener('load', initializeWalletUI);
        }
        
        // Listen for coin collection events
        document.addEventListener('coin_collected', handleCoinCollected);
        
        // Listen for level completion events
        document.addEventListener('level_completed', handleLevelCompleted);
        
        hasInitialized = true;
    }).catch(error => {
        console.error('Error loading wallet integration modules:', error);
    });
}

/**
 * Initialize the wallet UI
 */
function initializeWalletUI() {
    if (walletUIModule) {
        walletUIModule.initWalletUI();
    }
}

/**
 * Handle coin collection event
 * @param {CustomEvent} event - Coin collection event with coin details
 */
function handleCoinCollected(event) {
    if (!tokenModule) return;
    
    const coinValue = event.detail.value || 1;
    gameTokens.coinsCollectedThisLevel += coinValue;
    
    // Convert coins to tokens (5 tokens per coin)
    const tokensAwarded = tokenModule.coinsToTokens(coinValue);
    gameTokens.tokensAwardedThisLevel += tokensAwarded;
    
    // Add tokens to pending balance
    tokenModule.addPendingTokens(tokensAwarded);
    
    // Show notification
    if (walletUIModule) {
        walletUIModule.showTokenNotification(tokensAwarded);
    }
}

/**
 * Handle level completion event
 * @param {CustomEvent} event - Level completion event with level details
 */
function handleLevelCompleted(event) {
    if (!tokenModule || !walletUIModule) return;
    
    const level = event.detail.level || 1;
    gameTokens.levelsCompleted++;
    
    // Award tokens for level completion (20 tokens per level)
    const levelCompletionTokens = tokenModule.awardLevelCompletionTokens(level);
    
    // Show notification for level completion tokens
    setTimeout(() => {
        walletUIModule.showTokenNotification(levelCompletionTokens);
    }, 1000);
    
    // Reset level tracking
    gameTokens.coinsCollectedThisLevel = 0;
    gameTokens.tokensAwardedThisLevel = 0;
}

/**
 * Convert a collected coin to tokens
 * @param {number} coinValue - Value of the coin collected
 * @returns {number} - Number of tokens awarded
 */
export function convertCoinToTokens(coinValue = 1) {
    if (!tokenModule || !walletUIModule) return 0;
    
    const tokensAwarded = tokenModule.coinsToTokens(coinValue);
    tokenModule.addPendingTokens(tokensAwarded);
    walletUIModule.showTokenNotification(tokensAwarded);
    return tokensAwarded;
}

// Export the interface for the game to use
export const walletGameInterface = {
    convertCoinToTokens
}; 