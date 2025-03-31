// Token sound effect
let tokenSound = null;

// UI Elements that will be initialized
let walletButton = null;
let walletDropdown = null;
let walletConnectOptions = null;
let walletInfo = null;
let walletAddress = null;
let disconnectButton = null;
let walletError = null;
let tokenContainer = null;
let tokenBalance = null;
let pendingTokens = null;
let claimButton = null;

// Removed shop-related UI elements

// Wallet and token modules
let walletModule = null;
let tokenModule = null;

/**
 * Initialize wallet UI
 */
export function initWalletUI() {
    // Load modules dynamically to avoid circular dependencies
    Promise.all([
        import('./wallet.js'),
        import('./token.js')
    ]).then(([wallet, token]) => {
        walletModule = wallet;
        tokenModule = token;
        
        // Initialize the UI once modules are loaded
        initializeUI();
    }).catch(error => {
        console.error('Error loading wallet modules:', error);
    });
}

/**
 * Initialize the actual UI components
 */
function initializeUI() {
    // Create token sound effect
    tokenSound = new Audio('/assets/token-collect.mp3');
    
    // Create and inject wallet button
    createWalletButton();
    createWalletDropdown();
    createTokenUI();
    
    // Shop UI removed
    
    // Add event listeners
    setupEventListeners();
    
    // Subscribe to wallet state changes
    walletModule.subscribeToWalletState(updateWalletUI);
    
    // Subscribe to token state changes
    tokenModule.subscribeToTokenState(updateTokenUI);
}

/**
 * Create wallet button and add to DOM
 */
function createWalletButton() {
    const walletContainerDiv = document.createElement('div');
    walletContainerDiv.className = 'wallet-container';
    
    const walletBtn = document.createElement('button');
    walletBtn.className = 'wallet-btn';
    walletBtn.innerHTML = 'Connect Wallet';
    
    walletContainerDiv.appendChild(walletBtn);
    document.body.appendChild(walletContainerDiv);
    
    walletButton = walletBtn;
}

/**
 * Create wallet dropdown for wallet selection
 */
function createWalletDropdown() {
    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'wallet-dropdown';
    
    // Not connected state
    const connectOptions = document.createElement('div');
    connectOptions.innerHTML = `
        <h3>Connect Wallet</h3>
        <div class="wallet-option" data-wallet="phantom">
            <img src="/assets/phantom.svg" alt="Phantom">
            <span>Phantom</span>
        </div>
        <div class="wallet-option" data-wallet="solflare">
            <img src="/assets/solflare.svg" alt="Solflare">
            <span>Solflare</span>
        </div>
        <div class="wallet-error"></div>
    `;
    dropdown.appendChild(connectOptions);
    
    // Connected state
    const walletInfoDiv = document.createElement('div');
    walletInfoDiv.className = 'wallet-info';
    walletInfoDiv.style.display = 'none';
    walletInfoDiv.innerHTML = `
        <h3>Connected Wallet</h3>
        <div class="wallet-address">
            <span id="wallet-address-text"></span>
            <button class="copy-btn">Copy</button>
        </div>
        <button class="disconnect-btn">Disconnect</button>
    `;
    dropdown.appendChild(walletInfoDiv);
    
    // Add to DOM
    document.querySelector('.wallet-container').appendChild(dropdown);
    
    // Set references
    walletDropdown = dropdown;
    walletConnectOptions = connectOptions;
    walletInfo = walletInfoDiv;
    walletAddress = walletInfoDiv.querySelector('#wallet-address-text');
    disconnectButton = walletInfoDiv.querySelector('.disconnect-btn');
    walletError = dropdown.querySelector('.wallet-error');
}

/**
 * Create token UI
 */
function createTokenUI() {
    // Token container
    const container = document.createElement('div');
    container.className = 'token-container';
    container.style.display = 'none';
    
    container.innerHTML = `
        <div class="token-balance">
            <div class="token-icon">J</div>
            <span id="token-balance-text">0</span> $JUMPER
        </div>
        <div class="pending-tokens" id="pending-tokens"></div>
        <button class="claim-btn hidden" id="claim-btn">Claim Rewards</button>
    `;
    
    document.body.appendChild(container);
    
    // Set references
    tokenContainer = container;
    tokenBalance = container.querySelector('#token-balance-text');
    pendingTokens = container.querySelector('#pending-tokens');
    claimButton = container.querySelector('#claim-btn');
}

// Shop UI creation removed

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Wallet button
    walletButton.addEventListener('click', () => {
        walletDropdown.classList.toggle('visible');
    });
    
    // Wallet option selection
    walletDropdown.querySelectorAll('.wallet-option').forEach(option => {
        option.addEventListener('click', async () => {
            const walletType = option.dataset.wallet;
            
            // Check if wallet is installed
            if (!walletModule.isWalletInstalled(walletType)) {
                walletError.textContent = walletModule.getWalletInstallationInstructions(walletType);
                walletError.classList.add('visible');
                return;
            }
            
            walletError.classList.remove('visible');
            
            // Connect wallet
            await walletModule.connectWallet(walletType);
            walletDropdown.classList.remove('visible');
        });
    });
    
    // Copy address button
    walletInfo.querySelector('.copy-btn').addEventListener('click', () => {
        const address = walletAddress.textContent;
        navigator.clipboard.writeText(address).then(() => {
            const copyBtn = walletInfo.querySelector('.copy-btn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 1500);
        });
    });
    
    // Disconnect button
    disconnectButton.addEventListener('click', async () => {
        await walletModule.disconnectWallet();
        walletDropdown.classList.remove('visible');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.wallet-container')) {
            walletDropdown.classList.remove('visible');
        }
    });
    
    // Claim button
    claimButton.addEventListener('click', async () => {
        if (claimButton.classList.contains('loading')) return;
        
        claimButton.classList.add('loading');
        claimButton.textContent = 'Claiming...';
        
        const success = await tokenModule.claimTokens(true);
        
        if (success) {
            claimButton.textContent = 'Claimed!';
            setTimeout(() => {
                claimButton.classList.remove('loading');
                claimButton.classList.add('hidden');
                claimButton.textContent = 'Claim Rewards';
            }, 1500);
        } else {
            claimButton.classList.remove('loading');
            claimButton.textContent = 'Claim Failed';
            setTimeout(() => {
                claimButton.textContent = 'Claim Rewards';
            }, 1500);
        }
    });
    
    // Shop-related event listeners removed
}

/**
 * Update wallet UI based on state
 * @param {Object} state - Wallet state
 */
function updateWalletUI(state) {
    // Update button
    if (state.connectionPending) {
        walletButton.textContent = 'Connecting...';
        walletButton.classList.add('loading');
    } else if (state.connected) {
        walletButton.innerHTML = `<div class="token-icon">J</div> ${walletModule.getShortenedAddress(state.publicKey)}`;
        walletButton.classList.remove('loading');
        walletButton.classList.add('connected');
        
        // Update wallet info
        walletAddress.textContent = state.publicKey;
        walletConnectOptions.style.display = 'none';
        walletInfo.style.display = 'block';
        
        // Show token UI
        tokenContainer.style.display = 'flex';
    } else {
        walletButton.textContent = 'Connect Wallet';
        walletButton.classList.remove('loading');
        walletButton.classList.remove('connected');
        
        // Update wallet info
        walletConnectOptions.style.display = 'block';
        walletInfo.style.display = 'none';
        
        // Hide token UI if not playing
        if (!window.isPlaying) {
            tokenContainer.style.display = 'none';
        }
    }
    
    // Show error if any
    if (state.error) {
        walletError.textContent = state.error;
        walletError.classList.add('visible');
    } else {
        walletError.classList.remove('visible');
    }
}

/**
 * Update token UI based on state
 * @param {Object} state - Token state
 */
function updateTokenUI(state) {
    // Update token balance
    tokenBalance.textContent = state.balance;
    
    // Update pending tokens
    if (state.pendingTokens > 0) {
        pendingTokens.textContent = `+${state.pendingTokens} tokens pending`;
        claimButton.classList.remove('hidden');
    } else {
        pendingTokens.textContent = '';
        claimButton.classList.add('hidden');
    }
    
    // Shop UI update removed
    
    // Show token container even if wallet not connected when playing
    if (window.isPlaying && tokenContainer.style.display === 'none') {
        tokenContainer.style.display = 'flex';
    }
}

// Shop UI update function removed

/**
 * Show token notification
 * @param {number} amount - Amount of tokens collected
 */
export function showTokenNotification(amount) {
    if (amount <= 0) return;
    
    const notification = document.createElement('div');
    notification.className = 'token-notification';
    notification.innerHTML = `<div class="token-icon">J</div> +${amount} $JUMPER`;
    
    document.body.appendChild(notification);
    
    // Play sound
    if (tokenSound) {
        tokenSound.currentTime = 0;
        tokenSound.play().catch(err => console.log('Error playing sound:', err));
    }
    
    // Remove after animation
    setTimeout(() => {
        notification.remove();
    }, 3000);
} 