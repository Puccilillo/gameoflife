/* ====================================== Declarations =================================== */

// Canvas and context
const canvas = document.getElementById('gol-canvas');
const ctx = canvas.getContext('2d');

// Dimensions
let width;
let height;

// Sparse storage of alive cells (Set of "x,y" strings)
let aliveCells = new Set();

// Camera and zoom
let cameraX = -40;
let cameraY = -30;
let zoom = 10; // pixels per cell

// Simulation control
let paused = false;
let delay = 0; // ms between generations
let lastFrame = 0;

// UI elements
const pauseBtn = document.getElementById('pause-btn');
const speedLabel = document.getElementById('speed-label');
const speedUpBtn = document.getElementById('speed-up');
const speedDownBtn = document.getElementById('speed-down');

// Mouse drag variables
let isDragging = false;
let dragStartX, dragStartY;

// Mouse position tracking
let lastMouseX = 0;
let lastMouseY = 0;

// FPS tracking variables
let fps = 0;
let lastFpsUpdate = 0;
let framesThisSecond = 0;

/* ====================================== Functions ====================================== */
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 30;
    width = canvas.width;
    height = canvas.height;
}

function updateSpeedLabel() { speedLabel.textContent = `Delay: ${delay} ms`; }

function cellKey(x, y) { return `${x},${y}`; }

function parseKey(k) { return k.split(',').map(Number); }

function initGlider(x, y) {
    let coords = [
        [x + 1, y], [x + 2, y + 1], [x, y + 2],
        [x + 1, y + 2], [x + 2, y + 2]
    ];
    coords.forEach(([cx, cy]) => aliveCells.add(cellKey(cx, cy)));
}

// Pattern definitions for keyboard shortcuts
const patterns = {
    // 1: Glider (moves diagonally)
    '1': [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
    
    // 2: Blinker (period 2 oscillator)
    '2': [[0, 0], [1, 0], [2, 0]],
    
    // 3: Toad (period 2 oscillator)
    '3': [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]],
    
    // 4: Beacon (period 2 oscillator)
    '4': [[0, 0], [1, 0], [0, 1], [2, 3], [3, 3], [3, 2]],
    
    // 5: Lightweight Spaceship (LWSS)
    '5': [[1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3]],
    
    // 6: Pulsar (period 3 oscillator)
    '6': [
        [2, 0], [3, 0], [4, 0], [8, 0], [9, 0], [10, 0],
        [0, 2], [5, 2], [7, 2], [12, 2],
        [0, 3], [5, 3], [7, 3], [12, 3],
        [0, 4], [5, 4], [7, 4], [12, 4],
        [2, 5], [3, 5], [4, 5], [8, 5], [9, 5], [10, 5],
        [2, 7], [3, 7], [4, 7], [8, 7], [9, 7], [10, 7],
        [0, 8], [5, 8], [7, 8], [12, 8],
        [0, 9], [5, 9], [7, 9], [12, 9],
        [0, 10], [5, 10], [7, 10], [12, 10],
        [2, 12], [3, 12], [4, 12], [8, 12], [9, 12], [10, 12]
    ],
    
    // 7: Gosper Glider Gun (creates gliders)
    '7': [
        [0, 4], [0, 5], [1, 4], [1, 5],
        [10, 4], [10, 5], [10, 6], [11, 3], [11, 7], [12, 2], [12, 8],
        [13, 2], [13, 8], [14, 5], [15, 3], [15, 7], [16, 4], [16, 5], [16, 6], [17, 5],
        [20, 2], [20, 3], [20, 4], [21, 2], [21, 3], [21, 4], [22, 1], [22, 5],
        [24, 0], [24, 1], [24, 5], [24, 6],
        [34, 2], [34, 3], [35, 2], [35, 3]
    ],
    
    // 8: Block (still life)
    '8': [[0, 0], [1, 0], [0, 1], [1, 1]],
    
    // 9: Beehive (still life)
    '9': [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]],
    
    // 0: Pentadecathlon (period 15 oscillator) - vertical orientation
    '0': [
        [1, 2], [1, 3], [0, 4], [2, 4], [1, 5], [1, 6], [1, 7], [1, 8], [0, 9], [2, 9], [1, 10], [1, 11]
    ]
};

function placePattern(patternKey, worldX, worldY) {
    const pattern = patterns[patternKey];
    if (!pattern) return;
    
    pattern.forEach(([dx, dy]) => {
        aliveCells.add(cellKey(worldX + dx, worldY + dy));
    });
}

function getNeighbors(x, y) {
    let neighbors = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (aliveCells.has(cellKey(x + dx, y + dy))) neighbors++;
        }
    }
    return neighbors;
}

function nextGen() {
    let candidates = new Set();

    aliveCells.forEach(key => {
        let [x, y] = parseKey(key);
        candidates.add(key);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                candidates.add(cellKey(x + dx, y + dy));
            }
        }
    });

    let newAlive = new Set();

    candidates.forEach(key => {
        let [x, y] = parseKey(key);
        let alive = aliveCells.has(key);
        let neighbors = getNeighbors(x, y);

        if (alive && (neighbors === 2 || neighbors === 3)) { newAlive.add(key); } 
        else if (!alive && neighbors === 3) { newAlive.add(key); }
    });

    aliveCells = newAlive;
}

function drawGrid() {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgb(0,173,255)';
    aliveCells.forEach(key => {
        let [x, y] = parseKey(key);
        let sx = Math.floor((x - cameraX) * zoom);
        let sy = Math.floor((y - cameraY) * zoom);
        if (sx + zoom >= 0 && sy + zoom >= 0 && sx < width && sy < height) {
            ctx.fillRect(sx, sy, zoom, zoom);
        }
    });

    // Draw FPS in top-left
    ctx.fillStyle = 'rgb(255,173,0)';
    ctx.font = '10px monospace';
    ctx.fillText(`FPS: ${fps}`, 10, 12);
    ctx.fillText(`CELLS: ${aliveCells.size}`, 10, 24);
}

function loop(timestamp) {
    // FPS calculation
    if (timestamp > lastFpsUpdate + 1000) {
        fps = framesThisSecond;
        framesThisSecond = 0;
        lastFpsUpdate = timestamp;
    }
    framesThisSecond++;

    if (!lastFrame) lastFrame = timestamp;
    if (!paused && timestamp - lastFrame > delay) {
        nextGen();
        lastFrame = timestamp;
    }
    drawGrid();

    requestAnimationFrame(loop);
}

/* ====================================== Event handlers ================================= */
const handlers = {
    onResize() {
        resizeCanvas();
        drawGrid();
    },
    onMouseDown(e) {
        if (e.button !== 0) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        canvas.style.cursor = 'grabbing';
    },
    onMouseUp(e) {
        if (e.button !== 0) return;
        isDragging = false;
        canvas.style.cursor = 'grab';
    },
    onMouseLeave() {
        isDragging = false;
        canvas.style.cursor = 'grab';
    },
    onMouseMove(e) {
        // Update last mouse position
        let rect = canvas.getBoundingClientRect();
        lastMouseX = e.clientX - rect.left;
        lastMouseY = e.clientY - rect.top;
        
        if (isDragging) {
            let dx = (e.clientX - dragStartX) / zoom;
            let dy = (e.clientY - dragStartY) / zoom;
            cameraX -= dx;
            cameraY -= dy;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            drawGrid();
        }
    },
    onClick(e) {
        if (isDragging) return;
        let rect = canvas.getBoundingClientRect();
        let mx = e.clientX - rect.left;
        let my = e.clientY - rect.top;
        let wx = Math.floor(cameraX + mx / zoom);
        let wy = Math.floor(cameraY + my / zoom);

        // Change a single cell state
        let key = cellKey(wx, wy);
        if (aliveCells.has(key)) aliveCells.delete(key);
        else aliveCells.add(key);

        drawGrid();
    },
    onWheel(e) {
        e.preventDefault();
        let mouseX = e.clientX - canvas.getBoundingClientRect().left;
        let mouseY = e.clientY - canvas.getBoundingClientRect().top;
        let wxBeforeZoom = cameraX + mouseX / zoom;
        let wyBeforeZoom = cameraY + mouseY / zoom;

        let zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        zoom = Math.min(50, Math.max(1, zoom * zoomFactor));

        cameraX = wxBeforeZoom - mouseX / zoom;
        cameraY = wyBeforeZoom - mouseY / zoom;

        drawGrid();
    },
    onPauseClick() {
        paused = !paused;
        pauseBtn.textContent = paused ? '▶' : '⏸';
    },
    onSpeedUpClick() {
        delay = Math.max(0, delay - 20);
        updateSpeedLabel();
    },
    onSpeedDownClick() {
        delay += 20;
        updateSpeedLabel();
    },
    onKeyDown(e) {
        // Handle number keys 0-9
        if (e.key >= '0' && e.key <= '9') {
            // Calculate world coordinates from last mouse position
            let wx = Math.floor(cameraX + lastMouseX / zoom);
            let wy = Math.floor(cameraY + lastMouseY / zoom);
            
            placePattern(e.key, wx, wy);
            drawGrid();
        }
    }
};

/* ====================================== Event listeners ================================ */
window.addEventListener('resize', handlers.onResize);
canvas.addEventListener('mousedown', handlers.onMouseDown);
canvas.addEventListener('mouseup', handlers.onMouseUp);
canvas.addEventListener('mouseleave', handlers.onMouseLeave);
canvas.addEventListener('mousemove', handlers.onMouseMove);
canvas.addEventListener('click', handlers.onClick);
canvas.addEventListener('wheel', handlers.onWheel, { passive: false });

pauseBtn.addEventListener('click', handlers.onPauseClick);
speedUpBtn.addEventListener('click', handlers.onSpeedUpClick);
speedDownBtn.addEventListener('click', handlers.onSpeedDownClick);
window.addEventListener('keydown', handlers.onKeyDown);

/* ====================================== Runtime ======================================== */
resizeCanvas();
initGlider(0, 0);
updateSpeedLabel();
drawGrid();
requestAnimationFrame(loop);
