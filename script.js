// Runner Game - estilo Dino Google

let scene, camera, renderer;
let player, ground;
let obstacles = [];
let clock = new THREE.Clock();

let speed = 10;               // velocidade inicial
let score = 0;
let running = false;
let canJump = true;

let lastScore = 0;            // salva a última pontuação
let lane = 0;                 // -1 esquerda, 0 meio, 1 direita
const lanesX = [-3, 0, 3];

let spawnTimer = 0;
let spawnInterval = 1.1;      // obstáculo aparece um pouco mais cedo

function init() {
  const container = document.getElementById("game-container");

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1220, 10, 80);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 4, 15);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // luz
  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
  scene.add(light);

  // jogador
  const pgeo = new THREE.BoxGeometry(1, 2, 1);
  const pmat = new THREE.MeshStandardMaterial({ color: 0x22c1c3 });
  player = new THREE.Mesh(pgeo, pmat);
  player.position.set(0, 1, 0);
  scene.add(player);

  // chão visível
  const ggeo = new THREE.BoxGeometry(30, 1, 400);
  const gmat = new THREE.MeshStandardMaterial({ color: 0x20252b });
  ground = new THREE.Mesh(ggeo, gmat);
  ground.position.set(0, -0.5, -150);
  scene.add(ground);

  window.addEventListener("resize", onResize);
  document.addEventListener("keydown", keyPress);
}

function spawnObstacle() {
  const size = Math.random() * 1.3 + 1;
  const z = camera.position.z - 180;
  const laneIndex = Math.floor(Math.random() * 3);
  const x = lanesX[laneIndex];

  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff4d4d });
  const obs = new THREE.Mesh(geo, mat);

  obs.position.set(x, size / 2, z);
  scene.add(obs);
  obstacles.push(obs);
}

function resetGame() {
  obstacles.forEach(o => scene.remove(o));
  obstacles = [];
  
  lastScore = Math.floor(score);             // salva a última pontuação
  document.getElementById("lastScoreValue").innerText = lastScore;

  score = 0;
  speed = 10;
  lane = 0;
  player.position.set(0, 1, 0);

  spawnInterval = 1.1;
  spawnTimer = 0;

  running = false;
  canJump = true;

  document.getElementById("scoreValue").innerText = 0;
  document.getElementById("startBtn").style.display = "inline-block";
  document.getElementById("restartBtn").style.display = "none";
}

function gameOver() {
  running = false;
  document.getElementById("restartBtn").style.display = "inline-block";
}

function keyPress(e) {
  if (e.code === "Space") {
    if (!running) {
      running = true;
      document.getElementById("startBtn").style.display = "none";
      return;
    }
    jump();
  }

  if (!running) return;

  if (e.code === "ArrowLeft") moveLeft();
  if (e.code === "ArrowRight") moveRight();
}

function moveLeft() {
  if (lane > -1) {
    lane--;
    player.position.x = lanesX[lane + 1] ?? lanesX[0];
  }
}

function moveRight() {
  if (lane < 1) {
    lane++;
    player.position.x = lanesX[lane + 1] ?? lanesX[2];
  }
}

function jump() {
  if (!canJump) return;

  canJump = false;

  const startY = player.position.y;
  const peak = startY + 4;
  const upStart = performance.now();

  function up() {
    const t = (performance.now() - upStart) / 1000;
    if (t < 0.25) {
      player.position.y = startY + (peak - startY) * (t / 0.25);
      requestAnimationFrame(up);
    } else {
      const downStart = performance.now();
      function down() {
        const td = (performance.now() - downStart) / 1000;
        if (td < 0.28) {
          player.position.y = peak - (peak - startY) * (td / 0.28);
          requestAnimationFrame(down);
        } else {
          player.position.y = startY;
          canJump = true;
        }
      }
      requestAnimationFrame(down);
    }
  }
  requestAnimationFrame(up);
}

function update(dt) {
  if (!running) return;

  // 💥 Aceleração estilo Dino
  speed += 0.004;           // aceleração base
  speed += speed * 0.006;   // aceleração progressiva (igual ao Dino)

  // pontuação sobe baseado na velocidade
  score += speed * 0.3;
  document.getElementById("scoreValue").innerText = Math.floor(score);

  spawnTimer += dt;
  if (spawnTimer > spawnInterval) {
    spawnTimer = 0;
    spawnInterval = Math.max(0.45, spawnInterval - 0.02);
    spawnObstacle();
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];

    o.position.z += speed * dt * 0.9;

    // remove quando passa
    if (o.position.z > camera.position.z + 10) {
      scene.remove(o);
      obstacles.splice(i, 1);
      continue;
    }

    // colisão
    const dx = Math.abs(o.position.x - player.position.x);
    const dz = Math.abs(o.position.z - player.position.z);
    const dy = player.position.y < o.geometry.parameters.height + 1;

    if (dx < 1.1 && dz < 1.3 && dy) {
      gameOver();
    }
  }
}

function animate() {
  const dt = clock.getDelta();
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = () => {
  init();
  animate();

  document.getElementById("startBtn").addEventListener("click", () => {
    running = true;
    document.getElementById("startBtn").style.display = "none";
  });

  document.getElementById("restartBtn").addEventListener("click", () => {
    resetGame();
  });
};
