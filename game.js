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

// Camera control variables
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraAngle = { x: 0, y: 0 };
let targetCameraAngle = { x: 0, y: 0 };
let cameraDistance = 10;
let isReturningCamera = false;

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

// Create Level 1 platforms with 3D spread
function createLevel1Platforms() {
    const platformPositions = [
        { x: 0, y: 2, z: 0, width: 3 },          // First step
        { x: 3, y: 4, z: 2, width: 3 },          // Second step (right and forward)
        { x: -2, y: 6, z: -3, width: 3 },        // Third step (left and back)
        { x: 4, y: 8, z: -2, width: 3 },         // Fourth step (right and back)
        { x: 0, y: 10, z: 3, width: 3 },         // Fifth step (center and forward)
        { x: -3, y: 12, z: 0, width: 3 }         // Final platform (left and center)
    ];

    platformPositions.forEach(pos => {
        const platform = createPlatform(pos.x, pos.y, pos.width, 0.5, 0x228B22);
        platform.position.z = pos.z;
        platforms.push(platform);
    });
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Handle keyboard input with smooth forward/backward movement
function onKeyDown(event) {
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

// Check platform collisions with improved detection
function checkPlatformCollisions() {
    let onPlatform = false;
    const playerBox = new THREE.Box3().setFromObject(player);
    const playerBottom = player.position.y - 0.5;
    const playerCenter = new THREE.Vector3(
        player.position.x,
        player.position.y,
        player.position.z
    );

    platforms.forEach(platform => {
        const platformBox = new THREE.Box3().setFromObject(platform);
        const platformTop = platform.position.y + 0.25;
        const platformBottom = platform.position.y - 0.25;
        
        // Get platform dimensions
        const platformWidth = platform.geometry.parameters.width;
        const platformDepth = platform.geometry.parameters.depth;
        
        // Calculate horizontal distance
        const dx = Math.abs(player.position.x - platform.position.x);
        const dz = Math.abs(player.position.z - platform.position.z);
        
        // Check if player is within platform bounds
        if (dx < platformWidth / 2 + 0.4 && dz < platformDepth / 2 + 0.4) {
            // Check for vertical collision
            if (playerBottom >= platformTop - 0.2 && playerBottom <= platformTop + 0.2 && velocity <= 0) {
                // Land on platform
                player.position.y = platformTop + 0.5;
                velocity = 0;
                isJumping = false;
                onPlatform = true;
            }
            // Check for head collision
            else if (player.position.y + 0.5 >= platformBottom && player.position.y + 0.5 <= platformBottom + 0.2 && velocity > 0) {
                // Hit head on platform
                velocity = 0;
            }
        }
    });

    return onPlatform;
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
    isReturningCamera = true;
}

// Update camera position with smooth return
function updateCamera() {
    if (isReturningCamera) {
        // Smoothly return to original angle
        cameraAngle.x += (targetCameraAngle.x - cameraAngle.x) * 0.05;
        cameraAngle.y += (targetCameraAngle.y - cameraAngle.y) * 0.05;

        // Check if camera has nearly returned to original position
        if (Math.abs(cameraAngle.x) < 0.01 && Math.abs(cameraAngle.y) < 0.01) {
            cameraAngle.x = 0;
            cameraAngle.y = 0;
            isReturningCamera = false;
        }
    }

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

// Update game state
function update() {
    if (!gameStarted) return;

    // Apply horizontal and forward/backward movement
    if (moveLeft) {
        player.position.x -= moveSpeed;
    }
    if (moveRight) {
        player.position.x += moveSpeed;
    }
    if (moveForward) {
        player.position.z -= moveSpeed;
    }
    if (moveBackward) {
        player.position.z += moveSpeed;
    }

    // Apply gravity and vertical movement
    if (!checkPlatformCollisions()) {
        velocity += gravity;
        isJumping = true;
    }
    
    // Apply velocity with maximum fall speed
    velocity = Math.max(velocity, -0.5); // Limit fall speed
    player.position.y += velocity;

    // Check if player has fallen to ground level
    if (player.position.y < 0) {
        player.position.y = 0;
        velocity = 0;
        isJumping = false;
    }

    // Check if player is too far from base (out of bounds)
    const distanceFromCenter = Math.sqrt(
        player.position.x * player.position.x + 
        player.position.z * player.position.z
    );
    
    if (distanceFromCenter > 45) { // 45 units from center (base is 100x100)
        resetPlayer();
    }

    // Update camera position
    updateCamera();
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
                if (!gameStarted) {
                    if (init()) {
                        gameStarted = true;
                        animate();
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