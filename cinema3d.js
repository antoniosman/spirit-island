import * as THREE from "./vendor/three.module.min.js";

const TAU = Math.PI * 2;

function material(color, roughness = 0.72, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function mesh(geometry, mat, parent, position = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(...position);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function limb(radius, length, mat, parent, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  const part = mesh(
    new THREE.CapsuleGeometry(radius, length, 5, 10),
    mat,
    pivot,
    [0, -length * 0.46, 0],
  );
  return { pivot, part };
}

async function portraitMaterial(url, prepared = false) {
  try {
    const texture = await new THREE.TextureLoader().loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.center.set(0.5, 0.5);
    if (prepared) {
      texture.repeat.set(0.94, 0.94);
      texture.offset.set(0.03, 0.03);
    } else {
      const width = texture.image?.naturalWidth || texture.image?.width || 1,
        height = texture.image?.naturalHeight || texture.image?.height || 1,
        cropX = width > height ? height / width : 1,
        cropY = height > width ? width / height : 1,
        zoom = 0.48;
      texture.repeat.set(cropX * zoom, cropY * zoom);
      texture.offset.set(
        (1 - texture.repeat.x) / 2,
        Math.min(1 - texture.repeat.y, 0.42),
      );
    }
    texture.anisotropy = 8;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });
  } catch {
    return new THREE.MeshBasicMaterial({ color: 0x6ddbc8 });
  }
}

const SPIRIT_LOOKS = {
  Alex: ["phoenix", 0xffa31a],
  Billy: ["kitsune", 0x9b5cff],
  Catherine: ["crystal", 0xff572e],
  Demarin: ["shadow", 0x59606c],
  Elisa: ["mermaid", 0x6fd4e7],
  Ester: ["oracle", 0x8f55d9],
  Eva: ["doll", 0xd98ea4],
  Evaggelia: ["ice", 0x9fdcff],
  Evelyn: ["fairy", 0x6fbf58],
  Hope: ["angel", 0x8d1535],
  Ian: ["summoner", 0x631525],
  Irene: ["beast", 0xe67b24],
  Jasmine: ["paladin", 0xe3b94e],
  Luna: ["elf", 0xf2e6b9],
  Paul: ["alchemist", 0x68a748],
  Pauline: ["ice", 0x74c5ff],
  Phillip: ["necromancer", 0x9a1737],
  Rino: ["werewolf", 0x3c78a8],
  Sargenie: ["genie", 0x334fb2],
  Smaragda: ["puppeteer", 0xb82935],
  Sorina: ["ghost", 0xbad8f2],
  Tony: ["wizard", 0xb51d33],
  Vicky: ["archer", 0xa91f38],
  Vincent: ["sorcerer", 0x542a7d],
  Violet: ["cyborg", 0x7a3fe3],
  Zoe: ["candy", 0xff7b33],
};

function addSpiritOutfit(group, head, player, dark, gold) {
  const look = SPIRIT_LOOKS[player.name];
  if (!look) return;
  const [type, accentColor] = look,
    accent = material(accentColor, 0.3, 0.55),
    glow = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.5,
    }),
    cone = (parent, pos, s = 1, mat = accent) => {
      const x = mesh(new THREE.ConeGeometry(0.22 * s, 0.72 * s, 8), mat, parent, pos);
      return x;
    },
    wing = (side, colorMat = accent) => {
      const w = mesh(
        new THREE.ConeGeometry(0.44, 1.65, 5),
        colorMat,
        group,
        [side * 0.62, 1.88, -0.34],
      );
      w.rotation.z = side * -0.72;
      w.rotation.x = -0.2;
      return w;
    },
    ears = (mat = accent, long = false) => {
      for (const side of [-1, 1]) {
        const e = cone(head, [side * 0.38, 0.17, 0], long ? 0.72 : 0.5, mat);
        e.rotation.z = side * -1.25;
      }
    };
  if (["phoenix", "angel", "fairy", "ice"].includes(type)) {
    wing(-1, type === "angel" ? dark : glow);
    wing(1, type === "angel" ? dark : glow);
  }
  if (type === "wizard") {
    const hat = cone(head, [0, 0.72, -0.02], 1.25, dark);
    hat.rotation.z = -0.08;
    const brim = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 24), dark, head, [0, 0.38, 0]);
    mesh(new THREE.SphereGeometry(0.13, 14, 10), glow, group, [0.6, 1.1, 0.35]);
  } else if (["elf", "fairy"].includes(type)) {
    ears(accent, true);
    mesh(new THREE.OctahedronGeometry(0.13, 0), glow, group, [0, 2.05, 0.48]);
  } else if (["kitsune", "beast", "werewolf"].includes(type)) {
    ears(type === "kitsune" ? accent : dark);
    const tails = type === "kitsune" ? 5 : 1;
    for (let i = 0; i < tails; i++) {
      const t = mesh(
        new THREE.CapsuleGeometry(0.09, 0.92, 5, 9),
        type === "kitsune" ? accent : dark,
        group,
        [(i - (tails - 1) / 2) * 0.2, 0.92, -0.38],
      );
      t.rotation.z = (i - (tails - 1) / 2) * 0.23;
    }
  } else if (["shadow", "summoner", "necromancer", "sorcerer", "ghost"].includes(type)) {
    const hood = mesh(new THREE.TorusGeometry(0.47, 0.12, 9, 26), dark, head, [0, 0.04, -0.03]);
    hood.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) wing(side, type === "ghost" ? accent : dark).scale.set(0.65, 0.8, 0.5);
    mesh(new THREE.SphereGeometry(0.12, 14, 10), glow, group, [0, 1.72, 0.48]);
  } else if (["crystal", "oracle", "ice"].includes(type)) {
    for (let i = -2; i <= 2; i++) {
      const crown = cone(head, [i * 0.16, 0.48 - Math.abs(i) * 0.035, 0], 0.46 + (2 - Math.abs(i)) * 0.12, glow);
      crown.rotation.z = -i * 0.11;
    }
  } else if (type === "mermaid") {
    const fin = mesh(new THREE.ConeGeometry(0.5, 1.35, 18), accent, group, [0, 0.55, 0]);
    fin.rotation.z = Math.PI;
    for (const side of [-1, 1]) {
      const shell = mesh(new THREE.SphereGeometry(0.15, 12, 8), glow, group, [side * 0.21, 1.8, 0.34]);
      shell.scale.z = 0.45;
    }
  } else if (["doll", "puppeteer"].includes(type)) {
    mesh(new THREE.ConeGeometry(0.72, 1.18, 24), accent, group, [0, 1.05, 0]);
    for (const side of [-1, 1]) {
      const thread = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.25, 5), gold, group, [side * 0.48, 2.6, 0]);
      thread.rotation.z = side * 0.16;
    }
  } else if (type === "paladin") {
    for (const side of [-1, 1]) mesh(new THREE.DodecahedronGeometry(0.24, 0), gold, group, [side * 0.48, 1.91, 0]);
    mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 8), gold, group, [-0.57, 1.26, 0.18]).rotation.x = Math.PI / 2;
  } else if (type === "archer") {
    const bow = mesh(new THREE.TorusGeometry(0.48, 0.035, 8, 28, Math.PI), accent, group, [0.58, 1.42, 0.16]);
    bow.rotation.z = Math.PI / 2;
  } else if (type === "alchemist") {
    for (let i = -1; i <= 1; i++) mesh(new THREE.SphereGeometry(0.09, 12, 8), i ? accent : glow, group, [i * 0.22, 1.42, 0.38]);
  } else if (type === "genie") {
    mesh(new THREE.TorusGeometry(0.38, 0.12, 10, 24), accent, head, [0, 0.42, 0]).rotation.x = Math.PI / 2;
    mesh(new THREE.ConeGeometry(0.46, 1.25, 18), accent, group, [0, 0.55, 0]).rotation.z = Math.PI;
  } else if (type === "cyborg") {
    for (const side of [-1, 1]) mesh(new THREE.BoxGeometry(0.28, 0.24, 0.42), accent, group, [side * 0.5, 1.92, 0]);
    mesh(new THREE.OctahedronGeometry(0.16, 0), glow, group, [0, 1.68, 0.39]);
  } else if (type === "candy") {
    const candy = mesh(new THREE.TorusGeometry(0.19, 0.07, 8, 20), glow, group, [0.58, 1.72, 0.2]);
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8), accent, group, [0.58, 1.08, 0.2]);
    candy.rotation.y = 0.3;
  }
}

async function avatar(player, color = "#43d9c2") {
  const group = new THREE.Group();
  group.userData.playerId = player.id;
  group.userData.phase = Math.random() * TAU;
  group.userData.action = "idle";
  const cloth = material(color, 0.62, 0.16);
  const dark = material(0x071a22, 0.82, 0.08);
  const skin = material(0xc58e73, 0.86, 0.02);
  const gold = material(0xe3b94e, 0.3, 0.72);

  mesh(
    new THREE.CapsuleGeometry(0.34, 0.94, 6, 14),
    cloth,
    group,
    [0, 1.62, 0],
  );
  mesh(
    new THREE.CylinderGeometry(0.52, 0.38, 0.22, 16),
    gold,
    group,
    [0, 1.98, 0],
  );
  const head = new THREE.Group();
  head.position.set(0, 2.58, 0);
  group.add(head);
  mesh(new THREE.SphereGeometry(0.39, 20, 14), skin, head);
  const face = mesh(
    new THREE.PlaneGeometry(0.64, 0.72),
    await portraitMaterial(
      player.faceImage || player.image,
      !!player.faceImage,
    ),
    head,
    [0, 0.015, 0.43],
  );
  face.material.depthTest = false;
  face.renderOrder = 3;
  const faceFrame = mesh(
    new THREE.PlaneGeometry(0.72, 0.8),
    gold,
    head,
    [0, 0.015, 0.405],
  );
  faceFrame.renderOrder = 2;

  const leftArm = limb(0.1, 0.92, cloth, group, -0.43, 1.93, 0);
  const rightArm = limb(0.1, 0.92, cloth, group, 0.43, 1.93, 0);
  const leftLeg = limb(0.12, 1.14, dark, group, -0.19, 1.12, 0);
  const rightLeg = limb(0.12, 1.14, dark, group, 0.19, 1.12, 0);
  mesh(
    new THREE.SphereGeometry(0.14, 12, 8),
    skin,
    leftArm.pivot,
    [0, -0.94, 0],
  );
  mesh(
    new THREE.SphereGeometry(0.14, 12, 8),
    skin,
    rightArm.pivot,
    [0, -0.94, 0],
  );

  const ring = mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 0.08, 18),
    gold,
    group,
    [0, 1.42, 0],
  );
  addSpiritOutfit(group, head, player, dark, gold);
  group.userData.rig = {
    head,
    leftArm: leftArm.pivot,
    rightArm: rightArm.pivot,
    leftLeg: leftLeg.pivot,
    rightLeg: rightLeg.pivot,
  };
  group.scale.setScalar(0.82);
  return group;
}

function createIdol(parent, position = [0, 0, 0], scale = 1, type = "flame") {
  const idol = new THREE.Group();
  idol.position.set(...position);
  idol.scale.setScalar(scale);
  parent.add(idol);
  const palettes = {
      flame: [0x21bca7, 0xffcf55],
      mirror: [0xbfeeff, 0xffffff],
      storm: [0x196bff, 0x8fffff],
      twin: [0xff5da8, 0xffdc78],
      oracle: [0x773cff, 0xe8a7ff],
    },
    [baseColor, glowColor] = palettes[type] || palettes.flame,
    stone = material(baseColor, 0.24, 0.72),
    gold = material(glowColor, 0.18, 0.9);
  if (type === "mirror") {
    const disc = mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.12, 32),
      stone,
      idol,
      [0, 0.78, 0],
    );
    disc.rotation.x = Math.PI / 2;
    mesh(new THREE.RingGeometry(0.19, 0.43, 32), gold, idol, [0, 0.78, 0.08]);
  } else if (type === "storm") {
    mesh(new THREE.IcosahedronGeometry(0.46, 1), stone, idol, [0, 0.78, 0]);
    for (const side of [-1, 1]) {
      const bolt = mesh(new THREE.ConeGeometry(0.1, 0.72, 5), gold, idol, [
        side * 0.36,
        0.72,
        0.15,
      ]);
      bolt.rotation.z = side * 0.55;
    }
  } else if (type === "twin") {
    for (const side of [-1, 1]) {
      const crystal = mesh(
        new THREE.OctahedronGeometry(0.34, 0),
        side < 0 ? stone : gold,
        idol,
        [side * 0.3, 0.78, 0],
      );
      crystal.rotation.z = side * 0.22;
    }
  } else if (type === "oracle") {
    mesh(new THREE.DodecahedronGeometry(0.48, 0), stone, idol, [0, 0.77, 0]);
    const pupil = mesh(
      new THREE.SphereGeometry(0.15, 18, 12),
      gold,
      idol,
      [0, 0.8, 0.43],
    );
    pupil.scale.x = 0.55;
  } else {
    mesh(new THREE.OctahedronGeometry(0.48, 1), stone, idol, [0, 0.75, 0]);
  }
  const eye = mesh(
    new THREE.TorusGeometry(0.3, 0.07, 10, 32),
    gold,
    idol,
    [0, 0.8, 0.43],
  );
  eye.scale.y = 0.52;
  mesh(new THREE.SphereGeometry(0.1, 16, 10), gold, idol, [0, 0.8, 0.48]);
  if (type === "flame")
    for (const side of [-1, 1]) {
      const horn = mesh(new THREE.ConeGeometry(0.12, 0.65, 10), gold, idol, [
        side * 0.39,
        1.16,
        0,
      ]);
      horn.rotation.z = side * -0.55;
    }
  const aura = mesh(
    new THREE.TorusGeometry(0.72, 0.018, 8, 64),
    new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.7,
    }),
    idol,
    [0, 0.74, 0],
  );
  aura.rotation.x = Math.PI / 2;
  idol.userData.aura = aura;
  idol.userData.idolType = type;
  return idol;
}

function flame(parent, x, y, z, color = 0xff8b32) {
  const light = new THREE.PointLight(color, 3.2, 7, 2);
  light.position.set(x, y + 0.5, z);
  parent.add(light);
  const f = mesh(
    new THREE.ConeGeometry(0.13, 0.55, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88 }),
    parent,
    [x, y, z],
  );
  f.userData.flame = true;
  return f;
}

function labelSprite(text, color = "#ffffff") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,15,20,.78)";
  ctx.roundRect(5, 5, 502, 86, 28);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "white";
  ctx.font = "700 36px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 50, 480);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.scale.set(2.6, 0.49, 1);
  sprite.renderOrder = 8;
  return sprite;
}

export async function mountSpirit3D(root, players, options = {}) {
  const mode = options.mode || "council";
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(
    mode === "challenge" ? 0x0a6670 : 0x071016,
    0.035,
  );
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(
    0,
    mode === "challenge" ? 5.8 : 6.2,
    mode === "challenge" ? 16.8 : 15.5,
  );
  camera.lookAt(0, 1.3, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "spirit-webgl";
  root.append(renderer.domElement);

  try {
    const backdrop = await new THREE.TextureLoader().loadAsync(
      options.background ||
        (mode === "council" ? "council-stage.png" : "island-hero.png"),
    );
    backdrop.colorSpace = THREE.SRGBColorSpace;
    scene.background = backdrop;
  } catch {
    scene.background = new THREE.Color(
      mode === "challenge" ? 0x15564d : 0x071016,
    );
  }

  scene.add(new THREE.HemisphereLight(0x75eaff, 0x120b09, 1.5));
  const key = new THREE.DirectionalLight(0xffd07a, 3.4);
  key.position.set(-5, 9, 8);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x36ffe4, 2.1);
  rim.position.set(6, 5, -6);
  scene.add(rim);

  const floor = mesh(
    new THREE.CylinderGeometry(mode === "challenge" ? 10 : 8, 8.6, 0.45, 64),
    material(mode === "challenge" ? 0x386654 : 0x18252a, 0.92, 0.03),
    scene,
    [0, -0.28, 0],
  );
  floor.receiveShadow = true;
  const avatarMap = new Map();
  const colors = options.colors || {};

  if (mode === "council") {
    createIdol(scene, [0, 0, -1.3], 1.25);
    flame(scene, -1.5, 0.42, -0.4);
    flame(scene, 1.5, 0.42, -0.4);
  } else if (mode === "challenge") {
    const type = options.challengeType || "race";
    for (let i = 0; i < 7; i++) {
      const x = -6 + i * 2;
      if (type === "balance") {
        mesh(
          new THREE.BoxGeometry(1.35, 0.13, 7.2),
          material(i % 2 ? 0xffb52e : 0x2de0c5, 0.5, 0.18),
          scene,
          [x, 0.22, 0],
        );
      } else if (type === "endurance") {
        mesh(
          new THREE.CylinderGeometry(0.58, 0.72, 2.2, 16),
          material(i % 2 ? 0x8b5e32 : 0x276d67, 0.85),
          scene,
          [x, 0.82, 0],
        );
      } else if (type === "puzzle" || type === "memory") {
        const altar = mesh(
          new THREE.BoxGeometry(1.15, 0.8, 1.15),
          material(0x193f3f, 0.6, 0.3),
          scene,
          [x, 0.38, -1],
        );
        const crystal = mesh(
          new THREE.OctahedronGeometry(0.38, 0),
          material(i % 3 === 0 ? 0xffce5d : 0x35e2ca, 0.25, 0.65),
          scene,
          [x, 1.2, -1],
        );
        crystal.userData.challengePiece = true;
        altar.receiveShadow = true;
      } else {
        const obstacle = mesh(
          new THREE.TorusGeometry(0.75, 0.16, 12, 32),
          material(i % 2 ? 0xffb52e : 0x2de0c5, 0.44, 0.22),
          scene,
          [x, 0.8, -1.3 + (i % 2) * 1.2],
        );
        obstacle.rotation.y = Math.PI / 2;
      }
    }
  }

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const a = await avatar(
      p,
      colors[p.tribe] || (i % 2 ? "#ff9d4d" : "#35d7c2"),
    );
    avatarMap.set(p.id, a);
    scene.add(a);
    const label = labelSprite(p.name, colors[p.tribe] || "#6fffe9");
    label.position.set(0, 3.42, 0);
    a.add(label);
    if (mode === "council") {
      const angle =
        Math.PI * (0.12 + (0.76 * i) / Math.max(1, players.length - 1));
      const radius = players.length > 12 ? 7.1 : 6.1;
      a.position.set(Math.cos(angle) * radius, 0, 1.8 - Math.sin(angle) * 4.2);
      a.rotation.y = -Math.cos(angle) * 0.42;
      a.userData.home = a.position.clone();
      a.userData.rig.leftLeg.rotation.x = -1.12;
      a.userData.rig.rightLeg.rotation.x = -1.12;
      a.userData.rig.leftArm.rotation.x = -0.35;
      a.userData.rig.rightArm.rotation.x = -0.35;
      const seat = mesh(
        new THREE.BoxGeometry(1.15, 0.35, 1.05),
        material(0x362016),
        scene,
        [a.position.x, 0.18, a.position.z + 0.25],
      );
      seat.rotation.y = a.rotation.y;
    } else {
      const cols = Math.min(8, Math.ceil(players.length / 2));
      const row = Math.floor(i / cols);
      const col = i % cols;
      a.position.set((col - (cols - 1) / 2) * 1.55, 0, row * 1.7 + 2.1);
      a.scale.setScalar(players.length > 16 ? 0.58 : 0.7);
      a.userData.home = a.position.clone();
      a.userData.action = mode === "challenge" ? "run" : "idle";
    }
  }

  const juryIds = new Set(options.jury || []);
  avatarMap.forEach((a, id) => {
    if (juryIds.has(id)) {
      a.position.z = -4.8;
      a.position.y = 1.1;
      a.scale.multiplyScalar(0.72);
    }
  });

  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 240;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (Math.random() - 0.5) * 18;
    positions[i + 1] = Math.random() * 8;
    positions[i + 2] = (Math.random() - 0.5) * 12;
  }
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: mode === "challenge" ? 0x8ffff1 : 0xffbd58,
      size: 0.055,
      transparent: true,
      opacity: 0.75,
    }),
  );
  scene.add(particles);

  let disposed = false;
  const clock = new THREE.Clock();
  const resize = () => {
    const w = Math.max(1, root.clientWidth);
    const h = Math.max(1, root.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  function render() {
    if (disposed) return;
    requestAnimationFrame(render);
    const t = clock.getElapsedTime();
    avatarMap.forEach((a) => {
      const r = a.userData.rig;
      const phase = t * 2.2 + a.userData.phase;
      r.head.rotation.y = Math.sin(t * 0.72 + a.userData.phase) * 0.12;
      r.head.rotation.z = Math.sin(t * 0.9 + a.userData.phase) * 0.025;
      if (
        a.userData.action === "run" ||
        a.userData.action === "vote" ||
        a.userData.action === "exit"
      ) {
        r.leftArm.rotation.x = Math.sin(phase) * 0.82;
        r.rightArm.rotation.x = -Math.sin(phase) * 0.82;
        r.leftLeg.rotation.x = -Math.sin(phase) * 0.62;
        r.rightLeg.rotation.x = Math.sin(phase) * 0.62;
        a.position.y = Math.abs(Math.sin(phase)) * 0.08;
      } else if (a.userData.action === "celebrate") {
        r.leftArm.rotation.z = 2.2 + Math.sin(phase) * 0.2;
        r.rightArm.rotation.z = -2.2 - Math.sin(phase) * 0.2;
        a.position.y = Math.abs(Math.sin(phase)) * 0.14;
      } else if (a.userData.action === "talk") {
        r.rightArm.rotation.z = -0.65 + Math.sin(phase * 1.4) * 0.28;
        r.rightArm.rotation.x = -0.45 + Math.cos(phase) * 0.18;
        r.head.rotation.y = Math.sin(phase * 0.72) * 0.2;
      } else if (a.userData.action === "balance") {
        r.leftArm.rotation.z = 1.42 + Math.sin(phase) * 0.18;
        r.rightArm.rotation.z = -1.42 - Math.sin(phase) * 0.18;
        a.rotation.z = Math.sin(phase * 0.7) * 0.055;
      } else if (a.userData.action === "puzzle") {
        r.leftArm.rotation.x = -0.8 + Math.sin(phase) * 0.3;
        r.rightArm.rotation.x = -0.8 - Math.sin(phase) * 0.3;
        r.head.rotation.x = 0.18;
      } else if (a.userData.action === "dig") {
        r.leftArm.rotation.x = -1.1 + Math.sin(phase * 1.8) * 0.72;
        r.rightArm.rotation.x = -1.1 + Math.sin(phase * 1.8) * 0.72;
        a.rotation.x = 0.12 + Math.abs(Math.sin(phase)) * 0.08;
      } else if (a.userData.action === "fish") {
        r.leftArm.rotation.x = -1.28;
        r.rightArm.rotation.x = -1.18 + Math.sin(phase * 0.9) * 0.18;
        r.leftArm.rotation.z = 0.42;
        a.rotation.z = Math.sin(phase * 0.55) * 0.035;
      } else if (a.userData.action === "search") {
        r.rightArm.rotation.z = -0.9 + Math.sin(phase * 1.2) * 0.42;
        r.leftArm.rotation.z = 0.55 - Math.cos(phase) * 0.22;
        r.head.rotation.y = Math.sin(phase * 0.45) * 0.55;
      } else if (a.userData.action === "dive") {
        r.leftArm.rotation.z = 1.5;
        r.rightArm.rotation.z = -1.5;
        a.position.y = -0.45 + Math.sin(phase) * 0.15;
      } else if (a.userData.action === "fight") {
        r.leftArm.rotation.x = -0.75 + Math.sin(phase * 2.4) * 0.8;
        r.rightArm.rotation.x = -0.75 - Math.sin(phase * 2.4) * 0.8;
        a.rotation.z = Math.sin(phase * 1.2) * 0.08;
      } else {
        a.position.y = Math.sin(phase * 0.35) * 0.025;
      }
    });
    scene.traverse((o) => {
      if (o.userData.flame) o.scale.y = 0.8 + Math.random() * 0.38;
      if (o.userData.challengePiece) {
        o.rotation.y = t * 1.2;
        o.position.y = 1.2 + Math.sin(t * 2 + o.position.x) * 0.12;
      }
      if (o.userData.aura) {
        o.userData.aura.rotation.z = t * 0.8;
        o.userData.aura.material.opacity = 0.48 + Math.sin(t * 3) * 0.24;
      }
    });
    particles.rotation.y = t * 0.025;
    renderer.render(scene, camera);
  }
  render();

  const moveTo = (id, target, action = "walk", duration = 850) => {
    const a = avatarMap.get(id);
    if (!a) return Promise.resolve();
    a.userData.action = action;
    const from = a.position.clone();
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = (now) => {
        const x = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - x, 3);
        a.position.lerpVectors(from, target, eased);
        if (x < 1 && !disposed) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  };

  return {
    avatars: avatarMap,
    async vote(id) {
      const a = avatarMap.get(id);
      if (!a) return;
      const home = a.userData.home.clone();
      await moveTo(id, new THREE.Vector3(0, 0, 1.7), "vote", 800);
      a.userData.action = "idle";
      await new Promise((r) => setTimeout(r, 420));
      await moveTo(id, home, "vote", 760);
      a.userData.action = "idle";
    },
    async playChallenge(winnerIds = []) {
      const type = options.challengeType || "race",
        winnerSet = new Set(winnerIds),
        runners = [...avatarMap.entries()],
        wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      if (type === "race" || type === "totem") {
        await Promise.all(
          runners.map(([id, a], index) => {
            const checkpoint = a.userData.home.clone();
            checkpoint.z -= 2.1 + (index % 3) * 0.2;
            return moveTo(id, checkpoint, "run", 900 + (index % 5) * 85);
          }),
        );
        await wait(220);
        await Promise.all(
          runners.map(([id, a], index) => {
            const finish = a.position.clone();
            finish.z = winnerSet.has(id) ? -4.9 : -2.25 + (index % 4) * 0.22;
            finish.x += Math.sin(index * 1.8) * 0.25;
            return moveTo(
              id,
              finish,
              "run",
              winnerSet.has(id) ? 1250 : 1550 + (index % 4) * 120,
            );
          }),
        );
      } else if (type === "balance" || type === "endurance") {
        runners.forEach(([, a]) => (a.userData.action = "balance"));
        await wait(1500);
        runners.forEach(([id, a], index) => {
          if (!winnerSet.has(id)) {
            a.rotation.z = index % 2 ? 1.22 : -1.22;
            a.position.y = -0.55;
            a.userData.action = "idle";
          }
        });
        await wait(1300);
      } else {
        runners.forEach(([, a]) => (a.userData.action = "puzzle"));
        await wait(type === "memory" ? 3100 : 2700);
        runners.forEach(([id, a]) => {
          if (!winnerSet.has(id)) a.position.z += 0.8;
        });
      }
      runners.forEach(([id, a]) => {
        a.userData.action = winnerSet.has(id) ? "celebrate" : "idle";
      });
    },
    async search(id, method = "dig") {
      const a = avatarMap.get(id);
      if (!a) return;
      const props = new THREE.Group();
      scene.add(props);
      const origin = a.position.clone();
      const sand = material(0xb8864c, 0.95, 0.01),
        wood = material(0x6f4429, 0.9, 0.02),
        water = new THREE.MeshBasicMaterial({
          color: 0x34d9e8,
          transparent: true,
          opacity: 0.58,
        });
      if (method === "dig") {
        const mound = mesh(
          new THREE.SphereGeometry(0.82, 24, 12),
          sand,
          props,
          [origin.x + 0.4, 0.02, origin.z - 1.15],
        );
        mound.scale.y = 0.22;
        const handle = mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 1.7, 8),
          wood,
          props,
          [origin.x + 0.75, 0.82, origin.z - 0.8],
        );
        handle.rotation.z = -0.42;
        a.userData.action = "dig";
      } else if (method === "fish" || method === "dive") {
        for (let i = 0; i < 4; i++) {
          const ring = mesh(
            new THREE.RingGeometry(0.55 + i * 0.38, 0.59 + i * 0.38, 42),
            water,
            props,
            [origin.x, 0.05, origin.z - 1.6],
          );
          ring.rotation.x = -Math.PI / 2;
          ring.userData.challengePiece = true;
        }
        if (method === "fish") {
          const pole = mesh(
            new THREE.CylinderGeometry(0.025, 0.04, 2.8, 8),
            wood,
            props,
            [origin.x + 0.42, 1.55, origin.z - 0.72],
          );
          pole.rotation.z = -0.5;
          a.userData.action = "fish";
        } else a.userData.action = "dive";
      } else {
        const stone = material(0x465653, 0.96, 0.04);
        for (let i = 0; i < 5; i++) {
          const relic = mesh(
            method === "jungle"
              ? new THREE.CylinderGeometry(0.09, 0.14, 2.2 + (i % 2), 8)
              : new THREE.BoxGeometry(0.7 + (i % 2) * 0.35, 0.55, 0.7),
            method === "jungle" ? material(0x245d35, 0.9) : stone,
            props,
            [origin.x - 2 + i, 0.3, origin.z - 1.5 - (i % 2) * 0.35],
          );
          relic.rotation.z = method === "jungle" ? (i - 2) * 0.15 : 0;
        }
        a.userData.action = "search";
      }
      await new Promise((resolve) => setTimeout(resolve, 2900));
      a.userData.action = "celebrate";
      props.visible = false;
    },
    async confront(firstId, secondId) {
      const a = avatarMap.get(firstId),
        b = avatarMap.get(secondId);
      if (!a || !b) return;
      const ah = a.userData.home.clone(),
        bh = b.userData.home.clone();
      await Promise.all([
        moveTo(firstId, new THREE.Vector3(-0.8, 0, 1.2), "fight", 700),
        moveTo(secondId, new THREE.Vector3(0.8, 0, 1.2), "fight", 700),
      ]);
      a.rotation.y = Math.PI / 2;
      b.rotation.y = -Math.PI / 2;
      a.userData.action = "fight";
      b.userData.action = "fight";
      await new Promise((resolve) => setTimeout(resolve, 1900));
      await Promise.all([
        moveTo(firstId, ah, "walk", 720),
        moveTo(secondId, bh, "walk", 720),
      ]);
      a.userData.action = "idle";
      b.userData.action = "idle";
    },
    async duel(firstId, secondId, survivorId) {
      const a = avatarMap.get(firstId),
        b = avatarMap.get(secondId);
      if (!a || !b) return;
      await Promise.all([
        moveTo(firstId, new THREE.Vector3(-1.25, 0, 0.5), "run", 850),
        moveTo(secondId, new THREE.Vector3(1.25, 0, 0.5), "run", 850),
      ]);
      a.rotation.y = Math.PI / 2;
      b.rotation.y = -Math.PI / 2;
      a.userData.action = "fight";
      b.userData.action = "fight";
      flame(scene, -0.45, 0.45, -0.15, 0x31e7ff);
      flame(scene, 0.45, 0.45, -0.15, 0xff794f);
      await new Promise((resolve) => setTimeout(resolve, 2600));
      const winner = avatarMap.get(survivorId),
        loser = survivorId === firstId ? b : a;
      winner.userData.action = "celebrate";
      loser.userData.action = "idle";
      loser.rotation.z = survivorId === firstId ? 1.15 : -1.15;
      loser.position.y = -0.45;
    },
    celebrate(ids = []) {
      ids.forEach((id) => {
        const a = avatarMap.get(id);
        if (a) a.userData.action = "celebrate";
      });
    },
    speak(id) {
      avatarMap.forEach((a, avatarId) => {
        a.userData.action = avatarId === id ? "talk" : "idle";
      });
    },
    async exit(id) {
      const a = avatarMap.get(id);
      if (!a) return;
      flame(a, 0.55, 1.15, 0.3);
      await moveTo(id, new THREE.Vector3(7.8, 0, 7.4), "exit", 2600);
      a.visible = false;
    },
    idolBurst(id, type = "flame") {
      const a = avatarMap.get(id);
      if (!a) return;
      const idol = createIdol(a, [0, 2.1, 0.8], 0.72, type);
      idol.userData.burst = true;
      a.userData.action = "celebrate";
      const colors = {
          flame: 0xffd34e,
          mirror: 0xc9f4ff,
          storm: 0x3e7bff,
          twin: 0xff5da8,
          oracle: 0x9b5cff,
        },
        light = new THREE.PointLight(colors[type] || colors.flame, 9, 11);
      light.position.copy(a.position).add(new THREE.Vector3(0, 2.2, 1));
      scene.add(light);
      setTimeout(() => {
        scene.remove(light);
        a.userData.action = "idle";
      }, 3200);
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material))
          o.material.forEach((m) => {
            m.map?.dispose?.();
            m.dispose();
          });
        else {
          o.material?.map?.dispose?.();
          o.material?.dispose?.();
        }
      });
      scene.background?.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
