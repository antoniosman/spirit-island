import * as THREE from "./vendor/three.module.min.js";

const TAU = Math.PI * 2;

function loadTexture(url, timeout = 4500) {
  return Promise.race([
    new THREE.TextureLoader().loadAsync(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Texture timeout: ${url}`)), timeout),
    ),
  ]);
}

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

async function portraitMaterial(url, prepared = false, fallbackUrl = null) {
  try {
    const texture = await loadTexture(url);
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
    if (fallbackUrl && fallbackUrl !== url)
      return portraitMaterial(fallbackUrl, false, null);
    return new THREE.MeshBasicMaterial({ color: 0x6ddbc8 });
  }
}

async function cutoutMaterial(url, fallbackUrl = null) {
  try {
    const source = await loadTexture(url),
      image = source.image,
      canvas = document.createElement("canvas"),
      width = 256,
      height = 448;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d"),
      imageWidth = image.naturalWidth || image.width || width,
      imageHeight = image.naturalHeight || image.height || height,
      targetRatio = width / height,
      sourceRatio = imageWidth / imageHeight;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(8, 5, width - 16, height - 10, 112);
    ctx.clip();
    if (sourceRatio > targetRatio) {
      const cropWidth = imageHeight * targetRatio,
        cropX = (imageWidth - cropWidth) / 2;
      ctx.drawImage(image, cropX, 0, cropWidth, imageHeight, 0, 0, width, height);
    } else {
      const cropHeight = imageWidth / targetRatio,
        cropY = Math.max(0, (imageHeight - cropHeight) * 0.22);
      ctx.drawImage(image, 0, cropY, imageWidth, cropHeight, 0, 0, width, height);
    }
    const gradient = ctx.createLinearGradient(0, height * 0.62, 0, height);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,.18)");
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    source.dispose();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.04,
      side: THREE.DoubleSide,
    });
  } catch {
    if (fallbackUrl && fallbackUrl !== url)
      return cutoutMaterial(fallbackUrl, null);
    return new THREE.MeshBasicMaterial({ color: 0x4b8f87, transparent: true, opacity: 0.8 });
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
  const portraitCutout = mesh(
    new THREE.PlaneGeometry(1.05, 1.88),
    await cutoutMaterial(player.image, player.faceImage),
    group,
    [0, 1.58, 0.36],
  );
  portraitCutout.renderOrder = 2;
  portraitCutout.userData.cutout = true;
  const head = new THREE.Group();
  head.position.set(0, 2.58, 0);
  group.add(head);
  mesh(new THREE.SphereGeometry(0.39, 20, 14), skin, head);
  const face = mesh(
    new THREE.PlaneGeometry(0.64, 0.72),
    await portraitMaterial(
      player.faceImage || player.image,
      !!player.faceImage,
      player.image,
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

function createHost(parent) {
  const host = new THREE.Group(),
    suit = material(0x101820, 0.45, 0.45),
    shirt = material(0xe9e0c7, 0.62, 0.05),
    skin = material(0xb77755, 0.75, 0.03),
    gold = material(0xd6a844, 0.25, 0.8);
  parent.add(host);
  mesh(new THREE.CapsuleGeometry(0.4, 1.06, 6, 14), suit, host, [0, 1.62, 0]);
  mesh(new THREE.BoxGeometry(0.18, 0.72, 0.08), shirt, host, [0, 1.67, 0.38]);
  const head = mesh(new THREE.SphereGeometry(0.38, 20, 14), skin, host, [0, 2.62, 0]);
  const hair = mesh(new THREE.SphereGeometry(0.4, 18, 10, 0, TAU, 0, Math.PI * 0.5), suit, host, [0, 2.75, -0.02]);
  const leftArm = limb(0.11, 0.94, suit, host, -0.48, 1.98, 0),
    rightArm = limb(0.11, 0.94, suit, host, 0.48, 1.98, 0),
    badge = mesh(new THREE.OctahedronGeometry(0.11, 0), gold, host, [0, 1.68, 0.47]);
  badge.rotation.z = Math.PI / 4;
  const label = labelSprite("HOST", "#ffd46b");
  label.position.set(0, 3.3, 0);
  host.add(label);
  host.userData.rig = {
    head,
    leftArm: leftArm.pivot,
    rightArm: rightArm.pivot,
  };
  host.userData.action = "present";
  host.position.set(0, 0, -2.05);
  host.scale.setScalar(0.92);
  return host;
}

function voteCard(name) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e7dcc0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#493621";
  ctx.lineWidth = 24;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.fillStyle = "#17252a";
  ctx.font = "900 76px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name.toUpperCase(), canvas.width / 2, canvas.height / 2, canvas.width - 90);
  ctx.font = "700 24px sans-serif";
  ctx.fillText("SPIRIT ISLAND · TRIBAL COUNCIL", canvas.width / 2, canvas.height - 62);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 1.08),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
}

function decorateIsland(scene, mode) {
  if (mode !== "camp" && mode !== "discovery") return;
  const water = mesh(
    new THREE.CircleGeometry(34, 64),
    new THREE.MeshStandardMaterial({
      color: 0x087c8a,
      roughness: 0.25,
      metalness: 0.18,
      transparent: true,
      opacity: 0.72,
    }),
    scene,
    [0, -0.54, -2],
  );
  water.rotation.x = -Math.PI / 2;
  water.userData.water = true;
  const sand = mesh(
    new THREE.CylinderGeometry(9.4, 10.2, 0.28, 28),
    material(0xb99155, 0.95, 0.01),
    scene,
    [0, -0.38, 0],
  );
  sand.scale.z = 0.68;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU,
      x = Math.cos(angle) * (6.3 + (i % 2)),
      z = Math.sin(angle) * 4.2 - 0.8,
      trunk = mesh(
        new THREE.CylinderGeometry(0.12, 0.23, 3.1, 9),
        material(0x6d4325, 0.95),
        scene,
        [x, 1.1, z],
      );
    trunk.rotation.z = Math.sin(i * 2) * 0.18;
    for (let j = 0; j < 5; j++) {
      const leaf = mesh(
        new THREE.ConeGeometry(0.22, 2.25, 5),
        material(0x1c713f, 0.8),
        scene,
        [x + Math.cos((j / 5) * TAU) * 0.55, 2.82, z + Math.sin((j / 5) * TAU) * 0.55],
      );
      leaf.rotation.z = Math.PI / 2;
      leaf.rotation.y = (j / 5) * TAU;
    }
  }
  const shelter = new THREE.Group();
  shelter.position.set(-4.3, 0, -1.8);
  scene.add(shelter);
  for (const side of [-1, 1]) {
    const roof = mesh(new THREE.BoxGeometry(3.6, 0.12, 2.3), material(0x5b3a22, 0.95), shelter, [0, 1.65, side * 0.72]);
    roof.rotation.x = side * 0.62;
  }
  flame(scene, 0, 0.45, -0.4, 0xff7a23);
  for (let i = 0; i < 10; i++) {
    const rock = mesh(
      new THREE.DodecahedronGeometry(0.22 + (i % 3) * 0.08, 0),
      material(i % 2 ? 0x43574e : 0x6d6858, 0.96),
      scene,
      [Math.sin(i * 2.4) * 7.2, 0.05, Math.cos(i * 1.7) * 3.8],
    );
    rock.rotation.set(i, i * 0.4, 0);
  }
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
    mode === "challenge" ? 5.8 : mode === "camp" || mode === "discovery" ? 4.7 : 6.2,
    mode === "challenge" ? 16.8 : mode === "camp" || mode === "discovery" ? 14.2 : 15.5,
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
    const backdrop = await loadTexture(
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
    material(
      mode === "challenge"
        ? 0x386654
        : mode === "camp" || mode === "discovery"
          ? 0x51764f
          : 0x18252a,
      0.92,
      0.03,
    ),
    scene,
    [0, -0.28, 0],
  );
  floor.receiveShadow = true;
  const avatarMap = new Map();
  const colors = options.colors || {};
  decorateIsland(scene, mode);
  const host = mode === "council" ? createHost(scene) : null;

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
      } else if (["archery", "spear"].includes(type)) {
        const target = mesh(
          new THREE.CylinderGeometry(0.62, 0.62, 0.12, 24),
          material(i % 2 ? 0xffdf73 : 0xef5b43, 0.5, 0.22),
          scene,
          [x, 1.18, -2.1],
        );
        target.rotation.x = Math.PI / 2;
        target.userData.target = true;
      } else if (type === "climb") {
        mesh(
          new THREE.CylinderGeometry(0.3, 0.48, 4.5, 12),
          material(i % 2 ? 0x755336 : 0x42625c, 0.9),
          scene,
          [x, 1.9, -1.4],
        );
      } else if (type === "raft") {
        const raft = mesh(
          new THREE.BoxGeometry(1.25, 0.18, 2.4),
          material(0x8b5b2d, 0.92),
          scene,
          [x, 0.08, -1.4],
        );
        raft.userData.raft = true;
      } else if (type === "maze") {
        for (let wall = 0; wall < 3; wall++)
          mesh(
            new THREE.BoxGeometry(0.18, 1.05, 2.2),
            material(0x285e42, 0.86),
            scene,
            [x + (wall - 1) * 0.48, 0.48, -1.4 - wall * 1.35],
          );
      } else if (type === "fire") {
        mesh(
          new THREE.CylinderGeometry(0.32, 0.46, 1.4, 12),
          material(0x554234, 0.88),
          scene,
          [x, 0.52, -1.5],
        );
        flame(scene, x, 1.42, -1.5, i % 2 ? 0xff5a24 : 0x48e8ff);
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

  const preparedAvatars = await Promise.all(
    players.map(async (p, i) => ({
      p,
      i,
      a: await avatar(
        p,
        colors[p.tribe] || (i % 2 ? "#ff9d4d" : "#35d7c2"),
      ),
    })),
  );
  for (const { p, i, a } of preparedAvatars) {
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
    } else if (mode === "camp") {
      const angle = -0.85 + (1.7 * i) / Math.max(1, players.length - 1),
        radius = players.length > 6 ? 4.7 : 3.5;
      a.position.set(Math.sin(angle) * radius, 0, 1.6 + Math.cos(angle) * 1.4);
      a.rotation.y = -angle * 0.38;
      a.userData.home = a.position.clone();
      a.userData.action = "idle";
    } else if (mode === "discovery") {
      a.position.set((i - (players.length - 1) / 2) * 1.5, 0, 1.4);
      a.userData.home = a.position.clone();
      a.userData.action = "idle";
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
      } else if (a.userData.action === "row") {
        r.leftArm.rotation.x = -1.15 + Math.sin(phase) * 0.55;
        r.rightArm.rotation.x = -1.15 + Math.sin(phase) * 0.55;
        a.rotation.z = Math.sin(phase * 0.7) * 0.07;
      } else if (a.userData.action === "throw") {
        r.rightArm.rotation.x = -1.8 + Math.sin(phase * 1.4) * 0.75;
        r.leftArm.rotation.z = 0.8;
      } else if (a.userData.action === "climb") {
        r.leftArm.rotation.x = -1.4 + Math.sin(phase) * 0.8;
        r.rightArm.rotation.x = -1.4 - Math.sin(phase) * 0.8;
        r.leftLeg.rotation.x = Math.sin(phase) * 0.55;
        r.rightLeg.rotation.x = -Math.sin(phase) * 0.55;
      } else if (a.userData.action === "carry") {
        r.leftArm.rotation.z = 1.12;
        r.rightArm.rotation.z = -1.12;
        r.leftArm.rotation.x = -0.75;
        r.rightArm.rotation.x = -0.75;
      } else {
        a.position.y = Math.sin(phase * 0.35) * 0.025;
      }
    });
    if (host) {
      const hr = host.userData.rig;
      hr.head.rotation.y = Math.sin(t * 0.58) * 0.12;
      hr.leftArm.rotation.x = -0.72 + Math.sin(t * 1.4) * 0.16;
      hr.rightArm.rotation.x = -0.72 - Math.sin(t * 1.4) * 0.16;
    }
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
      if (o.userData.water) {
        o.material.opacity = 0.62 + Math.sin(t * 1.4) * 0.08;
        o.rotation.z = Math.sin(t * 0.12) * 0.015;
      }
      if (o.userData.raft) o.rotation.z = Math.sin(t * 1.6 + o.position.x) * 0.045;
      if (o.userData.target) o.rotation.z = Math.sin(t * 0.7 + o.position.x) * 0.08;
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
    async revealVote(name) {
      if (!host) return;
      const card = voteCard(name);
      card.position.set(0, 2.18, 0.9);
      card.rotation.y = Math.PI;
      card.scale.setScalar(0.08);
      host.add(card);
      const start = performance.now();
      await new Promise((resolve) => {
        const turn = (now) => {
          const x = Math.min(1, (now - start) / 720),
            eased = 1 - Math.pow(1 - x, 3);
          card.rotation.y = Math.PI * (1 - eased);
          card.scale.setScalar(0.08 + eased * 0.92);
          if (x < 1 && !disposed) requestAnimationFrame(turn);
          else resolve();
        };
        requestAnimationFrame(turn);
      });
      await new Promise((resolve) => setTimeout(resolve, 760));
      host.remove(card);
      card.geometry.dispose();
      card.material.map.dispose();
      card.material.dispose();
    },
    async playChallenge(winnerIds = []) {
      const type = options.challengeType || "race",
        winnerSet = new Set(winnerIds),
        runners = [...avatarMap.entries()],
        wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      if (type === "race" || type === "totem" || type === "maze") {
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
      } else if (type === "raft") {
        runners.forEach(([, a]) => (a.userData.action = "row"));
        for (let wave = 0; wave < 3; wave++) {
          await Promise.all(
            runners.map(([id, a], index) => {
              const checkpoint = a.position.clone();
              checkpoint.z -= 1.35;
              checkpoint.x += Math.sin(index + wave) * 0.25;
              return moveTo(id, checkpoint, "row", 720 + (index % 4) * 90);
            }),
          );
        }
      } else if (type === "archery" || type === "spear") {
        runners.forEach(([, a]) => (a.userData.action = "throw"));
        for (let round = 0; round < 3; round++) {
          const projectiles = runners.map(([, a], index) => {
            const projectile = mesh(
              type === "archery"
                ? new THREE.CylinderGeometry(0.022, 0.022, 1.05, 7)
                : new THREE.ConeGeometry(0.055, 1.35, 8),
              material(type === "archery" ? 0xffdb75 : 0xaee9ff, 0.42, 0.35),
              scene,
              [a.position.x, 1.45 + (index % 2) * 0.08, a.position.z - 0.35],
            );
            projectile.rotation.x = Math.PI / 2;
            return projectile;
          });
          const started = performance.now();
          await new Promise((resolve) => {
            const fly = (now) => {
              const progress = Math.min(1, (now - started) / 620);
              projectiles.forEach((projectile, index) => {
                projectile.position.z -= 0.105;
                projectile.position.y += Math.sin(progress * Math.PI) * 0.012;
                projectile.rotation.z = Math.sin(index + round) * 0.08;
              });
              if (progress < 1 && !disposed) requestAnimationFrame(fly);
              else resolve();
            };
            requestAnimationFrame(fly);
          });
          projectiles.forEach((projectile) => {
            scene.remove(projectile);
            projectile.geometry.dispose();
            projectile.material.dispose();
          });
          scene.traverse((o) => {
            if (o.userData.target) o.rotation.y += 0.7 + round * 0.2;
          });
          await wait(180);
        }
      } else if (type === "climb") {
        runners.forEach(([, a]) => (a.userData.action = "climb"));
        await Promise.all(
          runners.map(([id, a], index) => {
            const target = a.position.clone();
            target.y = winnerSet.has(id) ? 2.8 : 1.1 + (index % 3) * 0.45;
            target.z -= 1.4;
            return moveTo(id, target, "climb", winnerSet.has(id) ? 2350 : 2800);
          }),
        );
      } else if (type === "fire") {
        runners.forEach(([, a]) => {
          a.userData.action = "carry";
          flame(a, 0.36, 1.18, 0.25, 0xff7b26);
        });
        await Promise.all(
          runners.map(([id, a], index) => {
            const target = a.position.clone();
            target.z -= winnerSet.has(id) ? 4.8 : 2.4 + (index % 3) * 0.3;
            return moveTo(id, target, "carry", 2400 + (index % 4) * 100);
          }),
        );
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
    async attack(attackerId, targetId, type = "spirit-pistol") {
      const attacker = avatarMap.get(attackerId),
        target = avatarMap.get(targetId);
      if (!attacker || !target) return;
      await Promise.all([
        moveTo(attackerId, new THREE.Vector3(-1.15, 0, 0.85), "fight", 820),
        moveTo(targetId, new THREE.Vector3(1.25, 0, 0.85), "fight", 820),
      ]);
      attacker.rotation.y = Math.PI / 2;
      target.rotation.y = -Math.PI / 2;
      attacker.userData.action = "fight";
      target.userData.action = "fight";
      await new Promise((resolve) => setTimeout(resolve, 900));
      const origin = attacker.position.clone().add(new THREE.Vector3(0.55, 1.65, 0)),
        destination = target.position.clone().add(new THREE.Vector3(-0.35, 1.55, 0)),
        projectile = mesh(
          type === "magic-blast"
            ? new THREE.IcosahedronGeometry(0.22, 1)
            : new THREE.SphereGeometry(0.09, 12, 8),
          new THREE.MeshStandardMaterial({
            color: type === "spirit-pistol" ? 0xffdc72 : 0x9a52ff,
            emissive: type === "spirit-pistol" ? 0xff6b20 : 0x5722ff,
            emissiveIntensity: 4,
          }),
          scene,
          origin.toArray(),
        );
      if (type === "spirit-pistol") {
        const weapon = mesh(
          new THREE.BoxGeometry(0.65, 0.16, 0.2),
          material(0x24282d, 0.22, 0.88),
          attacker,
          [0.55, 1.62, 0.22],
        );
        weapon.rotation.z = -0.08;
      } else if (type === "duel-strike") {
        const blade = mesh(
          new THREE.ConeGeometry(0.07, 1.35, 8),
          material(0xd7eef3, 0.15, 0.92),
          attacker,
          [0.5, 1.38, 0.2],
        );
        blade.rotation.z = -1.1;
      }
      const flash = new THREE.PointLight(
        type === "magic-blast" ? 0x8b52ff : 0xff7a32,
        14,
        15,
      );
      flash.position.copy(origin);
      scene.add(flash);
      const start = performance.now();
      await new Promise((resolve) => {
        const fly = (now) => {
          const x = Math.min(1, (now - start) / 620),
            eased = x * x * (3 - 2 * x);
          projectile.position.lerpVectors(origin, destination, eased);
          projectile.scale.setScalar(1 + Math.sin(x * Math.PI) * 1.6);
          if (x < 1 && !disposed) requestAnimationFrame(fly);
          else resolve();
        };
        requestAnimationFrame(fly);
      });
      scene.remove(projectile, flash);
      const impact = new THREE.PointLight(0xff3a35, 18, 17);
      impact.position.copy(destination);
      scene.add(impact);
      target.userData.action = "idle";
      target.rotation.z = -1.35;
      target.position.y = -0.62;
      await new Promise((resolve) => setTimeout(resolve, 1800));
      scene.remove(impact);
      attacker.userData.action = "idle";
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
      const effect = new THREE.Group();
      effect.position.copy(a.position).add(new THREE.Vector3(0, 1.45, 0));
      scene.add(effect);
      if (type === "storm") {
        for (let i = 0; i < 7; i++) {
          const bolt = mesh(
            new THREE.ConeGeometry(0.035, 2.2, 5),
            new THREE.MeshBasicMaterial({ color: 0x73b7ff }),
            effect,
            [Math.sin(i * 2.2) * 0.9, 0.5, Math.cos(i) * 0.45],
          );
          bolt.rotation.z = (i - 3) * 0.18;
        }
      } else if (type === "mirror") {
        for (const side of [-1, 1]) {
          const disc = mesh(
            new THREE.CircleGeometry(0.62, 28),
            new THREE.MeshBasicMaterial({
              color: 0xdffaff,
              transparent: true,
              opacity: 0.58,
              side: THREE.DoubleSide,
            }),
            effect,
            [side * 1.05, 0.45, 0],
          );
          disc.rotation.y = side * 0.5;
        }
      } else if (type === "twin") {
        for (const side of [-1, 1])
          mesh(
            new THREE.TorusKnotGeometry(0.38, 0.055, 48, 8),
            new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff5ca9 : 0xffd66f }),
            effect,
            [side * 0.72, 0.5, 0],
          ).userData.challengePiece = true;
      } else if (type === "oracle") {
        const eye = mesh(
          new THREE.TorusGeometry(0.8, 0.08, 12, 48),
          new THREE.MeshBasicMaterial({ color: 0xc28cff }),
          effect,
          [0, 0.62, 0],
        );
        eye.scale.y = 0.52;
        eye.userData.challengePiece = true;
      } else {
        for (let i = 0; i < 8; i++)
          flame(effect, Math.sin(i * 1.7) * 0.8, 0.2, Math.cos(i * 1.7) * 0.6, 0xffc247);
      }
      setTimeout(() => {
        scene.remove(light, effect);
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
