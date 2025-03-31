let scene, camera, renderer;
let players = {};
let localPlayer = null;
let joystick = null;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canMove = false;
let player;
let platforms = [];
let coins = [];
let score = 0;
let currentLevel = 1;
let isJumping = false;
let velocity = 0;
let gameStarted = false;
let gravity = -0.015;
let jumpForce = 0.4;
let moveSpeed = 0.2;
let coinsCollected = 0;

// Camera control variables
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraAngle = { x: 0, y: 0 };
let targetCameraAngle = { x: 0, y: 0 };
let cameraDistance = 10;
let isReturningCamera = false;

// Add to game state variables at the top
let goalPlatform;
let isLevelComplete = false;
let totalLevels = 3;
let requiredCoins;
let movingPlatforms = [];
let platformStates = new Map(); // Store states for special platforms
let lastPlatformType = 'normal';
let cameraResetButton = null;

// Infinity mode variables
let isInfinityMode = false;
let infinityDifficulty = null;
let platformsCleared = 0;
let nextPlatformIndex = 7; // Index to start generating new platforms
let lastGeneratedHeight = 2; // Track the height of the last generated platform

// Infinity mode configuration
const INFINITY_CONFIG = {
    easy: {
        platformTypes: ['normal'],
        initialPlatforms: 15,
        newPlatformsCount: 7,
        heightStep: 2.2,
        coinValue: 100,
        platformWidth: 5 // Increased platform width from 3 to 5
    },
    medium: {
        platformTypes: ['normal', 'moving'],
        initialPlatforms: 15,
        newPlatformsCount: 7,
        heightStep: 2.5,
        coinValue: 150,
        movingPlatformChance: 0.4,
        platformWidth: 4.5 // Increased platform width from 3 to 4.5
    },
    hard: {
        platformTypes: ['normal', 'moving', 'disappearing'],
        initialPlatforms: 15,
        newPlatformsCount: 7,
        heightStep: 2.5, // Reduced from 2.8 to make it more playable
        coinValue: 200,
        movingPlatformChance: 0.3,
        disappearingPlatformChance: 0.25, // Slightly reduced from 0.3
        platformWidth: 4 // Increased platform width from 3.5 to 4
    }
};

// Update platform spacing constants at the top
const PLATFORM_SPACING = {
    MIN_HORIZONTAL: 3.5,    // Minimum horizontal distance between platforms
    MAX_HORIZONTAL: 5,      // Maximum horizontal distance between platforms
    HEIGHT_STEP: 2.5,       // Vertical distance between platforms
    SAFE_PLATFORM_DISTANCE: 3.5  // Distance between red and green platforms
};

// Update LEVEL_CONFIG to adjust platform type probabilities
const LEVEL_CONFIG = {
    1: {
        platformCount: 12,
        maxRadius: 6,
        heightStep: 2,
        allowMoving: false,
        allowDisappearing: false,
        coinValue: 100,
        movingPlatformChance: 0 // No moving platforms in level 1
    },
    2: {
        platformCount: 15,
        maxRadius: 7,
        heightStep: 2.2,
        allowMoving: true,
        allowDisappearing: false,
        coinValue: 150,
        movingPlatformChance: 0.4 // 40% chance for moving platforms
    },
    3: {
        platformCount: 15,
        maxRadius: 8,
        heightStep: 2.5,
        allowMoving: true,
        allowDisappearing: true,
        coinValue: 200,
        movingPlatformChance: 0.3 // 30% chance for moving platforms
    }
};

// Initialize Supabase (add your config)
// const supabaseUrl = 'https://your-supabase-url.supabase.co';
// const supabaseKey = 'your-supabase-key';
// const supabase = createClient(supabaseUrl, supabaseKey);
// const db = supabase.from('leaderboard');

// Update leaderboard functions to use Supabase
async function submitScore(playerName, score, coins, difficulty) {
    if (!playerName || !playerName.trim()) {
        console.error('Player name is required');
        return;
    }
    
    try {
        console.log('Submitting score:', { playerName, score, coins, difficulty });
        if (typeof window.dbPush !== 'function') {
            console.error('dbPush is not a function. Type:', typeof window.dbPush);
            return;
        }
        
        const result = await window.dbPush(window.dbRef(), {
            playerName: playerName,
            score: score,
            coins: coins,
            difficulty: difficulty
        });
        console.log('Score submitted successfully', result);
    } catch (error) {
        console.error('Error submitting score:', error);
    }
}

async function loadLeaderboard(difficulty = 'easy') {
    try {
        console.log('loadLeaderboard called for difficulty:', difficulty);
        const leaderboardRef = window.dbRef();
        leaderboardRef.difficulty = difficulty;
        
        console.log('Calling dbOnValue with ref:', leaderboardRef);
        await window.dbOnValue(leaderboardRef, (snapshot) => {
            console.log('dbOnValue callback received snapshot');
            const entries = [];
            snapshot.forEach((child) => {
                console.log('Processing child:', child.key, child.val());
                entries.push({
                    id: child.key,
                    ...child.val()
                });
            });
            
            console.log('Processed entries:', entries);
            updateLeaderboardUI(entries);
        });
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

function updateLeaderboardUI(entries) {
    console.log('updateLeaderboardUI called with entries:', entries);
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) {
        console.error('Leaderboard tbody element not found!');
        return;
    }
    
    // Clear existing entries
    tbody.innerHTML = '';
    
    if (!entries || entries.length === 0) {
        console.log('No entries to display in leaderboard');
        tbody.innerHTML = '<tr><td colspan="4">No scores yet. Be the first!</td></tr>';
        return;
    }
    
    // Add each entry to the table
    entries.forEach((entry, index) => {
        console.log('Adding entry to leaderboard:', entry);
        const row = document.createElement('tr');
        
        // Format the player name (limit length if needed)
        const playerName = entry.playerName || 'Unknown';
        const displayName = playerName.length > 15 ? playerName.substring(0, 12) + '...' : playerName;
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${displayName}</td>
            <td>${entry.score}</td>
            <td>${entry.coins}</td>
        `;
        tbody.appendChild(row);
    });
    
    console.log('Updated leaderboard UI with', entries.length, 'entries');
}

// Add event listeners for leaderboard tabs
document.addEventListener('DOMContentLoaded', () => {
    console.log('Setting up leaderboard tab listeners');
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('Tab clicked:', button.dataset.difficulty);
            
            // Update active tab
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Load leaderboard for selected difficulty
            const difficulty = button.dataset.difficulty;
            console.log('Loading leaderboard for difficulty:', difficulty);
            loadLeaderboard(difficulty);
        });
    });
});

// Initialize Three.js scene
function init() {
    try {
        // Initialize scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b0b0b); // Dark background for night sky
        scene.fog = new THREE.Fog(0x0b0b0b, 20, 100); // Dark fog for night effect
        
        // Initialize camera
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 5, 10);
        camera.lookAt(0, 0, 0);
        
        // Initialize renderer
        renderer = new THREE.WebGLRenderer({ 
            canvas: document.getElementById('game-canvas'),
            antialias: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x0b0b0b, 1); // Dark background for night sky
        
        // Create player
        const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
        const playerMaterial = new THREE.MeshPhongMaterial({ color: 0x9945FF }); // Changed from green to Solana purple
        player = new THREE.Mesh(playerGeometry, playerMaterial);
        player.position.set(0, 5, 0);
        scene.add(player);

        // Add ground
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshPhongMaterial({
            color: 0x1a1a1a,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1;
        scene.add(ground);

        // Add ambient light for night scene
        const ambientLight = new THREE.AmbientLight(0x333333, 0.4); // Reduced intensity
        scene.add(ambientLight);
        
        // Add a brighter, soft ambient light to improve overall visibility
        const softAmbientLight = new THREE.AmbientLight(0x6b6b9d, 0.6); // Soft bluish ambient light
        scene.add(softAmbientLight);
        
        // Add a hemisphere light for better environmental lighting
        const hemisphereLight = new THREE.HemisphereLight(
            0xaaccff, // Sky color - soft blue
            0x444466, // Ground color - darker blue
            0.5 // Intensity
        );
        scene.add(hemisphereLight);
        
        // Add directional light (moonlight)
        const directionalLight = new THREE.DirectionalLight(0xaaaaff, 0.4); // Increased intensity slightly
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        scene.add(directionalLight);

        // Add point lights for Solana-themed lighting
        const purpleLight = new THREE.PointLight(0x9945FF, 0.8, 30); // Reduced intensity
        purpleLight.position.set(5, 5, 5);
        scene.add(purpleLight);

        const greenLight = new THREE.PointLight(0x14F195, 0.8, 30); // Reduced intensity
        greenLight.position.set(-5, 5, -5);
        scene.add(greenLight);
        
        // Add additional spotlights to highlight platforms
        const spotLight1 = new THREE.SpotLight(0xffffff, 0.3); // Reduced intensity
        spotLight1.position.set(0, 15, 0);
        spotLight1.angle = Math.PI / 6;
        spotLight1.penumbra = 0.2;
        spotLight1.decay = 1;
        spotLight1.distance = 50;
        spotLight1.castShadow = true;
        scene.add(spotLight1);
        
        // Add a yellow spotlight for additional accent lighting
        const spotLight2 = new THREE.SpotLight(0xF3BA2F, 0.6); // Reduced intensity
        spotLight2.position.set(-10, 10, -10);
        spotLight2.angle = Math.PI / 8;
        spotLight2.penumbra = 0.3;
        spotLight2.decay = 1;
        spotLight2.distance = 40;
        spotLight2.castShadow = true;
        scene.add(spotLight2);
        
        // Create a follow light that moves with the player to illuminate platforms above
        const followLight = new THREE.SpotLight(0xffffff, 0.7); // Increased intensity
        followLight.position.set(0, 2, 0);
        followLight.angle = Math.PI / 2.5; // Wider angle
        followLight.penumbra = 0.3; // Softer edge
        followLight.decay = 0.2; // Less decay for better reach
        followLight.distance = 150; // Longer range to reach high platforms
        followLight.target.position.set(0, 20, 0); // Point upward
        scene.add(followLight);
        scene.add(followLight.target);
        
        // Add side lights to ensure platforms are visible from all angles
        const leftLight = new THREE.DirectionalLight(0xffffff, 0.3); // Increased intensity
        leftLight.position.set(-30, 20, 0);
        leftLight.lookAt(0, 0, 0);
        scene.add(leftLight);
        
        const rightLight = new THREE.DirectionalLight(0xffffff, 0.3); // Increased intensity
        rightLight.position.set(30, 20, 0);
        rightLight.lookAt(0, 0, 0);
        scene.add(rightLight);
        
        const frontLight = new THREE.DirectionalLight(0xffffff, 0.3); // Increased intensity
        frontLight.position.set(0, 20, 30);
        frontLight.lookAt(0, 0, 0);
        scene.add(frontLight);
        
        const backLight = new THREE.DirectionalLight(0xffffff, 0.3); // Increased intensity
        backLight.position.set(0, 20, -30);
        backLight.lookAt(0, 0, 0);
        scene.add(backLight);
        
        // Add a subtle background light with large radius for overall scene illumination
        const sceneLight = new THREE.PointLight(0xa0a0ff, 0.5, 200);
        sceneLight.position.set(0, 50, 0);
        scene.add(sceneLight);
        
        // Store the follow light for updating in the animation loop
        window.followLight = followLight;
        
        // Create initial platforms
        createLevel(currentLevel);

        // Add coins after creating platforms
        addCoinsToLevel();

        // Add event listeners
        window.addEventListener('resize', onWindowResize, false);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Add mouse/trackpad event listeners
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        // Initialize mobile controls
        initMobileControls();

        console.log('Game initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing game:', error);
        alert('Error: ' + error.message);
        return false;
    }
}

// Initialize mobile controls with nipple.js
function initMobileControls() {
    // Check if nipple.js is loaded
    if (typeof nipplejs === 'undefined') {
        console.error('nipplejs library not loaded');
        return;
    }
    
    // Setup joystick
    const joystickOptions = {
        zone: document.getElementById('joystick-zone'),
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        size: 100
    };
    
    const joystick = nipplejs.create(joystickOptions);
    
    // Joystick move event
    joystick.on('move', (evt, data) => {
        const force = data.force < 1 ? data.force : 1;
        const angle = data.angle.radian;
        
        // Reset movement flags
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
        
        // Calculate direction based on joystick angle
        if (angle >= 0 && angle < Math.PI / 4 || angle >= 7 * Math.PI / 4) {
            moveRight = true;
        } else if (angle >= Math.PI / 4 && angle < 3 * Math.PI / 4) {
            moveForward = true;
        } else if (angle >= 3 * Math.PI / 4 && angle < 5 * Math.PI / 4) {
            moveLeft = true;
        } else if (angle >= 5 * Math.PI / 4 && angle < 7 * Math.PI / 4) {
            moveBackward = true;
        }
        
        // Adjust diagonal movement
        if (Math.abs(Math.sin(angle)) > 0.5 && Math.abs(Math.cos(angle)) > 0.5) {
            if (angle >= Math.PI / 4 && angle < Math.PI / 2) {
                moveForward = true;
                moveRight = true;
            } else if (angle >= Math.PI / 2 && angle < 3 * Math.PI / 4) {
                moveForward = true;
                moveLeft = true;
            } else if (angle >= 3 * Math.PI / 4 && angle < Math.PI) {
                moveLeft = true;
                moveBackward = false;
            } else if (angle >= Math.PI && angle < 5 * Math.PI / 4) {
                moveLeft = true;
                moveBackward = true;
            } else if (angle >= 5 * Math.PI / 4 && angle < 3 * Math.PI / 2) {
                moveBackward = true;
                moveRight = false;
            } else if (angle >= 3 * Math.PI / 2 && angle < 7 * Math.PI / 4) {
                moveBackward = true;
                moveRight = true;
            } else if ((angle >= 7 * Math.PI / 4 && angle < 2 * Math.PI) || (angle >= 0 && angle < Math.PI / 4)) {
                moveRight = true;
                moveForward = false;
            }
        }
        
        // Scale movement speed based on joystick force
        moveSpeed = 0.2 * force;
    });
    
    // Joystick end event
    joystick.on('end', () => {
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
        moveSpeed = 0.2; // Reset to default speed
    });
    
    // Jump button
    const jumpButton = document.getElementById('jump-button');
    
    // Jump on touchstart
    jumpButton.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent default touch behavior
        jump();
    });
    
    // Also support click for testing on non-touch devices
    jumpButton.addEventListener('click', (e) => {
        e.preventDefault();
        jump();
    });
    
    // Detect mobile device for auto-enabling controls
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        document.getElementById('mobile-controls').style.display = 'block';
    }
}

// Update createLevel function to handle platform types better
function createLevel(levelNumber) {
    clearLevel();
    
    const config = LEVEL_CONFIG[levelNumber];
    if (!config) {
        console.error('Invalid level number:', levelNumber);
        return;
    }

    // First platform is always static and in a fixed position
    const firstPlatform = createPlatform(0, 2, 3, 0.5, 0x1a1a1a);
    firstPlatform.position.z = 0;
    platforms.push(firstPlatform);
    createCoin(0, 3.5, 0);
    
    let lastX = 0;
    let lastZ = 0;
    let lastY = 2;
    lastPlatformType = 'normal';

    // Generate platforms in a spiral pattern
    for (let i = 1; i < config.platformCount - 1; i++) {
        const height = lastY + config.heightStep;
        
        // Determine platform type based on level config
        let platformType = 'normal';
        if (i > 2) { // Don't add special platforms too early in the level
            const rand = Math.random();
            if (config.allowMoving && config.allowDisappearing) {
                if (lastPlatformType === 'disappearing') {
                    platformType = Math.random() < config.movingPlatformChance ? 'moving' : 'normal';
                } else if (lastPlatformType === 'moving') {
                    platformType = Math.random() < 0.3 ? 'disappearing' : 'normal';
                } else {
                    if (rand < config.movingPlatformChance) platformType = 'moving';
                    else if (rand < config.movingPlatformChance + 0.3) platformType = 'disappearing';
                }
            } else if (config.allowMoving) {
                platformType = rand < config.movingPlatformChance ? 'moving' : 'normal';
            }
        }

        // Calculate new position using spiral pattern
        const angle = (i / config.platformCount) * Math.PI * 2 + Math.random() * 0.5;
        const radius = (i / config.platformCount) * config.maxRadius;
        let x = Math.cos(angle) * radius;
        let z = Math.sin(angle) * radius;

        // Ensure minimum distance from previous platform
        const distanceFromLast = Math.sqrt(
            Math.pow(x - lastX, 2) + Math.pow(z - lastZ, 2)
        );
        
        if (distanceFromLast < PLATFORM_SPACING.MIN_HORIZONTAL) {
            const scale = PLATFORM_SPACING.MIN_HORIZONTAL / distanceFromLast;
            x = lastX + (x - lastX) * scale;
            z = lastZ + (z - lastZ) * scale;
        }

        // Create platform based on type
        let platform;
        const width = 3;

        switch (platformType) {
            case 'moving':
                platform = createMovingPlatform(x, height, z, width);
                break;
            case 'disappearing':
                platform = createDisappearingPlatform(x, height, z, width);
                // Create a normal platform at a safe distance
                const safeAngle = angle + Math.PI / 4;
                const safeX = x + Math.cos(safeAngle) * PLATFORM_SPACING.SAFE_PLATFORM_DISTANCE;
                const safeZ = z + Math.sin(safeAngle) * PLATFORM_SPACING.SAFE_PLATFORM_DISTANCE;
                const safePlatform = createPlatform(safeX, height, width, 0.5, 0x1a1a1a);
                safePlatform.position.z = safeZ;
                platforms.push(safePlatform);
                createCoin(safeX, height + 1.5, safeZ);
                break;
            default:
                platform = createPlatform(x, height, width, 0.5, 0x1a1a1a);
                platform.position.z = z;
        }

        if (platform) {
            platforms.push(platform);
            createCoin(x, height + 1.5, z);
            lastX = x;
            lastZ = z;
            lastY = height;
            lastPlatformType = platformType;
        }
    }

    // Add final platform (golden platform)
    const finalHeight = lastY + config.heightStep;
    createGoalPlatform(0, finalHeight, 0, 4);
    createCoin(0, finalHeight + 1.5, 0);
}

// Modify the clearLevel function to properly clean up all goal platform elements
function clearLevel() {
    // Remove all platforms
    for (let platform of platforms) {
        scene.remove(platform);
    }
    platforms = [];
    
    // Remove all coins
    for (let coin of coins) {
        scene.remove(coin);
    }
    coins = [];
    
    // Clear moving platforms array
    movingPlatforms = [];
    
    // Reset platform states
    platformStates = new Map();
    
    // Reset player position
    if (player) {
        player.position.set(0, 5, 0);
        velocity = 0;
    }
    
    // Reset game state variables
    if (!isInfinityMode) {
        score = 0;
        coinsCollected = 0;
    }
    
    // Reset infinity mode specific variables if switching modes
    if (!isInfinityMode) {
        platformsCleared = 0;
        nextPlatformIndex = 7;
        lastGeneratedHeight = 2;
    }

    // Remove goal platform and its glow effect
    if (goalPlatform && goalPlatform.parent) {
        // Find and remove the glow effect
        scene.children.forEach(child => {
            if (child.type === "Mesh" && 
                child.material && 
                child.material.color && 
                child.material.color.getHex() === 0xFFD700 && 
                child.material.transparent === true) {
                scene.remove(child);
            }
        });
        
        // Remove the goal platform itself
        goalPlatform.parent.remove(goalPlatform);
    }
    goalPlatform = null;
}

// Create platforms for current level
function createPlatforms() {
    // Clear existing platforms
    platforms.forEach(platform => scene.remove(platform));
    platforms = [];

    // Create main platform
    const mainPlatform = createPlatform(0, 0, 10, 1, 0x1a1a1a);
    platforms.push(mainPlatform);

    // Create level-specific platforms
    if (currentLevel === 1) {
        createLevel1Platforms();
    }
}

// Create a single platform with improved collision box
function createPlatform(x, y, width, height, color) {
    // Make platforms square by setting depth equal to width
    const geometry = new THREE.BoxGeometry(width, height, width);
    const material = new THREE.MeshPhongMaterial({ 
        color: color,
        shadowSide: THREE.DoubleSide 
    });
    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(x, y, 0);
    platform.castShadow = true;
    platform.receiveShadow = true;
    
    // Add platform to scene
    scene.add(platform);
    return platform;
}

// Create Level 1 platforms with improved layout
function createLevel1Platforms() {
    const platformCount = 15;
    const maxRadius = 8; // Maximum radius from center
    
    // Clear existing platforms array
    platforms = [];
    
    // First platform is always static and in a fixed position
    const firstPlatform = createPlatform(0, 2, 5, 0.5, 0x1a1a1a);
    firstPlatform.position.z = 0;
    platforms.push(firstPlatform);
    createCoin(0, 3.5, 0);
    
    let lastX = 0;
    let lastZ = 0;
    let lastY = 2;
    lastPlatformType = 'normal';

    // Generate platforms in a spiral pattern
    for (let i = 1; i < platformCount - 1; i++) {
        const height = lastY + PLATFORM_SPACING.HEIGHT_STEP;
        
        // Determine platform type based on previous platform
        let platformType;
        if (lastPlatformType === 'disappearing') {
            // After a disappearing platform, always place a normal platform
            platformType = 'normal';
        } else if (lastPlatformType === 'moving') {
            // After a moving platform, place either normal or disappearing
            platformType = Math.random() < 0.5 ? 'normal' : 'disappearing';
        } else {
            // After a normal platform, any type is possible
            const rand = Math.random();
            if (rand < 0.4) platformType = 'normal';
            else if (rand < 0.7) platformType = 'moving';
            else platformType = 'disappearing';
        }

        // Calculate new position using spiral pattern
        const angle = (i / platformCount) * Math.PI * 2 + Math.random() * 0.5;
        const radius = (i / platformCount) * maxRadius;
        let x = Math.cos(angle) * radius;
        let z = Math.sin(angle) * radius;

        // Ensure minimum distance from previous platform
        const distanceFromLast = Math.sqrt(
            Math.pow(x - lastX, 2) + Math.pow(z - lastZ, 2)
        );
        
        if (distanceFromLast < PLATFORM_SPACING.MIN_HORIZONTAL) {
            const scale = PLATFORM_SPACING.MIN_HORIZONTAL / distanceFromLast;
            x = lastX + (x - lastX) * scale;
            z = lastZ + (z - lastZ) * scale;
        }

        // Create platform based on type
        let platform;
        const width = 4.5; // Increased width for better playability

        switch (platformType) {
            case 'moving':
                platform = createMovingPlatform(x, height, z, width);
                break;
            case 'disappearing':
                platform = createDisappearingPlatform(x, height, z, width);
                // Create a normal platform at a safe distance
                const safeAngle = angle + Math.PI / 4; // 45 degrees offset
                const safeX = x + Math.cos(safeAngle) * PLATFORM_SPACING.SAFE_PLATFORM_DISTANCE;
                const safeZ = z + Math.sin(safeAngle) * PLATFORM_SPACING.SAFE_PLATFORM_DISTANCE;
                const safePlatform = createPlatform(safeX, height, width, 0.5, 0x1a1a1a);
                safePlatform.position.z = safeZ;
                platforms.push(safePlatform);
                createCoin(safeX, height + 1.5, safeZ);
                break;
            default:
                platform = createPlatform(x, height, width, 0.5, 0x1a1a1a);
                platform.position.z = z;
        }

        if (platform) {
            platforms.push(platform);
            createCoin(x, height + 1.5, z);
            lastX = x;
            lastZ = z;
            lastY = height;
            lastPlatformType = platformType;
        }
    }

    // Add final platform (golden platform) - centered above the spiral
    const finalHeight = lastY + PLATFORM_SPACING.HEIGHT_STEP;
    createGoalPlatform(0, finalHeight, 0, 6); // Increased goal platform width to 6
    createCoin(0, finalHeight + 1.5, 0);
}

// Create a moving platform
function createMovingPlatform(x, y, z, width) {
    // Make sure width is sufficiently large, but 20% smaller than before
    width = Math.max(width, 3.6); // Reduced from 4.5 (20% reduction)
    // Create a square platform by making depth equal to width
    const geometry = new THREE.BoxGeometry(width, 0.5, width);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0x9945FF, // Blue color
        shadowSide: THREE.DoubleSide 
    });
    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(x, y, z);
    platform.castShadow = true;
    platform.receiveShadow = true;
    
    // Add platform to scene
    scene.add(platform);
    
    // Add movement properties
    const movement = {
        center: new THREE.Vector3(x, y, z),
        amplitude: 2,
        speed: 0.02,
        time: Math.random() * Math.PI * 2, // Random start phase
        axis: Math.random() < 0.5 ? 'x' : 'z' // Randomly choose movement axis
    };
    
    movingPlatforms.push({ platform, movement });
    return platform;
}

// Create a disappearing platform
function createDisappearingPlatform(x, y, z, width) {
    // Make sure width is sufficiently large, but reduced by 20%
    width = Math.max(width, 3.6); // Reduced from 4.5
    // Create a square platform by making depth equal to width
    const geometry = new THREE.BoxGeometry(width, 0.5, width);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0x14F195, // Solana green
        shadowSide: THREE.DoubleSide 
    });
    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(x, y, z);
    platform.castShadow = true;
    platform.receiveShadow = true;
    
    // Add platform to scene
    scene.add(platform);
    
    platformStates.set(platform.id, {
        visible: true,
        timeoutId: null,
        cooldown: false
    });
    
    return platform;
}

// Update moving platforms
function updateMovingPlatforms() {
    movingPlatforms.forEach(({ platform, movement }) => {
        const oldX = platform.position.x;
        const oldZ = platform.position.z;
        
        movement.time += movement.speed;
        const offset = Math.sin(movement.time) * movement.amplitude;
        
        if (movement.axis === 'x') {
            platform.position.x = movement.center.x + offset;
            // Move player with platform if they're on it
            if (isPlayerOnPlatform(platform)) {
                player.position.x += platform.position.x - oldX;
            }
        } else {
            platform.position.z = movement.center.z + offset;
            if (isPlayerOnPlatform(platform)) {
                player.position.z += platform.position.z - oldZ;
            }
        }
    });
}

// Helper function to check if player is on a specific platform
function isPlayerOnPlatform(platform) {
    const playerBottom = player.position.y - 0.5;
    const platformTop = platform.position.y + 0.25;
    const dx = Math.abs(player.position.x - platform.position.x);
    const dz = Math.abs(player.position.z - platform.position.z);
    const platformWidth = platform.geometry.parameters.width;
    const platformDepth = platform.geometry.parameters.depth || platformWidth; // Use width for depth if not defined

    return (dx < platformWidth / 2 + 0.4 &&
            dz < platformDepth / 2 + 0.4 &&
            Math.abs(playerBottom - platformTop) < 0.2 &&
            !isJumping);
}

// Handle disappearing platform collision
function handleDisappearingPlatform(platform) {
    const state = platformStates.get(platform.id);
    if (!state || !state.visible || state.cooldown) return;

    // Start disappearing sequence
    state.timeoutId = setTimeout(() => {
        platform.visible = false;
        state.visible = false;
        state.cooldown = true;

        // Reappear after 2 seconds
        setTimeout(() => {
            platform.visible = true;
            state.visible = true;
            state.cooldown = false;
        }, 2000);
    }, 500); // Start disappearing after 0.5 seconds of contact
}

// Update checkPlatformCollisions function to only check top collisions
function checkPlatformCollisions() {
    let onPlatform = false;
    const playerBottom = player.position.y - 0.5;
    const playerRadius = 0.5;

    platforms.forEach(platform => {
        if (!platform.visible) return;
        if (!platform.geometry) return;

        const platformTop = platform.position.y + 0.25;
        const platformWidth = platform.geometry.parameters.width;
        const platformDepth = platform.geometry.parameters.depth || platformWidth; // Use width for depth if not specified

        // Calculate horizontal distances
        const dx = Math.abs(player.position.x - platform.position.x);
        const dz = Math.abs(player.position.z - platform.position.z);

        // Only check for landing on top of platform
        if (dx < (platformWidth / 2 + playerRadius) && 
            dz < (platformDepth / 2 + playerRadius) && 
            playerBottom >= platformTop - 0.2 && 
            playerBottom <= platformTop + 0.2 && 
            velocity <= 0) {
            
            player.position.y = platformTop + 0.5;
            velocity = 0;
            isJumping = false;
            onPlatform = true;

            // Handle disappearing platform
            if (platformStates.has(platform.id)) {
                handleDisappearingPlatform(platform);
            }
        }
    });

    // Check collision with goal platform
    if (goalPlatform && goalPlatform.visible) {
        const dx = Math.abs(player.position.x - goalPlatform.position.x);
        const dz = Math.abs(player.position.z - goalPlatform.position.z);
        const platformWidth = goalPlatform.geometry.parameters.width;
        const platformDepth = goalPlatform.geometry.parameters.depth || platformWidth; // Use width for depth
        const platformTop = goalPlatform.position.y + 0.25;

        if (dx < (platformWidth / 2 + playerRadius) && 
            dz < (platformDepth / 2 + playerRadius) && 
            playerBottom >= platformTop - 0.2 && 
            playerBottom <= platformTop + 0.2 && 
            velocity <= 0) {
            
            player.position.y = platformTop + 0.5;
            velocity = 0;
            isJumping = false;
            onPlatform = true;
        }
    }

    return onPlatform;
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Fix keyboard input handling to prevent command key issue
function onKeyDown(event) {
    // Completely ignore key events if meta key (command) is pressed
    if (event.metaKey) return; 
    
    switch (event.code) {
        case 'Space':
            jump();
            break;
        case 'KeyA':
        case 'ArrowLeft':
            moveLeft = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            moveRight = true;
            break;
        case 'KeyS':
        case 'ArrowDown':
            moveBackward = true;
            break;
        case 'KeyW':
        case 'ArrowUp':
            moveForward = true;
            break;
    }
}

function onKeyUp(event) {
    // If this is a meta key up event, don't change anything
    if (event.key === 'Meta') return;
    
    // If meta was pressed during this event, ignore it
    if (event.metaKey) return;
    
    switch (event.code) {
        case 'KeyA':
        case 'ArrowLeft':
            moveLeft = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            moveRight = false;
            break;
        case 'KeyS':
        case 'ArrowDown':
            moveBackward = false;
            break;
        case 'KeyW':
        case 'ArrowUp':
            moveForward = false;
            break;
    }
}

// Jump function with improved mechanics
function jump() {
    if (!isJumping) {
        isJumping = true;
        velocity = jumpForce;
        // Add a small delay before allowing next jump
        setTimeout(() => {
            if (velocity <= 0) {
                isJumping = false;
            }
        }, 100);
    }
}

// Mouse control functions
function onMouseDown(event) {
    // Don't enable camera dragging on mobile devices
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        return;
    }
    
    isDragging = true;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseMove(event) {
    if (!isDragging) return;
    
    const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
    };

    cameraAngle.x += deltaMove.y * 0.01;
    cameraAngle.y += deltaMove.x * 0.01;

    // Limit vertical rotation
    cameraAngle.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cameraAngle.x));

    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };

    isReturningCamera = false;
}

function onMouseUp() {
    isDragging = false;
    // Remove auto-return behavior
    if (!cameraResetButton && (cameraAngle.x !== 0 || cameraAngle.y !== 0)) {
        createCameraResetButton();
    }
}

// Create camera reset button
function createCameraResetButton() {
    if (cameraResetButton) return;

    cameraResetButton = document.createElement('button');
    cameraResetButton.id = 'camera-reset';
    cameraResetButton.textContent = 'Reset Camera';
    cameraResetButton.style.position = 'fixed';
    cameraResetButton.style.top = '20px';
    cameraResetButton.style.right = '20px';
    cameraResetButton.style.padding = '10px 20px';
    cameraResetButton.style.backgroundColor = '#4CAF50';
    cameraResetButton.style.color = 'white';
    cameraResetButton.style.border = 'none';
    cameraResetButton.style.borderRadius = '5px';
    cameraResetButton.style.cursor = 'pointer';
    cameraResetButton.style.zIndex = '1000';

    cameraResetButton.addEventListener('click', resetCamera);
    document.body.appendChild(cameraResetButton);
}

// Reset camera function
function resetCamera() {
    isReturningCamera = true;
    const resetDuration = 500; // 500ms
    const startAngles = { x: cameraAngle.x, y: cameraAngle.y };
    const startTime = Date.now();

    function animateReset() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / resetDuration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out

        cameraAngle.x = startAngles.x * (1 - easeProgress);
        cameraAngle.y = startAngles.y * (1 - easeProgress);

        if (progress < 1) {
            requestAnimationFrame(animateReset);
        } else {
            isReturningCamera = false;
            cameraAngle.x = 0;
            cameraAngle.y = 0;
            if (cameraResetButton) {
                document.body.removeChild(cameraResetButton);
                cameraResetButton = null;
            }
        }
    }

    animateReset();
}

// Update camera position without auto-return
function updateCamera() {
    // Calculate camera position based on angles
    const targetCameraX = player.position.x + cameraDistance * Math.sin(cameraAngle.y);
    const targetCameraY = player.position.y + 5 + cameraDistance * Math.sin(cameraAngle.x);
    const targetCameraZ = player.position.z + cameraDistance * Math.cos(cameraAngle.y);

    // Smooth camera movement
    camera.position.x += (targetCameraX - camera.position.x) * 0.1;
    camera.position.y += (targetCameraY - camera.position.y) * 0.1;
    camera.position.z += (targetCameraZ - camera.position.z) * 0.1;

    camera.lookAt(player.position);
}

// Reset player position
function resetPlayer() {
    player.position.set(0, 5, 0);
    velocity = 0;
    isJumping = false;
}

// Update function that checks for ground collision
function update() {
    // Apply gravity
    velocity += gravity;
    player.position.y += velocity;

    // Check for ground collision
    if (player.position.y <= 0.5) { // Changed from 0 to 0.5 to account for player height
        player.position.y = 0.5; // Keep player at ground level
        velocity = 0;
        isJumping = false; // Allow jumping again when on ground
        
        if (isInfinityMode) {
            // Game over - hit the ground
            showInfinityGameOver();
            return;
        }
    }

    // Handle movement
    const moveDirection = new THREE.Vector3(0, 0, 0);
    const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
    cameraDirection.y = 0;
    cameraDirection.normalize();

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();

    if (moveForward) {
        moveDirection.add(cameraDirection);
    }
    if (moveBackward) {
        moveDirection.sub(cameraDirection);
    }
    if (moveLeft) {
        moveDirection.sub(cameraRight);
    }
    if (moveRight) {
        moveDirection.add(cameraRight);
    }

    if (moveDirection.length() > 0) {
        moveDirection.normalize();
        player.position.x += moveDirection.x * moveSpeed;
        player.position.z += moveDirection.z * moveSpeed;
    }

    // Check platform collisions
    const onPlatform = checkPlatformCollisions();
    
    // Only set isJumping to false if we're on a platform or the ground
    if (onPlatform || player.position.y <= 0.5) {
        isJumping = false;
    }

    // Check if player has fallen below a certain threshold
    if (player.position.y < -10) {
        if (isInfinityMode) {
            showInfinityGameOver();
        } else {
            resetPlayer();
        }
    }

    // Check coin collection
    checkCoinCollection();

    // Check level completion
    if (!isInfinityMode) {
        checkLevelCompletion();
    }

    // Update UI
    updateUI();
}

// Animation loop
let animationFrameId = null; // Track the animation frame request

function animate() {
    animationFrameId = requestAnimationFrame(animate);
    
    if (gameStarted) {
        // Update player position and physics
        update();
        
        // Check for game over conditions
        if (player.position.y < -1) {
            if (isInfinityMode) {
                showInfinityGameOver();
            } else {
                showGameOver();
            }
            return;
        }
        
        // Additional ground collision check for infinity mode
        if (isInfinityMode && player.position.y <= 0) {
            player.position.y = 0; // Prevent falling through ground
            showInfinityGameOver();
            return;
        }
        
        // Check infinity mode progress
        if (isInfinityMode) {
            checkInfinityProgress();
        }
        
        // Update moving platforms
        updateMovingPlatforms();
        
        // Update camera position
        updateCamera();
        
        // Update lights
        updateLights();
        
        renderer.render(scene, camera);
    }
}

// Function to properly stop animation
function stopAnimation() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Function to restart animation
function startAnimation() {
    // Stop any existing animation first
    stopAnimation();
    // Start a new animation loop
    animate();
}

// Start game when button is clicked
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    const startButton = document.getElementById('start-button');
    if (startButton) {
        startButton.addEventListener('click', () => {
            console.log('Start button clicked');
            document.getElementById('start-screen').style.display = 'none';
            document.getElementById('game-ui').style.display = 'block'; // Show the game UI
            if (!gameStarted) {
                if (init()) {
                    gameStarted = true;
                    // Initialize score display
                    score = 0;
                    coinsCollected = 0;
                    updateUI();
                    
                    // Start animation with the new function
                    startAnimation();
                    console.log('Game started successfully');
                }
            }
        });
    } else {
        console.error('Start button not found');
    }
});

// Create a coin object
function createCoin(x, y, z) {
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 32);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xF3BA2F,
        emissive: 0xF3BA2F,
        emissiveIntensity: 0.2,
        metalness: 0.8,
        roughness: 0.2
    });
    const coin = new THREE.Mesh(geometry, material);
    coin.rotation.x = Math.PI / 2; // Make coin face up
    coin.position.set(x, y, z);
    scene.add(coin);
    coins.push(coin);
    return coin;
}

// Add coins near platforms
function addCoinsToLevel() {
    // Clear existing coins
    coins.forEach(coin => scene.remove(coin));
    coins = [];

    // Add coins above each platform
    platforms.forEach(platform => {
        const coinY = platform.position.y + 1.5; // Coin floats above platform
        createCoin(
            platform.position.x,
            coinY,
            platform.position.z
        );
    });

    // Update UI
    updateUI();
}

// Update coin collection with improved detection
function checkCoinCollection() {
    const playerPos = player.position;
    const collectionDistance = 1.2; // Slightly increased collection radius

    coins.forEach((coin, index) => {
        if (coin.visible) {
            const distance = playerPos.distanceTo(coin.position);
            if (distance < collectionDistance) {
                collectCoin(index);
            }
        }
    });
}

// Collect coin
function collectCoin(index) {
    const coin = coins[index];
    if (coin.visible) {
        coin.visible = false;
        
        // Add points based on the current level's coin value
        const coinValue = LEVEL_CONFIG[currentLevel].coinValue;
        score += coinValue;
        coinsCollected++;
        updateUI();
        
        // Add $JUMPER tokens if wallet is connected
        if (window.tokenFunctions) {
            try {
                // Get screen coordinates for token notification
                const coinPosition = coin.position.clone();
                const vector = coinPosition.project(camera);
                const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-(vector.y) * 0.5 + 0.5) * window.innerHeight;
                
                // Add tokens equal to coin value
                window.tokenFunctions.addTokens(coinValue, x, y);
                
                // Add to unclaimed tokens in wallet.js
                if (typeof window.addUnclaimedTokens === 'function') {
                    window.addUnclaimedTokens(coinValue);
                }
            } catch (err) {
                console.error('Error adding tokens:', err);
            }
        }
        
        // Optional: Add particle effect here
        createCoinCollectionEffect(coin.position);
    }
}

// Create particle effect for coin collection
function createCoinCollectionEffect(position) {
    const particleCount = 10;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        positions.push(
            position.x + (Math.random() - 0.5) * 0.2,
            position.y + (Math.random() - 0.5) * 0.2,
            position.z + (Math.random() - 0.5) * 0.2
        );
        velocities.push(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 0.2
        );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0xF3BA2F,
        size: 0.1,
        transparent: true
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Animate particles
    const animate = () => {
        const positions = particles.geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i];
            positions[i + 1] += velocities[i + 1];
            positions[i + 2] += velocities[i + 2];
            velocities[i + 1] -= 0.01; // Gravity effect
        }

        particles.geometry.attributes.position.needsUpdate = true;
        material.opacity -= 0.02;

        if (material.opacity > 0) {
            requestAnimationFrame(animate);
        } else {
            scene.remove(particles);
        }
    };

    animate();
}

// Update UI
function updateUI() {
    document.getElementById('score-value').textContent = score;
    document.getElementById('coins-value').textContent = coinsCollected;
}

// Update createGoalPlatform function to keep track of the glow element
function createGoalPlatform(x, y, z, width) {
    // Make goal platform square by setting depth equal to width
    const geometry = new THREE.BoxGeometry(width, 0.5, width);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xF3BA2F,
        emissive: 0xF3BA2F,
        emissiveIntensity: 0.2, // Reduced intensity
        metalness: 0.9,
        roughness: 0.2,
        transparent: false // Ensure the platform itself is not transparent
    });
    goalPlatform = new THREE.Mesh(geometry, material);
    goalPlatform.position.set(x, y, z);
    goalPlatform.userData.isGoalPlatform = true; // Mark as goal platform
    scene.add(goalPlatform);

    // Only add glow effect in level 1
    if (currentLevel === 1) {
        // Create separate glow effect - also square
        const glowGeometry = new THREE.BoxGeometry(width + 0.1, 0.55, width + 0.1);
        const glowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xF3BA2F,
            transparent: true,
            opacity: 0.05, // Reduced opacity
            depthWrite: false // Prevent z-fighting with the main platform
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(goalPlatform.position);
        glow.userData.isGoalGlow = true; // Mark as goal platform glow
        scene.add(glow);

        // Store reference to glow in goalPlatform
        goalPlatform.userData.glowEffect = glow;

        // Animate glow with subtle pulsing
        let time = 0;
        const animateGlow = () => {
            if (goalPlatform && goalPlatform.parent && glow && glow.parent) {
                time += 0.01;
                glowMaterial.opacity = 0.05 + Math.sin(time) * 0.01; // Reduced opacity variation
                requestAnimationFrame(animateGlow);
            }
        };
        animateGlow();
    }
}

// Update level completion check
function checkLevelCompletion() {
    if (!isLevelComplete && goalPlatform) {
        const playerPos = player.position;
        const goalPos = goalPlatform.position;
        const distance = playerPos.distanceTo(goalPos);

        if (distance < 2) {
            // Calculate bonus for collected coins
            const coinBonus = coinsCollected * LEVEL_CONFIG[currentLevel].coinValue;
            score += coinBonus;
            
            completedLevel();
        }
    }
}

// Update level completion handler with improved UI
function completedLevel() {
    isLevelComplete = true;
    
    // Calculate level bonus based on current level
    const levelBonus = LEVEL_CONFIG[currentLevel].coinValue * 2;
    
    // Add bonus to score
    score += levelBonus;
    
    // Award $JUMPER tokens for level completion
    if (window.addUnclaimedTokens) {
        window.addUnclaimedTokens(levelBonus).then(() => {
            // Update token UI if visible
            if (window.tokenFunctions) {
                // Show token notification in center of screen
                window.showTokenNotification(levelBonus, window.innerWidth / 2, window.innerHeight / 2);
            }
        }).catch(err => console.error('Error adding level bonus tokens:', err));
    }
    
    // Get level complete UI element
    const levelCompleteUI = document.getElementById('level-complete');
    if (levelCompleteUI) {
        // Update title based on current level
        const levelTitle = levelCompleteUI.querySelector('h2');
        if (levelTitle) {
            levelTitle.textContent = `Level ${currentLevel} Complete!`;
        }
        
        // Update level stats with animations
        const levelStats = document.getElementById('level-stats');
        if (levelStats) {
            levelStats.innerHTML = `
                <div class="stat-row">
                    <div class="stat-label">Level Bonus:</div>
                    <div class="stat-value animate-value">+${levelBonus}</div>
                </div>
                <div class="stat-row">
                    <div class="stat-label">Coins Collected:</div>
                    <div class="stat-value">${coinsCollected}</div>
                </div>
                <div class="stat-row">
                    <div class="stat-label">Total Score:</div>
                    <div class="stat-value highlight">${score}</div>
                </div>
            `;
        }
        
        // Configure next level button
        const nextLevelBtn = document.getElementById('next-level-button');
        if (nextLevelBtn) {
            // Clear existing event listeners
            const newBtn = nextLevelBtn.cloneNode(true);
            nextLevelBtn.parentNode.replaceChild(newBtn, nextLevelBtn);
            
            // Update button text based on if this is the last level
            if (currentLevel >= totalLevels) {
                newBtn.textContent = 'Complete Game';
            } else {
                newBtn.textContent = `Start Level ${currentLevel + 1}`;
            }
            
            // Add click event listener
            newBtn.addEventListener('click', () => {
                hideCompletionUI();
            });
        }
        
        // Show the UI with animation
        levelCompleteUI.style.display = 'flex';
        levelCompleteUI.classList.add('show-ui');
        
        // Add auto-proceed after delay if user doesn't click
        setTimeout(() => {
            if (levelCompleteUI.style.display !== 'none') {
                hideCompletionUI();
            }
        }, 8000); // Wait 8 seconds before auto-proceeding
    }
    
    // Helper function to hide UI with animation
    function hideCompletionUI() {
        levelCompleteUI.classList.remove('show-ui');
        levelCompleteUI.classList.add('hide-ui');
        
        // Wait for animation to complete before proceeding
        setTimeout(() => {
            levelCompleteUI.style.display = 'none';
            levelCompleteUI.classList.remove('hide-ui');
            
            if (currentLevel >= totalLevels) {
                showGameCompleteUI();
            } else {
                loadNextLevel();
            }
        }, 400); // Match animation duration
    }
}

// Update loadNextLevel to preserve score and coins
function loadNextLevel() {
    // Store the current score and coins before resetting the level
    const currentScore = score;
    const currentCoinsCollected = coinsCollected;
    
    // Reset game state but preserve score and coins
    resetGameState();
    
    // Increment level
    currentLevel++;
    
    // Create new level
    createLevel(currentLevel);
    
    // Update UI
    updateLevelDisplay();
    
    // Reset player position
    resetPlayer();
    
    // Restore score and coins
    score = currentScore;
    coinsCollected = currentCoinsCollected;
    updateUI();
}

// Modify the resetGameState function to focus only on level-specific elements
function resetGameState() {
    // Only reset level-specific state variables
    clearLevel();
    isLevelComplete = false;
    
    // Reset player physics state
    isJumping = false;
    velocity = 0;
    canMove = true;
}

// Add function to update level display
function updateLevelDisplay() {
    const levelDisplay = document.getElementById('level-display');
    if (levelDisplay) {
        levelDisplay.textContent = `Level ${currentLevel}`;
    }
}

// Show game complete UI with symmetrical buttons
function showGameCompleteUI() {
    const gameComplete = document.createElement('div');
    gameComplete.id = 'game-complete';
    gameComplete.innerHTML = `
        <h2>Game Complete!</h2>
        <div class="completion-stats">
            <p>Congratulations! You've completed all ${totalLevels} levels!</p>
            <p>Final Score: <span class="highlight">${score}</span></p>
            <p>Total Coins: <span class="highlight">${coinsCollected}</span></p>
        </div>
        <div class="button-container">
            <button id="twitter-share-btn" class="game-btn share-btn">Share on Twitter</button>
            <button id="replay-btn" class="game-btn replay-btn">Play Again</button>
        </div>
    `;
    document.body.appendChild(gameComplete);

    // Add entrance animation effect
    setTimeout(() => {
        gameComplete.style.opacity = '0';
        gameComplete.style.transform = 'translate(-50%, -50%) scale(0.8)';
        
        // Force reflow
        gameComplete.offsetHeight;
        
        // Apply animation
        gameComplete.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        gameComplete.style.opacity = '1';
        gameComplete.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);

    // Add event listener for Twitter share
    const shareBtn = document.getElementById('twitter-share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareOnTwitter);
    }

    // Add event listener for replay button
    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn) {
        replayBtn.addEventListener('click', restartGame);
    }
}

// Function to share on Twitter with a single screenshot dialog
function shareOnTwitter() {
    // Remove any existing screenshot message
    const existingMessage = document.getElementById('screenshot-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create a tweet text that emphasizes adding the screenshot
    const tweetText = `I just completed all ${totalLevels} levels of 3D Jumper Game with a final score of ${score} and collected ${coinsCollected} coins! Check out my gameplay! #3DJumperGame`;
    
    // Take a screenshot and prepare sharing UI
    takeScreenshot().then(imgData => {
        // Create a screenshot viewer with clear instructions
        const message = document.createElement('div');
        message.id = 'screenshot-message';
        message.innerHTML = `
            <h3>Share Your Achievement</h3>
            <div class="screenshot-container">
                <img src="${imgData}" alt="Game Screenshot" id="screenshot-image">
            </div>
            <p>Twitter will open in a new tab with your pre-written tweet.</p>
            <p><strong>To include this screenshot with your tweet:</strong></p>
            <ol>
                <li>Download the screenshot using the button below</li>
                <li>In the Twitter compose window, click the "Add photos or video" icon</li>
                <li>Select the downloaded screenshot to attach it to your tweet</li>
            </ol>
            <div class="screenshot-buttons">
                <button id="download-screenshot-btn">Download Screenshot</button>
                <button id="open-twitter-btn">Open Twitter</button>
                <button id="close-message-btn">Close</button>
            </div>
        `;
        document.body.appendChild(message);
        
        // Add entrance animation
        setTimeout(() => {
            message.style.opacity = '0';
            message.style.transform = 'translate(-50%, -50%) scale(0.8)';
            
            // Force reflow
            message.offsetHeight;
            
            // Apply animation
            message.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            message.style.opacity = '1';
            message.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);
        
        // Add event listener for the download button
        const downloadBtn = document.getElementById('download-screenshot-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                // Create a temporary link element to download the image
                const link = document.createElement('a');
                link.href = imgData;
                link.download = `3DJumper_Score${score}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }
        
        // Add event listener for the Twitter button
        const twitterBtn = document.getElementById('open-twitter-btn');
        if (twitterBtn) {
            twitterBtn.addEventListener('click', () => {
                // Open Twitter with the pre-populated text
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
                window.open(twitterUrl, '_blank');
            });
        }
        
        // Add event listener to close the message
        const closeBtn = document.getElementById('close-message-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                // Add exit animation
                message.style.transition = 'all 0.4s ease-in';
                message.style.opacity = '0';
                message.style.transform = 'translate(-50%, -50%) scale(0.8)';
                
                // Remove after animation completes
                setTimeout(() => {
                    message.remove();
                }, 400);
            });
        }
    });
}

// Function to restart the game
function restartGame() {
    // Get the game complete UI
    const gameComplete = document.getElementById('game-complete');
    if (gameComplete) {
        // Add exit animation
        gameComplete.style.transition = 'all 0.4s ease-in';
        gameComplete.style.opacity = '0';
        gameComplete.style.transform = 'translate(-50%, -50%) scale(0.8)';
        
        // Remove after animation completes
        setTimeout(() => {
            gameComplete.remove();
            
            // Reset to level 1
            currentLevel = 1;
            
            // Reset game state
            resetGameState();
            
            // Create new level
            createLevel(currentLevel);
            
            // Update UI
            updateLevelDisplay();
            
            // Reset player position
            resetPlayer();
            
            // Reset score and coins only when restarting the whole game
            score = 0;
            coinsCollected = 0;
            updateUI();
            
            // Start the game again
            gameStarted = true;
            canMove = true;
        }, 400);
    }
}

// Function to take a screenshot
function takeScreenshot() {
    return new Promise(resolve => {
        // Render the current scene to get a screenshot
        renderer.render(scene, camera);
        
        // Convert the canvas to an image data URL
        const imgData = renderer.domElement.toDataURL('image/png');
        
        // In a real implementation, you would upload this image to a server
        // and then use the URL in the tweet. For now, we'll just return the data
        console.log("Screenshot taken!");
        
        resolve(imgData);
    });
}

// Add infinity mode initialization
function initInfinityMode(difficulty) {
    // Stop any existing animation
    stopAnimation();
    
    // Initialize the game if not already initialized
    if (!scene) {
        if (!init()) {
            console.error('Failed to initialize game');
            return;
        }
    }

    isInfinityMode = true;
    infinityDifficulty = difficulty;
    platformsCleared = 0;
    nextPlatformIndex = 7;
    lastGeneratedHeight = 2;
    score = 0;
    coinsCollected = 0;

    clearLevel();
    createInfinityLevel();
    
    // Update UI
    document.getElementById('level-display').textContent = `Infinity Mode - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
    document.getElementById('score-value').textContent = '0';
    document.getElementById('coins-value').textContent = '0';
    
    // Hide overlays
    document.getElementById('infinity-mode-select').style.display = 'none';
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    
    // Reset player position
    player.position.set(0, 5, 0);
    velocity = 0;
    
    // Start the game
    gameStarted = true;
    canMove = true;

    // Start animation loop with the new function
    startAnimation();
}

function generateNewPlatforms() {
    const config = INFINITY_CONFIG[infinityDifficulty];
    let lastPlatform = platforms[platforms.length - 1];
    let startHeight = lastGeneratedHeight + config.heightStep;
    
    for (let i = 0; i < config.newPlatformsCount; i++) {
        const height = startHeight + (i * config.heightStep);
        let platformType = 'normal';
        
        // Determine platform type based on difficulty
        const rand = Math.random();
        if (config.platformTypes.includes('moving') && config.platformTypes.includes('disappearing')) {
            if (rand < config.movingPlatformChance) platformType = 'moving';
            else if (rand < config.movingPlatformChance + config.disappearingPlatformChance) platformType = 'disappearing';
        } else if (config.platformTypes.includes('moving')) {
            if (rand < config.movingPlatformChance) platformType = 'moving';
        }
        
        // Calculate new position relative to the last platform with reduced distance
        const maxOffset = 3; // Reduced from 4 to keep platforms closer
        const x = lastPlatform ? lastPlatform.position.x + (Math.random() * maxOffset * 2 - maxOffset) : 0;
        const z = lastPlatform ? lastPlatform.position.z + (Math.random() * maxOffset * 2 - maxOffset) : 0;
        
        // Create platform with config-specific width
        const platform = createPlatform(x, height, config.platformWidth, 0.5, getPlatformColor(platformType));
        platform.position.z = z;
        
        if (platformType === 'moving') {
            setupMovingPlatform(platform, x, z);
        } else if (platformType === 'disappearing') {
            setupDisappearingPlatform(platform);
        }
        
        platforms.push(platform);
        lastPlatform = platform;
        
        // Create and properly position coin above the platform
        const coinY = height + 1.5;
        const coin = createCoin(x, coinY, z);
        
        lastGeneratedHeight = height;
    }
}

function checkInfinityProgress() {
    if (!isInfinityMode) return;
    
    const playerHeight = player.position.y;
    const config = INFINITY_CONFIG[infinityDifficulty];
    
    // Generate new platforms when player reaches certain height
    if (playerHeight > lastGeneratedHeight - (config.heightStep * 3)) {
        generateNewPlatforms();
        platformsCleared += config.newPlatformsCount;
    }
    
    // Remove platforms that are too far below
    // Only remove platforms if there are more than a minimum number
    const minPlatformsToKeep = 20; // Keep at least 20 platforms at all times
    
    if (platforms.length > minPlatformsToKeep) {
        const platformsToRemove = [];
        // Increased distance to keep platforms visible much longer
        const minHeight = playerHeight - 80; 
        
        for (let i = 0; i < platforms.length; i++) {
            if (platforms[i].position.y < minHeight) {
                platformsToRemove.push(i);
                
                // Also remove associated coins
                coins.forEach((coin, coinIndex) => {
                    if (coin && platforms[i] && 
                        Math.abs(coin.position.y - platforms[i].position.y - 1.5) < 0.1) {
                        scene.remove(coin);
                        coins.splice(coinIndex, 1);
                    }
                });
            }
        }
        
        // Remove platforms from the end of the array
        for (let i = platformsToRemove.length - 1; i >= 0; i--) {
            const index = platformsToRemove[i];
            const platform = platforms[index];
            scene.remove(platform);
            platforms.splice(index, 1);
        }
    }
}

function showInfinityGameOver() {
    // Stop the animation loop
    stopAnimation();
    gameStarted = false;
    
    // Calculate final score
    const finalScore = score + (coinsCollected * INFINITY_CONFIG[infinityDifficulty].coinValue);
    
    // Award $JUMPER tokens for total score in infinity mode
    if (window.addUnclaimedTokens) {
        window.addUnclaimedTokens(finalScore).then(() => {
            // Update token UI if visible
            if (window.tokenFunctions) {
                // Show token notification in center of screen
                window.showTokenNotification(finalScore, window.innerWidth / 2, window.innerHeight / 2);
            }
        }).catch(err => console.error('Error adding infinity score tokens:', err));
    }
    
    // Update UI
    document.getElementById('infinity-coins').textContent = coinsCollected;
    document.getElementById('infinity-score').textContent = finalScore;
    
    // Show game over screen
    document.getElementById('infinity-game-over').style.display = 'flex';
    
    // Focus on the name input
    const playerNameInput = document.getElementById('player-name');
    playerNameInput.focus();
    playerNameInput.value = ''; // Clear previous input
    
    // Reset button states
    const submitButton = document.getElementById('submit-score-btn');
    submitButton.disabled = false;
    submitButton.textContent = 'Submit Score';
    
    // Set up submit button
    document.getElementById('submit-score-btn').onclick = async function() {
        const playerName = document.getElementById('player-name').value;
        if (!playerName.trim()) {
            alert('Please enter your name');
            return;
        }
        
        try {
            console.log('Submitting score with:', { 
                playerName, 
                score: finalScore, 
                coins: coinsCollected, 
                difficulty: infinityDifficulty 
            });
            
            await submitScore(playerName, finalScore, coinsCollected, infinityDifficulty);
            
            // Disable button after submission
            document.getElementById('submit-score-btn').disabled = true;
            document.getElementById('submit-score-btn').textContent = 'Score Submitted!';
            playerNameInput.disabled = true;
            
            // Reload leaderboard with current difficulty
            loadLeaderboard(infinityDifficulty);
        } catch (error) {
            console.error('Failed to submit score:', error);
            alert('Failed to submit score. Please try again.');
        }
    };
    
    // Set up restart button with full game reset
    document.getElementById('infinity-restart-btn').onclick = function() {
        document.getElementById('infinity-game-over').style.display = 'none';
        
        // Reset game state
        score = 0;
        coinsCollected = 0;
        updateUI();
        
        // Reset player position
        player.position.set(0, 5, 0);
        velocity = 0;
        
        // Clear and recreate level
        clearLevel();
        createInfinityLevel();
        
        // Restart game
        gameStarted = true;
        startAnimation();
    };
}

function createInfinityLevel() {
    const config = INFINITY_CONFIG[infinityDifficulty];
    
    // Create first platform
    const firstPlatform = createPlatform(0, 2, config.platformWidth, 0.5, 0x1a1a1a);
    firstPlatform.position.z = 0;
    platforms.push(firstPlatform);
    const firstCoin = createCoin(0, 3.5, 0);
    
    let lastX = 0;
    let lastZ = 0;
    let lastY = 2;
    
    // Generate initial platforms
    for (let i = 1; i < config.initialPlatforms; i++) {
        const height = lastY + config.heightStep;
        let platformType = 'normal';
        
        // Determine platform type based on difficulty
        const rand = Math.random();
        if (config.platformTypes.includes('moving') && config.platformTypes.includes('disappearing')) {
            if (rand < config.movingPlatformChance) platformType = 'moving';
            else if (rand < config.movingPlatformChance + config.disappearingPlatformChance) platformType = 'disappearing';
        } else if (config.platformTypes.includes('moving')) {
            if (rand < config.movingPlatformChance) platformType = 'moving';
        }
        
        // Calculate new position relative to the last platform with reduced distance
        const maxOffset = 3; // Reduced from 4 to keep platforms closer
        const x = lastX + (Math.random() * maxOffset * 2 - maxOffset);
        const z = lastZ + (Math.random() * maxOffset * 2 - maxOffset);
        
        // Create platform with config-specific width
        const platform = createPlatform(x, height, config.platformWidth, 0.5, getPlatformColor(platformType));
        platform.position.z = z;
        
        if (platformType === 'moving') {
            setupMovingPlatform(platform, x, z);
        } else if (platformType === 'disappearing') {
            setupDisappearingPlatform(platform);
        }
        
        platforms.push(platform);
        
        // Create and properly position coin above the platform
        const coinY = height + 1.5;
        const coin = createCoin(x, coinY, z);
        
        lastX = x;
        lastZ = z;
        lastY = height;
        lastGeneratedHeight = height;
    }
}

function setupMovingPlatform(platform, x, z) {
    // Add movement properties
    const movement = {
        center: new THREE.Vector3(x, platform.position.y, z),
        amplitude: 2,
        speed: 0.02,
        time: Math.random() * Math.PI * 2, // Random start phase
        axis: Math.random() < 0.5 ? 'x' : 'z' // Randomly choose movement axis
    };
    
    movingPlatforms.push({ platform, movement });
    return platform;
}

function setupDisappearingPlatform(platform) {
    platformStates.set(platform.id, {
        visible: true,
        timeoutId: null,
        cooldown: false
    });
    
    return platform;
}

// Update infinity mode button click handlers
document.getElementById('infinity-button').addEventListener('click', () => {
    document.getElementById('infinity-mode-select').style.display = 'flex';
});

document.getElementById('easy-mode').addEventListener('click', () => {
    initInfinityMode('easy');
});

document.getElementById('medium-mode').addEventListener('click', () => {
    initInfinityMode('medium');
});

document.getElementById('hard-mode').addEventListener('click', () => {
    initInfinityMode('hard');
});

// Add event listeners for infinity mode
document.getElementById('infinity-restart-button').addEventListener('click', () => {
    const gameOverScreen = document.getElementById('infinity-game-over');
    
    // Animate out
    gameOverScreen.style.opacity = '0';
    gameOverScreen.style.transform = 'translate(-50%, -50%) scale(0.8)';
    
    // Hide after animation completes
    setTimeout(() => {
        gameOverScreen.style.display = 'none';
        // Reset transform for next time
        gameOverScreen.style.transform = '';
        // Restart with same difficulty
        initInfinityMode(infinityDifficulty);
    }, 400);
});

// Helper function to get platform color
function getPlatformColor(type) {
    switch (type) {
        case 'moving':
            return 0x9945FF; // Solana purple
        case 'disappearing':
            return 0x14F195; // Solana green
        case 'goal':
            return 0xF3BA2F; // Solana gold
        default:
            return 0x1a1a1a; // Dark gray
    }
}

// Show game over screen for regular mode
function showGameOver() {
    // Stop the animation loop
    stopAnimation();
    
    // Update final score in the game over screen
    document.getElementById('final-score').textContent = `Final Score: ${score}`;
    
    // Get the game over screen element
    const gameOverScreen = document.getElementById('game-over');
    
    // Display the screen
    gameOverScreen.style.display = 'flex';
    
    // Stop game
    gameStarted = false;
    canMove = false;
}

// Add event listener for regular game restart button
document.getElementById('restart-button').addEventListener('click', () => {
    document.getElementById('game-over').style.display = 'none';
    
    // Reset to level 1
    currentLevel = 1;
    
    // Reset game state
    resetGameState();
    
    // Create new level
    createLevel(currentLevel);
    
    // Update UI
    updateLevelDisplay();
    
    // Reset player position
    resetPlayer();
    
    // Reset score and coins
    score = 0;
    coinsCollected = 0;
    updateUI();
    
    // Start the game again
    gameStarted = true;
    canMove = true;

    // Restart animation
    startAnimation();
}); 

// Create stars in the night sky
function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.8, // Increased size significantly for better visibility
        transparent: true,
        opacity: 1.0,
        sizeAttenuation: false // Set to false to make stars visible at any distance
    });
    
    const starsCount = 3000; // More stars
    const starsPositions = [];
    
    for (let i = 0; i < starsCount; i++) {
        // Create stars in a hemisphere closer to the camera
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.65;
        const radius = 60 + Math.random() * 30; // Reduced radius to make stars closer
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        
        starsPositions.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsPositions, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    
    // Add some VERY BRIGHT stars
    const brightStarsGeometry = new THREE.BufferGeometry();
    const brightStarsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.5, // Even bigger
        transparent: true,
        opacity: 1.0,
        sizeAttenuation: false // Set to false to make stars visible at any distance
    });
    
    const brightStarsCount = 500; // More bright stars
    const brightStarsPositions = [];
    
    for (let i = 0; i < brightStarsCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.65;
        const radius = 60 + Math.random() * 30;
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        
        brightStarsPositions.push(x, y, z);
    }
    
    brightStarsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(brightStarsPositions, 3));
    const brightStars = new THREE.Points(brightStarsGeometry, brightStarsMaterial);
    scene.add(brightStars);
    
    return { stars, brightStars };
}

// Call the createStars function to add stars to the scene
createStars();

// Create clouds in the night sky
function createClouds() {
    const clouds = new THREE.Group();
    
    // Parameters for cloud distribution
    const cloudCount = 15;
    const minHeight = 20; // Lower height to be more visible
    const maxHeight = 40; // Lower max height
    const distributionRadius = 50; // Smaller radius to keep clouds closer
    
    // Create multiple cloud clusters
    for (let i = 0; i < cloudCount; i++) {
        const cloudCluster = new THREE.Group();
        
        // Random position for this cluster
        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * distributionRadius; // Ensure some clouds are closer
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = minHeight + Math.random() * (maxHeight - minHeight);
        
        // Size of this cluster
        const clusterSize = 5 + Math.floor(Math.random() * 5); // More particles per cloud
        
        // Create individual cloud particles
        for (let j = 0; j < clusterSize; j++) {
            // Create a cloud puff
            const cloudGeometry = new THREE.SphereGeometry(2.5 + Math.random() * 3, 8, 8); // Larger size
            
            // Create a material with soft edges - lighter color for night clouds
            const cloudMaterial = new THREE.MeshPhongMaterial({
                color: 0x4A4F82, // Lighter bluish color for better visibility
                emissive: 0x2A305F,
                emissiveIntensity: 0.3, // Add some self-illumination
                transparent: true,
                opacity: 0.7 + Math.random() * 0.3, // Higher opacity
                flatShading: true
            });
            
            const cloudPuff = new THREE.Mesh(cloudGeometry, cloudMaterial);
            
            // Position within the cluster
            const puffRadius = 4; // Larger cluster
            const puffAngle = Math.random() * Math.PI * 2;
            const puffX = Math.cos(puffAngle) * puffRadius * Math.random();
            const puffZ = Math.sin(puffAngle) * puffRadius * Math.random();
            const puffY = Math.random() * 3;
            
            cloudPuff.position.set(puffX, puffY, puffZ);
            cloudPuff.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            cloudCluster.add(cloudPuff);
        }
        
        // Position the entire cluster
        cloudCluster.position.set(x, y, z);
        
        // Add subtle animation data
        cloudCluster.userData = {
            rotSpeed: (Math.random() - 0.5) * 0.001,
            moveSpeed: 0.01 + Math.random() * 0.01,
            moveAngle: Math.random() * Math.PI * 2,
            amplitude: 0.5 + Math.random() * 0.5,
            waveFactor: 0.1 + Math.random() * 0.3,
            originY: y
        };
        
        clouds.add(cloudCluster);
    }
    
    scene.add(clouds);
    
    return clouds;
}

// Call the createClouds function to add clouds to the scene
createClouds();

// Create a spaceship that moves across the sky
function createSpaceship() {
    // Create the main body of the spaceship
    const bodyGeometry = new THREE.CylinderGeometry(0, 2.5, 7, 8); // Much larger size
    bodyGeometry.rotateX(Math.PI / 2);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x9945FF, // Solana purple
        emissive: 0x9945FF,
        emissiveIntensity: 0.8, // Increased for better visibility
        metalness: 0.8,
        roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    
    // Create the cockpit
    const cockpitGeometry = new THREE.SphereGeometry(1.5, 16, 16); // Larger
    const cockpitMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x14F195, // Solana green
        emissive: 0x14F195,
        emissiveIntensity: 0.8, // Increased
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.9
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0, -3.2); // Adjusted for larger ship
    
    // Create wings
    const wingGeometry = new THREE.BoxGeometry(7, 0.5, 2, 1, 1, 1); // Larger
    const wingMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xF3BA2F, // Solana gold
        emissive: 0xF3BA2F,
        emissiveIntensity: 0.8 // Increased
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    
    // Create engine glow
    const engineGlowGeometry = new THREE.CylinderGeometry(1.0, 1.5, 2.5, 16); // Larger
    engineGlowGeometry.rotateX(Math.PI / 2);
    const engineGlowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xF3BA2F, 
        transparent: true,
        opacity: 1.0 // Full opacity
    });
    const engineGlow = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
    engineGlow.position.set(0, 0, 4.2); // Adjusted for larger ship
    
    // Create a stronger point light for the engine
    const engineLight = new THREE.PointLight(0xF3BA2F, 10, 30); // Increased intensity
    engineLight.position.set(0, 0, 5);
    
    // Additional lights to make the ship more visible
    const shipLight1 = new THREE.PointLight(0x9945FF, 5, 20);
    shipLight1.position.set(0, 2, 0);
    
    const shipLight2 = new THREE.PointLight(0x14F195, 5, 20);
    shipLight2.position.set(0, -2, 0);
    
    // Group all parts together
    const spaceship = new THREE.Group();
    spaceship.add(body);
    spaceship.add(cockpit);
    spaceship.add(wings);
    spaceship.add(engineGlow);
    spaceship.add(engineLight);
    spaceship.add(shipLight1);
    spaceship.add(shipLight2);
    
    // Position the spaceship high in the sky but closer to the play area
    spaceship.position.set(-40, 35, -30); // Higher position but closer
    spaceship.rotation.y = Math.PI / 4;
    spaceship.scale.set(2, 2, 2); // Scale up the entire ship significantly
    scene.add(spaceship);
    
    // Animation parameters
    const pathRadius = 80; // Keep the path smaller so it's more visible
    const speed = 0.0008; // Slightly faster
    let angle = 0;
    
    // Animation function for the spaceship
    function animateSpaceship() {
        angle += speed;
        
        // Move in a circular path
        spaceship.position.x = Math.cos(angle) * pathRadius;
        spaceship.position.z = Math.sin(angle) * pathRadius;
        
        // Make it slightly bob up and down
        spaceship.position.y = 35 + Math.sin(angle * 2) * 10;
        
        // Rotate to face direction of travel
        spaceship.rotation.y = angle + Math.PI / 2;
        
        // Add a slight banking effect
        spaceship.rotation.z = Math.sin(angle) * 0.2;
        
        requestAnimationFrame(animateSpaceship);
    }
    
    animateSpaceship();
    
    return spaceship;
}

// Call the function to create and animate the spaceship
createSpaceship();

// Add a function to update the follow light and other lights in the game
function updateLights() {
    // Update the follow light to move with the player
    if (window.followLight && player) {
        window.followLight.position.copy(player.position);
        window.followLight.position.y += 2;
        
        // Point the light upward in the direction the player is looking
        const targetY = player.position.y + 20;
        window.followLight.target.position.set(player.position.x, targetY, player.position.z);
        window.followLight.target.updateMatrixWorld();
    }
}