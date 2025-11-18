// ===============================
// CONFIGURAÇÕES DO JOGO
// ===============================
let scene, camera, renderer;
let player, playerBox;
let obstacles = [];
let speed = 0.15;          // velocidade inicial
let score = 0;
let lastScore = 0;
let lanes = [-2, 0, 2];
let currentLane = 1;
let isJumping = false;
let velocityY = 0;
let gravity = -0.01;
let playing = false;

const laneDistance = 2;

// ===============================
// INICIALIZAÇÃO
// ===============================
function init() {
    scene = new THREE.Scene();

    // CÂMERA — visão traseira correta
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3, 6);
    camera.lookAt(0, 1, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById("game-container").appendChild(renderer.domElement);

    // LUZ
    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    light.position.set(0, 20, 0);
    scene.add(light);

    // CHÃO — agora visível
    const floorGeo = new THREE.PlaneGeometry(50, 2000);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // PLAYER
    const playerGeo = new THREE.BoxGeometry(1, 1, 1);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ffff });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.position.set(0, 0.5, 0);
    scene.add(player);

    playerBox = new THREE.Box3().setFromObject(player);

    // CONTROLES
    document.addEventListener("keydown", handleKey);

    animate();
}

// ===============================
// INICIAR JOGO
// ===============================
function startGame() {
    playing = true;
    score = 0;
    speed = 0.15; // velocidade inicial reinicia

    document.getElementById("startBtn").style.display = "none";
    document.getElementById("restartBtn").style.display = "none";
}

// ===============================
// REINICIAR
// ===============================
function restartGame() {
    obstacles.forEach(o => scene.remove(o.mesh));
    obstacles = [];
    currentLane = 1;
    player.position.set(0, 0.5, 0);
    isJumping = false;
    velocityY = 0;

    lastScore = Math.floor(score); // salva última pontuação
    document.getElementById("lastScoreValue").innerText = lastScore;

    startGame();
}

// ===============================
// CONTROLES
// ===============================
function handleKey(e) {
    if (!playing && e.code === "Space") restartGame();

    if (!playing) return;

    if (e.code === "ArrowLeft" && currentLane > 0) currentLane--;
    if (e.code === "ArrowRight" && currentLane < 2) currentLane++;
    if (e.code === "Space" && !isJumping) {
        isJumping = true;
        velocityY = 0.22;
    }
}

// ===============================
// CRIAR OBSTÁCULOS
// ===============================
function spawnObstacle() {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xff4444 });
    const mesh = new THREE.Mesh(boxGeo, boxMat);

    const lane = Math.floor(Math.random() * 3);
    mesh.position.set(lanes[lane], 0.5, -40);

    obstacles.push({ mesh, lane });
    scene.add(mesh);
}

// ===============================
// LOOP DO JOGO
// ===============================
function animate() {
    requestAnimationFrame(animate);

    if (playing) {
        // mover player para o trilho escolhido
        player.position.x += (lanes[currentLane] - player.position.x) * 0.2;

        // pular
        if (isJumping) {
            player.position.y += velocityY;
            velocityY += gravity;

            if (player.position.y <= 0.5) {
                player.position.y = 0.5;
                isJumping = false;
                velocityY = 0;
            }
        }

        // SPAWNA obstáculos
        if (Math.random() < 0.03) spawnObstacle();

        // mover obstáculos
        obstacles.forEach(o => {
            o.mesh.position.z += speed;
        });

        // remover obstáculos
        obstacles = obstacles.filter(o => {
            if (o.mesh.position.z > 5) {
                scene.remove(o.mesh);
                return false;
            }
            return true;
        });

        // colisão
        playerBox.setFromObject(player);
        obstacles.forEach(o => {
            const box = new THREE.Box3().setFromObject(o.mesh);
            if (playerBox.intersectsBox(box)) {
                playing = false;
                document.getElementById("restartBtn").style.display = "block";
            }
        });

        // aumentar velocidade mais rápido
        speed += 0.0025;

        // pontuação mais rápida
        score += speed * 30;
        document.getElementById("scoreValue").innerText = Math.floor(score);
    }

    renderer.render(scene, camera);
}

// ===============================
window.onload = init;
