// Polyfill Buffer for browser compatibility
if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || require('buffer').Buffer;
}

// Import necessary Solana modules
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

// Simplified wallet adapter for browser compatibility
class PhantomWalletAdapter {
    constructor() {
        this.name = 'phantom';
        this._publicKey = null;
        this._connected = false;
        this._eventListeners = {
            'connect': [],
            'disconnect': [],
            'error': []
        };
    }

    get publicKey() {
        return this._publicKey;
    }

    get connected() {
        return this._connected;
    }

    async connect() {
        try {
            if (typeof window === 'undefined' || !window.solana) {
                throw new Error('Phantom wallet not available');
            }

            await window.solana.connect();
            this._publicKey = window.solana.publicKey;
            this._connected = true;
            this._emit('connect');
            return this._publicKey;
        } catch (error) {
            this._emit('error', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (typeof window !== 'undefined' && window.solana) {
                await window.solana.disconnect();
            }
            this._publicKey = null;
            this._connected = false;
            this._emit('disconnect');
        } catch (error) {
            this._emit('error', error);
            throw error;
        }
    }

    on(event, callback) {
        if (this._eventListeners[event]) {
            this._eventListeners[event].push(callback);
        }
    }

    _emit(event, ...args) {
        if (this._eventListeners[event]) {
            this._eventListeners[event].forEach(listener => listener(...args));
        }
    }
}

// Constants
const SOLANA_NETWORK = 'devnet';
const WALLET_STORAGE_KEY = 'jumperGameWalletConnection';

// Wallet state
let walletAdapter = null;
let walletState = {
    connected: false,
    publicKey: null,
    balance: 0,
    connectionPending: false,
    error: null,
    walletName: null
};

// Event listeners for UI updates
const walletEventListeners = new Set();

/**
 * Subscribe to wallet state changes
 * @param {Function} listener - Callback function to be called on state changes
 * @returns {Function} - Function to unsubscribe
 */
export function subscribeToWalletState(listener) {
    walletEventListeners.add(listener);
    // Immediately invoke with current state
    listener(walletState);
    
    return () => {
        walletEventListeners.delete(listener);
    };
}

/**
 * Update wallet state and notify listeners
 * @param {Object} newState - Partial state to update
 */
function updateWalletState(newState) {
    walletState = { ...walletState, ...newState };
    walletEventListeners.forEach(listener => listener(walletState));
}

/**
 * Initialize wallet adapter for the specified wallet type
 * @param {string} walletType - 'phantom' or 'solflare'
 */
function initializeWalletAdapter(walletType) {
    if (walletType === 'phantom') {
        walletAdapter = new PhantomWalletAdapter();
    } else if (walletType === 'solflare') {
        // Using PhantomWalletAdapter as placeholder - would use SolflareWalletAdapter in production
        walletAdapter = new PhantomWalletAdapter();
    } else {
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }

    // Set up event listeners
    walletAdapter.on('connect', onConnect);
    walletAdapter.on('disconnect', onDisconnect);
    walletAdapter.on('error', onError);

    return walletAdapter;
}

/**
 * Handle successful connection
 */
async function onConnect() {
    try {
        const publicKey = walletAdapter.publicKey.toString();
        console.log(`Wallet connected: ${publicKey}`);
        
        // Get wallet balance (simplified for now)
        const balance = 0; // We'll use a mock balance
        
        // Update state
        updateWalletState({
            connected: true,
            publicKey: publicKey,
            balance: balance,
            connectionPending: false,
            error: null
        });
        
        // Save connection info to localStorage
        saveWalletConnection();
    } catch (error) {
        console.error('Error during wallet connection:', error);
        onError(error);
    }
}

/**
 * Handle wallet disconnection
 */
function onDisconnect() {
    console.log('Wallet disconnected');
    
    // Update state
    updateWalletState({
        connected: false,
        publicKey: null,
        balance: 0,
        connectionPending: false,
        error: null
    });
    
    // Clear saved connection
    clearSavedWalletConnection();
}

/**
 * Handle connection error
 * @param {Error} error - Error object
 */
function onError(error) {
    console.error('Wallet error:', error);
    
    updateWalletState({
        connectionPending: false,
        error: error.message || 'Unknown wallet error'
    });
}

/**
 * Get wallet balance
 * @param {PublicKey} publicKey - Wallet public key
 * @returns {number} - Balance in SOL
 */
async function getWalletBalance(publicKey) {
    try {
        const connection = new Connection(clusterApiUrl(SOLANA_NETWORK));
        const balance = await connection.getBalance(publicKey);
        return balance / 1000000000; // Convert lamports to SOL
    } catch (error) {
        console.error('Error getting wallet balance:', error);
        return 0;
    }
}

/**
 * Connect to wallet
 * @param {string} walletType - 'phantom' or 'solflare'
 */
export async function connectWallet(walletType) {
    try {
        updateWalletState({
            connectionPending: true,
            error: null,
            walletName: walletType
        });
        
        // Check if wallet is installed
        if (walletType === 'phantom' && !window.solana) {
            throw new Error('Phantom wallet is not installed');
        } else if (walletType === 'solflare' && !window.solflare) {
            throw new Error('Solflare wallet is not installed');
        }
        
        // Initialize adapter if not already done
        if (!walletAdapter || walletAdapter.name !== walletType) {
            initializeWalletAdapter(walletType);
        }
        
        // Connect
        await walletAdapter.connect();
    } catch (error) {
        console.error('Error connecting to wallet:', error);
        onError(error);
    }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet() {
    try {
        if (walletAdapter && walletAdapter.connected) {
            await walletAdapter.disconnect();
        }
    } catch (error) {
        console.error('Error disconnecting wallet:', error);
    }
}

/**
 * Save wallet connection to localStorage
 */
function saveWalletConnection() {
    if (walletState.connected && walletState.walletName) {
        localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({
            walletName: walletState.walletName,
            timestamp: Date.now()
        }));
    }
}

/**
 * Clear saved wallet connection
 */
function clearSavedWalletConnection() {
    localStorage.removeItem(WALLET_STORAGE_KEY);
}

/**
 * Try to reconnect to previously connected wallet
 */
export async function tryReconnect() {
    try {
        const savedConnection = localStorage.getItem(WALLET_STORAGE_KEY);
        if (!savedConnection) return false;
        
        const { walletName, timestamp } = JSON.parse(savedConnection);
        
        // Only reconnect if saved within the last day
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (Date.now() - timestamp > ONE_DAY) {
            clearSavedWalletConnection();
            return false;
        }
        
        // Reconnect
        await connectWallet(walletName);
        return true;
    } catch (error) {
        console.error('Error reconnecting to wallet:', error);
        clearSavedWalletConnection();
        return false;
    }
}

/**
 * Get shortened wallet address for display
 * @param {string} address - Full wallet address
 * @returns {string} - Shortened address
 */
export function getShortenedAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
}

/**
 * Check if a wallet is installed
 * @param {string} walletType - 'phantom' or 'solflare'
 * @returns {boolean} - Whether wallet is installed
 */
export function isWalletInstalled(walletType) {
    if (walletType === 'phantom') {
        return !!window.solana;
    } else if (walletType === 'solflare') {
        return !!window.solflare;
    }
    return false;
}

/**
 * Get wallet installation instructions
 * @param {string} walletType - 'phantom' or 'solflare'
 * @returns {string} - Installation instructions
 */
export function getWalletInstallationInstructions(walletType) {
    if (walletType === 'phantom') {
        return 'Please install Phantom wallet from https://phantom.app/';
    } else if (walletType === 'solflare') {
        return 'Please install Solflare wallet from https://solflare.com/';
    }
    return '';
}

// Initialize on load
if (typeof window !== 'undefined') {
    window.addEventListener('load', async () => {
        try {
            await tryReconnect();
        } catch (error) {
            console.error('Error during wallet auto-reconnect:', error);
        }
    });
} 