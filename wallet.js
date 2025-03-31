// Wallet connection module
let wallet = null;
let publicKey = null;
let tokenBalance = 0;
let unclaimedTokens = 0;

// Load stored token data from localStorage
const loadTokenData = () => {
    try {
        const savedTokenBalance = localStorage.getItem('jumperTokenBalance');
        const savedUnclaimedTokens = localStorage.getItem('jumperUnclaimedTokens');
        
        if (savedTokenBalance) tokenBalance = parseInt(savedTokenBalance);
        if (savedUnclaimedTokens) unclaimedTokens = parseInt(savedUnclaimedTokens);
        
        console.log('Loaded token data:', { tokenBalance, unclaimedTokens });
    } catch (err) {
        console.error('Error loading token data:', err);
    }
};

// Save token data to localStorage
const saveTokenData = () => {
    try {
        localStorage.setItem('jumperTokenBalance', tokenBalance.toString());
        localStorage.setItem('jumperUnclaimedTokens', unclaimedTokens.toString());
    } catch (err) {
        console.error('Error saving token data:', err);
    }
};

// Add tokens to unclaimed balance
const addUnclaimedTokens = (amount) => {
    unclaimedTokens += amount;
    saveTokenData();
    return unclaimedTokens;
};

// Claim tokens to main balance
const claimTokens = () => {
    if (unclaimedTokens > 0) {
        tokenBalance += unclaimedTokens;
        const claimed = unclaimedTokens;
        unclaimedTokens = 0;
        saveTokenData();
        return claimed;
    }
    return 0;
};

// Get token balances
const getTokenBalances = () => {
    return {
        balance: tokenBalance,
        unclaimed: unclaimedTokens
    };
};

// Detect available wallets
const detectWallet = () => {
    if (window.phantom?.solana?.isPhantom) {
        return window.phantom.solana;
    } else if (window.solflare) {
        return window.solflare;
    }
    return null;
};

// Connect wallet
const connectWallet = async () => {
    try {
        wallet = detectWallet();
        if (!wallet) {
            alert('Please install Phantom or Solflare wallet!');
            return null;
        }

        const response = await wallet.connect();
        publicKey = response.publicKey.toString();
        
        // Load token data when wallet is connected
        loadTokenData();
        
        return publicKey;
    } catch (err) {
        console.error('Error connecting wallet:', err);
        return null;
    }
};

// Disconnect wallet
const disconnectWallet = async () => {
    try {
        if (wallet) {
            await wallet.disconnect();
            publicKey = null;
            return true;
        }
        return false;
    } catch (err) {
        console.error('Error disconnecting wallet:', err);
        return false;
    }
};

// Get current wallet status
const getWalletStatus = () => {
    return {
        isConnected: !!publicKey,
        publicKey: publicKey,
        wallet: wallet
    };
};

// Simulate token minting and airdrop
const mintAndAirdropTokens = async () => {
    if (!publicKey) return false;
    
    try {
        // Here we would actually mint and send tokens on-chain
        // For now, just simulate success
        console.log(`Simulating airdrop of ${unclaimedTokens} $JUMPER tokens to ${publicKey}`);
        return true;
    } catch (err) {
        console.error('Error in token airdrop simulation:', err);
        return false;
    }
};

// Initialize token data on load
loadTokenData();

export { 
    connectWallet, 
    disconnectWallet, 
    getWalletStatus, 
    addUnclaimedTokens, 
    claimTokens, 
    getTokenBalances,
    mintAndAirdropTokens
}; 