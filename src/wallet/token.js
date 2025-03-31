import { Connection, PublicKey, clusterApiUrl, Transaction, SystemProgram } from '@solana/web3.js';

// Constants
const JUMPER_TOKEN_STORAGE_KEY = 'jumperGameTokenBalance';

// Token state
let tokenState = {
    balance: 0,
    pendingTokens: 0,
    tokensClaimed: false,
    claimInProgress: false,
    error: null
};

// Event listeners for UI updates
const tokenEventListeners = new Set();

/**
 * Subscribe to token state changes
 * @param {Function} listener - Callback function to be called on state changes
 * @returns {Function} - Function to unsubscribe
 */
export function subscribeToTokenState(listener) {
    tokenEventListeners.add(listener);
    // Immediately invoke with current state
    listener({ ...tokenState });
    
    return () => {
        tokenEventListeners.delete(listener);
    };
}

/**
 * Update token state and notify listeners
 * @param {Object} newState - Partial state to update
 */
function updateTokenState(newState) {
    tokenState = { ...tokenState, ...newState };
    tokenEventListeners.forEach(listener => listener({ ...tokenState }));
}

/**
 * Load token balance from localStorage
 */
export function loadTokenData() {
    try {
        // Load token balance
        const savedBalance = localStorage.getItem(JUMPER_TOKEN_STORAGE_KEY);
        if (savedBalance) {
            updateTokenState({ balance: parseInt(savedBalance) || 0 });
        }
    } catch (error) {
        console.error('Error loading token data:', error);
    }
}

/**
 * Save token balance to localStorage
 */
function saveTokenBalance() {
    try {
        localStorage.setItem(JUMPER_TOKEN_STORAGE_KEY, tokenState.balance.toString());
    } catch (error) {
        console.error('Error saving token balance:', error);
    }
}

/**
 * Add tokens to the pending balance
 * @param {number} amount - Number of tokens to add
 */
export function addPendingTokens(amount) {
    if (amount <= 0) return;
    
    updateTokenState({
        pendingTokens: tokenState.pendingTokens + amount,
        tokensClaimed: false
    });
}

/**
 * Claim pending tokens (add to balance)
 * @param {boolean} isConnected - Whether wallet is connected
 * @returns {Promise<boolean>} - Whether the claim was successful
 */
export async function claimTokens(isConnected) {
    try {
        if (tokenState.pendingTokens <= 0 || tokenState.claimInProgress) {
            return false;
        }
        
        updateTokenState({
            claimInProgress: true,
            error: null
        });
        
        // Wait for animation time
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Add tokens to balance
        const newBalance = tokenState.balance + tokenState.pendingTokens;
        
        updateTokenState({
            balance: newBalance,
            pendingTokens: 0,
            tokensClaimed: true,
            claimInProgress: false
        });
        
        // Save to localStorage
        saveTokenBalance();
        
        return true;
    } catch (error) {
        console.error('Error claiming tokens:', error);
        
        updateTokenState({
            claimInProgress: false,
            error: error.message || 'Failed to claim tokens'
        });
        
        return false;
    }
}

/**
 * Convert in-game coins to tokens
 * @param {number} coins - Number of coins collected
 * @returns {number} - Number of tokens awarded
 */
export function coinsToTokens(coins) {
    return coins * 5; // 5 tokens per coin
}

/**
 * Award tokens for completing a level
 * @param {number} level - Completed level number
 * @returns {number} - Number of tokens awarded
 */
export function awardLevelCompletionTokens(level) {
    const tokensAwarded = 20; // Fixed 20 tokens per level completion
    addPendingTokens(tokensAwarded);
    return tokensAwarded;
}

/**
 * Reset token balance (for testing)
 */
export function resetTokenBalance() {
    updateTokenState({
        balance: 0,
        pendingTokens: 0,
        tokensClaimed: false
    });
    saveTokenBalance();
}

// Initialize on load
loadTokenData();

// Listen for wallet connection changes
let unsubscribeWallet = null;
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        // Import wallet state subscription dynamically to avoid circular dependencies
        import('./wallet.js').then(wallet => {
            unsubscribeWallet = wallet.subscribeToWalletState((walletState) => {
                // We could sync with real token balances here in the future
                // For now, we're just using localStorage
            });
        }).catch(err => {
            console.error('Error importing wallet module:', err);
        });
    });
} 