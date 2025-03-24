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

// Update platform spacing constants at the top
const PLATFORM_SPACING = {
    MIN_HORIZONTAL: 3.5,    // Minimum horizontal distance between platforms
    MAX_HORIZONTAL: 5,      // Maximum horizontal distance between platforms
    HEIGHT_STEP: 2.5,       // Vertical distance between platforms
    SAFE_PLATFORM_DISTANCE: 3.5  // Distance between red and green platforms
};

// Initialize Three.js scene
function init() {
    try {
        // Initialize scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB); // Sky blue
        
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
        renderer.setClearColor(0x87CEEB, 1); // Sky blue background

        // Create player
        const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
        const playerMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        player = new THREE.Mesh(playerGeometry, playerMaterial);
        player.position.set(0, 5, 0);
        scene.add(player);

        // Add ground
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x228B22,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1;
        scene.add(ground);

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        scene.add(directionalLight);

        // Create initial platforms
        createPlatforms();

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

        console.log('Game initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing game:', error);
        alert('Error: ' + error.message);
        return false;
    }
}

// Create platforms for current level
function createPlatforms() {
    // Clear existing platforms
    platforms.forEach(platform => scene.remove(platform));
    platforms = [];

    // Create main platform
    const mainPlatform = createPlatform(0, 0, 10, 1, 0x228B22);
    platforms.push(mainPlatform);

    // Create level-specific platforms
    if (currentLevel === 1) {
        createLevel1Platforms();
    }
}

// Create a single platform with improved collision box
function createPlatform(x, y, width, height, color) {
    const geometry = new THREE.BoxGeometry(width, height, 2);
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
    const firstPlatform = createPlatform(0, 2, 3, 0.5, 0x228B22);
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
        const width = 3; // Fixed width for better consistency

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
                const safePlatform = createPlatform(safeX, height, width, 0.5, 0x228B22);
                safePlatform.position.z = safeZ;
                platforms.push(safePlatform);
                createCoin(safeX, height + 1.5, safeZ);
                break;
            default:
                platform = createPlatform(x, height, width, 0.5, 0x228B22);
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
    createGoalPlatform(0, finalHeight, 0, 4);
    createCoin(0, finalHeight + 1.5, 0);
}

// Create a moving platform
function createMovingPlatform(x, y, z, width) {
    const platform = createPlatform(x, y, width, 0.5, 0x1E90FF); // Blue color
    platform.position.z = z;
    
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
    const platform = createPlatform(x, y, width, 0.5, 0xFF6B6B); // Red color
    platform.position.z = z;
    
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
    const platformDepth = platform.geometry.parameters.depth || 2;

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
        const platformDepth = platform.geometry.parameters.depth || 2;

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
        const platformTop = goalPlatform.position.y + 0.25;

        if (dx < (platformWidth / 2 + playerRadius) && 
            dz < (1 + playerRadius) && 
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

// Update keyboard input handling to fix command key issue
function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey) return; // Ignore if command/ctrl key is pressed
    
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
    if (event.metaKey || event.ctrlKey) {
        // Reset all movement when command/ctrl key is released
        moveLeft = false;
        moveRight = false;
        moveForward = false;
        moveBackward = false;
        return;
    }
    
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

// Update game state with camera-relative movement
function update() {
    if (!gameStarted || isLevelComplete) return;

    // Update moving platforms
    updateMovingPlatforms();

    // Calculate movement direction based on camera angle
    const moveDirection = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // Calculate forward and right vectors relative to camera
    const forward = new THREE.Vector3(
        -Math.sin(cameraAngle.y),
        0,
        -Math.cos(cameraAngle.y)
    ).normalize();
    
    const right = new THREE.Vector3(
        Math.cos(cameraAngle.y),
        0,
        -Math.sin(cameraAngle.y)
    ).normalize();

    // Apply movement based on camera direction
    if (moveForward) {
        moveDirection.add(forward);
    }
    if (moveBackward) {
        moveDirection.sub(forward);
    }
    if (moveLeft) {
        moveDirection.sub(right);
    }
    if (moveRight) {
        moveDirection.add(right);
    }

    // Normalize and apply movement
    if (moveDirection.length() > 0) {
        moveDirection.normalize();
        player.position.x += moveDirection.x * moveSpeed;
        player.position.z += moveDirection.z * moveSpeed;
    }

    // Apply gravity and vertical movement
    if (!checkPlatformCollisions()) {
        velocity += gravity;
        isJumping = true;
    }
    
    // Apply velocity with maximum fall speed
    velocity = Math.max(velocity, -0.5);
    player.position.y += velocity;

    // Check if player has fallen to ground level
    if (player.position.y < 0) {
        player.position.y = 0;
        velocity = 0;
        isJumping = false;
    }

    // Check if player is too far from base
    const distanceFromCenter = Math.sqrt(
        player.position.x * player.position.x + 
        player.position.z * player.position.z
    );
    
    if (distanceFromCenter > 45) {
        resetPlayer();
    }

    // Check for coin collection
    checkCoinCollection();

    // Rotate coins
    coins.forEach(coin => {
        if (coin.visible) {
            coin.rotation.z += 0.02;
        }
    });

    // Update camera position
    updateCamera();

    // Check level completion
    checkLevelCompletion();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    if (gameStarted) {
        update();
        renderer.render(scene, camera);
    }
}

// Start game when button is clicked
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    const startButton = document.getElementById('start-button');
    if (startButton) {
        startButton.addEventListener('click', () => {
            console.log('Start button clicked');
            const username = document.getElementById('username-input').value.trim();
            if (username) {
                document.getElementById('start-screen').style.display = 'none';
                document.getElementById('game-ui').style.display = 'block'; // Show the game UI
                if (!gameStarted) {
                    if (init()) {
                        gameStarted = true;
                        animate();
                        // Initialize score display
                        score = 0;
                        coinsCollected = 0;
                        updateUI();
                        console.log('Game started successfully');
                    }
                }
            } else {
                alert('Please enter your name to start the game');
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
        color: 0xFFD700,
        emissive: 0xFFD700,
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
        score += 100;
        coinsCollected++;
        updateUI();
        
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
        color: 0xFFD700,
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

// Create a goal platform with distinct appearance
function createGoalPlatform(x, y, z, width) {
    const geometry = new THREE.BoxGeometry(width, 0.5, 2);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xFFD700,
        emissive: 0xFFD700,
        emissiveIntensity: 0.4,
        metalness: 1.0,
        roughness: 0.2
    });
    goalPlatform = new THREE.Mesh(geometry, material);
    goalPlatform.position.set(x, y, z);
    scene.add(goalPlatform);

    // Add subtle pulsing glow effect
    const glowGeometry = new THREE.BoxGeometry(width + 0.4, 0.7, 2.4);
    const glowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFD700,
        transparent: true,
        opacity: 0.15
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(goalPlatform.position);
    scene.add(glow);

    // Animate glow with smoother pulsing
    let time = 0;
    const animateGlow = () => {
        if (goalPlatform.parent) {
            time += 0.02;
            glowMaterial.opacity = 0.15 + Math.sin(time) * 0.05;
            requestAnimationFrame(animateGlow);
        }
    };
    animateGlow();
}

// Update level completion check
function checkLevelCompletion() {
    if (!isLevelComplete && goalPlatform) {
        const playerPos = player.position;
        const goalPos = goalPlatform.position;
        const distance = playerPos.distanceTo(goalPos);

        if (distance < 2) {
            // Calculate bonus for collected coins
            const coinBonus = coinsCollected * 200; // 200 points per coin
            score += coinBonus;
            
            completedLevel();
        }
    }
}

// Level completion handler
function completedLevel() {
    isLevelComplete = true;
    const levelBonus = 1000;
    score += levelBonus;
    
    // Show level complete UI with coin collection bonus
    const coinBonus = coinsCollected * 200;
    showLevelCompleteUI(coinBonus);
    
    // Prepare for next level
    setTimeout(() => {
        if (currentLevel < totalLevels) {
            currentLevel++;
            loadNextLevel();
        } else {
            showGameCompleteUI();
        }
    }, 2000);
}

// Show level complete UI with coin bonus
function showLevelCompleteUI(coinBonus) {
    const levelComplete = document.createElement('div');
    levelComplete.id = 'level-complete';
    levelComplete.innerHTML = `
        <h2>Level ${currentLevel} Complete!</h2>
        <p>Level Score: ${score}</p>
        <p>Coins Collected: ${coinsCollected}</p>
        <p>Coin Bonus: +${coinBonus}</p>
        ${currentLevel < totalLevels ? '<p>Next level starting soon...</p>' : '<p>Game Complete!</p>'}
    `;
    document.body.appendChild(levelComplete);

    // Remove after animation
    setTimeout(() => {
        levelComplete.remove();
    }, 2000);
}

// Load next level
function loadNextLevel() {
    // Reset player position
    resetPlayer();
    
    // Clear current level
    platforms.forEach(platform => scene.remove(platform));
    platforms = [];
    coins.forEach(coin => scene.remove(coin));
    coins = [];
    if (goalPlatform) {
        scene.remove(goalPlatform);
    }
    
    // Create new level
    createPlatforms();
    addCoinsToLevel();
    
    // Reset level state
    isLevelComplete = false;
    isJumping = false;
    velocity = 0;
    
    // Update UI
    updateUI();
} 