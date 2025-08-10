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

// FPS tracking variables
let fps = 0;
let lastFpsUpdate = 0;
let framesThisSecond = 0;

/* ====================================== Functions ====================================== */
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 55;
    width = canvas.width;
    height = canvas.height;
}

function updateSpeedLabel() {
    speedLabel.textContent = `Delay: ${delay} ms`;
}

function cellKey(x, y) {
    return `${x},${y}`;
}

function parseKey(k) {
    return k.split(',').map(Number);
}

function initGlider(x, y) {
    let coords = [
        [x + 1, y], [x + 2, y + 1], [x, y + 2],
        [x + 1, y + 2], [x + 2, y + 2]
    ];
    coords.forEach(([cx, cy]) => aliveCells.add(cellKey(cx, cy)));
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

        if (alive && (neighbors === 2 || neighbors === 3)) {
            newAlive.add(key);
        } else if (!alive && neighbors === 3) {
            newAlive.add(key);
        }
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
    ctx.fillStyle = 'white';
    ctx.font = '16px monospace';
    ctx.fillText(`FPS: ${fps}`, 10, 20);
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
        if (isDragging || !paused) return;
        let rect = canvas.getBoundingClientRect();
        let mx = e.clientX - rect.left;
        let my = e.clientY - rect.top;
        let wx = Math.floor(cameraX + mx / zoom);
        let wy = Math.floor(cameraY + my / zoom);

        // Add a 100*100 square of alive cells
        for (let x = wx - 50; x <= wx + 50; x++) {
            for (let y = wy - 50; y <= wy + 50; y++) {
                let key = cellKey(x, y);
                let alive = Math.floor(Math.random() * 2)
                if (alive) { aliveCells.add(key) } else {
                    if (aliveCells.has(key)) aliveCells.delete(key)
                }
            }
        }

        /*
        // Change a single cell state
        let key = cellKey(wx, wy);
        if (aliveCells.has(key)) aliveCells.delete(key);
        else aliveCells.add(key);
        */

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

/* ====================================== Runtime ======================================== */
resizeCanvas();
initGlider(0, 0);
updateSpeedLabel();
drawGrid();
requestAnimationFrame(loop);
