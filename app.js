import { createGame, step, pairKey } from "./engine.js";
const VERSION = "2026.09.15.2",
  files = [
    "Alex.webp",
    "Billy.webp",
    "Catherine.png",
    "demarin.webp",
    "elisa.webp",
    "Ester.png",
    "Eva.png",
    "Evaggelia.png",
    "evelyn.webp",
    "hope.webp",
    "Ian.png",
    "irene.png",
    "Jasmine.png",
    "Luna.webp",
    "Paul.png",
    "pauline.webp",
    "phillip.webp",
    "rino.webp",
    "sargenie.jpeg",
    "smaragda.jpeg",
    "Sorina.png",
    "tony.webp",
    "vicky.jpg",
    "Vincent.jpg",
    "Violet.png",
    "zoe.jpeg",
  ],
  defaults = files.map((f, i) => ({
    id: "spirit-" + i,
    name: f.split(".")[0].replace(/^./, (c) => c.toUpperCase()),
    image: "characters/" + f,
    strategy: 5,
    social: 5,
    competition: 5,
  }));
let state = {
    players: defaults,
    selected: defaults.slice(0, 16).map((p) => p.id),
    preset: "classic",
    tribes: [],
    bonds: {},
    alliances: [],
    idolOwner: null,
    game: null,
    cinema: true,
  },
  tab = "cast",
  busy = false,
  installPrompt,
  db;
const app = document.querySelector("#app"),
  modal = document.querySelector("#modal"),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  selected = () => state.players.filter((p) => state.selected.includes(p.id)),
  toast = (t) => {
    const x = document.querySelector("#toast");
    x.textContent = t;
    x.classList.add("show");
    setTimeout(() => x.classList.remove("show"), 2600);
  };
const ready = new Promise((r) => {
  const q = indexedDB.open("spirit-island", 1);
  q.onupgradeneeded = () => q.result.createObjectStore("save");
  q.onsuccess = () => {
    db = q.result;
    const g = db.transaction("save").objectStore("save").get("game");
    g.onsuccess = () => {
      if (g.result) state = g.result;
      r();
    };
    g.onerror = r;
  };
  q.onerror = r;
});
function save() {
  if (db)
    db.transaction("save", "readwrite")
      .objectStore("save")
      .put(structuredClone(state), "game");
}
const button = (label, action, cls = "") =>
  `<button class="${cls}" data-action="${action}">${label}</button>`;
function setPreset(type) {
  state.preset = type;
  if (type === "boys") {
    const men = new Set([
        "Billy",
        "Ian",
        "Paul",
        "Phillip",
        "Rino",
        "Sargenie",
        "Tony",
        "Vincent",
      ]),
      boys = state.players.filter((p) => men.has(p.name)).slice(0, 8),
      girls = state.players.filter((p) => !men.has(p.name)).slice(0, 8);
    state.selected = [...boys, ...girls].map((p) => p.id);
    state.tribes = [
      {
        id: "t1",
        name: "Triton",
        title: "Οι Γιοι της Καταιγίδας",
        color: "#19bde3",
        members: boys.map((p) => p.id),
      },
      {
        id: "t2",
        name: "Calypso",
        title: "Οι Κόρες της Φλόγας",
        color: "#ff5d73",
        members: girls.map((p) => p.id),
      },
    ];
  } else {
    const ps = selected();
    if (type === "three")
      state.tribes = [
        tribe(
          "t1",
          "Solara",
          "Οι Φύλακες του Ήλιου",
          "#ff9f43",
          ps.filter((_, i) => i % 3 === 0),
        ),
        tribe(
          "t2",
          "Nerissa",
          "Οι Ψίθυροι του Ωκεανού",
          "#20d6c7",
          ps.filter((_, i) => i % 3 === 1),
        ),
        tribe(
          "t3",
          "Nyx",
          "Τα Πνεύματα της Νύχτας",
          "#9a72ff",
          ps.filter((_, i) => i % 3 === 2),
        ),
      ];
    else
      state.tribes = [
        tribe(
          "t1",
          "Aurelia",
          "Η Φυλή της Ανατολής",
          "#ff8c42",
          ps.filter((_, i) => i % 2 === 0),
        ),
        tribe(
          "t2",
          "Thalassa",
          "Η Φυλή της Παλίρροιας",
          "#18c8bd",
          ps.filter((_, i) => i % 2 === 1),
        ),
      ];
  }
  save();
  render();
}
const tribe = (id, name, title, color, ps) => ({
  id,
  name,
  title,
  color,
  members: ps.map((p) => p.id),
});
function syncTribes() {
  if (!state.tribes?.length) setPreset(state.preset || "classic");
  const valid = new Set(state.selected);
  state.tribes.forEach(
    (t) => (t.members = t.members.filter((id) => valid.has(id))),
  );
  for (const id of state.selected)
    if (!state.tribes.some((t) => t.members.includes(id)))
      state.tribes
        .sort((a, b) => a.members.length - b.members.length)[0]
        ?.members.push(id);
}
function card(p, live = false) {
  const on = state.selected.includes(p.id),
    g = state.game,
    tribe = g?.tribes.find((t) => t.id === p.tribe);
  return `<article class="card ${on && !live ? "picked" : ""} ${p.out ? "out" : ""}" style="--tribe:${tribe?.color || "#37e6c4"}"><div class="photo"><img src="${esc(p.image)}" alt="${esc(p.name)}">${live && g.idol.owner === p.id && !g.idol.used ? '<b class="idol">◆ IDOL</b>' : ""}${!live ? `<button data-toggle="${p.id}">${on ? "✓" : "+"}</button>` : ""}</div><h3>${esc(p.name)}</h3><small>${live ? (p.out ? "ΑΠΟΧΩΡΗΣΕ" : g.merge ? "MERGED" : tribe?.name || "ΝΗΣΙ") : "SPIRIT CASTAWAY"}</small></article>`;
}
function setup() {
  return `<section class="hero"><span>THE ISLAND IS AWAKE</span><h1>Δημιούργησε τη δική σου θρυλική σεζόν.</h1><p>Φυλές, κλίκες, κρυμμένα idols και μία φλόγα που πρέπει να μείνει αναμμένη.</p></section><nav>${button("01 Παίκτες", "tab-cast", tab === "cast" ? "active" : "")}${button("02 Ομάδες", "tab-tribes", tab === "tribes" ? "active" : "")}${button("03 Φιλίες & κλίκες", "tab-bonds", tab === "bonds" ? "active" : "")}</nav>${tab === "cast" ? castSetup() : tab === "tribes" ? tribeSetup() : bondSetup()}<aside class="launch"><div><b>${state.selected.length}</b><span>CASTAWAYS</span></div><div><b>${state.tribes?.length || 2}</b><span>TRIBES</span></div>${button("Ξεκίνα τη σεζόν ▷", "start", "primary")}</aside>`;
}
function castSetup() {
  return `<div class="title"><h2>Επίλεξε castaways</h2>${button("+ Custom παίκτης", "custom")}</div><div class="grid">${state.players.map((p) => card(p)).join("")}</div>`;
}
function tribeSetup() {
  syncTribes();
  return `<div class="title"><div><h2>Μορφή σεζόν</h2><p>Στο intro εμφανίζεται πρώτα η ταυτότητα κάθε ομάδας και μετά οι παίκτες της σε τυχαία σειρά.</p></div></div><div class="presets"><button data-preset="classic">2 Φυλές</button><button data-preset="boys">Boys vs Girls · 8–8</button><button data-preset="three">3 Φυλές</button></div><div class="tribe-editor">${state.tribes
    .map(
      (t) =>
        `<section style="--c:${t.color}"><input data-tribe-name="${t.id}" value="${esc(t.name)}"><input data-tribe-title="${t.id}" value="${esc(t.title)}"><label>Χρώμα <input type="color" data-tribe-color="${t.id}" value="${t.color}"></label><div>${selected()
          .map(
            (p) =>
              `<label><input type="radio" name="member-${p.id}" data-assign="${p.id}" value="${t.id}" ${t.members.includes(p.id) ? "checked" : ""}> ${esc(p.name)}</label>`,
          )
          .join("")}</div></section>`,
    )
    .join("")}</div>`;
}
function bondSetup() {
  return `<div class="title"><div><h2>Φιλίες, έχθρες και κλίκες</h2><p>Οι σχέσεις επηρεάζουν προστασία, ψήφους, idols και την τελική κριτική επιτροπή.</p></div></div><form id="bond"><select name="a">${selected()
    .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
    .join("")}</select><select name="b">${selected()
    .map(
      (p, i) =>
        `<option value="${p.id}" ${i === 1 ? "selected" : ""}>${esc(p.name)}</option>`,
    )
    .join(
      "",
    )}</select><select name="score"><option value="9">Κολλητοί</option><option value="5">Φίλοι</option><option value="0">Ουδέτεροι</option><option value="-8">Εχθροί</option></select><button>Αποθήκευση</button></form><form id="clique"><input name="name" placeholder="Όνομα κλίκας" required><div class="chips">${selected()
    .map(
      (p) =>
        `<label><input type="checkbox" name="member" value="${p.id}"> ${esc(p.name)}</label>`,
    )
    .join(
      "",
    )}</div><button>+ Δημιουργία κλίκας</button></form><section class="idol-give"><h3>◆ Idol δοκιμής</h3><p>Δώσε το μοναδικό idol σε έναν παίκτη ή άφησέ το κρυμμένο στην παραλία.</p><select id="idol-owner"><option value="">Κρυμμένο</option>${selected()
    .map(
      (p) =>
        `<option value="${p.id}" ${state.idolOwner === p.id ? "selected" : ""}>${esc(p.name)}</option>`,
    )
    .join(
      "",
    )}</select></section>${state.alliances.map((a) => `<div class="clique"><b>${esc(a.name)}</b><span>${a.members.map((id) => state.players.find((p) => p.id === id)?.name).join(" · ")}</span></div>`).join("")}`;
}
function live() {
  const g = state.game,
    last = g.history.at(-1),
    alive = g.players.filter((p) => !p.out);
  return `<section class="livebar"><span>● LIVE · EPISODE ${g.episode}</span><b>${g.merge ? "MERGED · INDIVIDUAL GAME" : g.tribes.map((t) => t.name.toUpperCase()).join(" VS ")}</b><div>${button("Νέα σεζόν", "reset")}${!g.merge && g.stage === "challenge" ? button("Επιλογή νικήτριας ομάδας", "choose-tribe") : ""}${g.merge && g.stage === "challenge" ? button("Επιλογή νικητή ασυλίας", "choose-winner") : ""}${button(stageName(g.stage) + " ▷", "next", "primary")}</div></section><div class="grid livegrid">${g.players.map((p) => card(p, true)).join("")}</div>${
    g.winner
      ? winnerView(g)
      : `<section class="episode"><span>ISLAND FEED · ${alive.length} REMAIN</span><h2>${last?.title || "Οι βάρκες πλησιάζουν"}</h2><div class="faces">${(
          last?.ids || []
        )
          .map((id) => {
            const p = g.players.find((x) => x.id === id);
            return p ? `<img src="${p.image}" title="${esc(p.name)}">` : "";
          })
          .join(
            "",
          )}</div><p>${last?.text || "Η σεζόν είναι έτοιμη να αρχίσει."}</p></section>`
  }`;
}
const stageName = (s) =>
  ({
    challenge: "Δοκιμασία ασυλίας",
    camp: "Ζωή στην παραλία",
    council: "Συμβούλιο",
    return: "Επιστροφή παικτών",
    final: "Τελικός",
  })[s] || "Συνέχεια";
function winnerView(g) {
  const w = g.players.find((p) => p.id === g.winner);
  return `<section class="winner"><span>SOLE SPIRIT OF THE ISLAND</span><img src="${w.image}"><h1>${esc(w.name)}</h1><p>Νικητής με την ψήφο όσων έφτασαν στο Merge.</p></section>`;
}
function render() {
  syncTribes();
  document.body.dataset.live = !!state.game;
  app.innerHTML = state.game ? live() : setup();
  bind();
}
function bind() {
  app
    .querySelectorAll("[data-action]")
    .forEach((b) => (b.onclick = () => action(b.dataset.action)));
  app.querySelectorAll("[data-toggle]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.toggle;
        state.selected = state.selected.includes(id)
          ? state.selected.filter((x) => x !== id)
          : [...state.selected, id];
        syncTribes();
        save();
        render();
      }),
  );
  app
    .querySelectorAll("[data-preset]")
    .forEach((b) => (b.onclick = () => setPreset(b.dataset.preset)));
  app.querySelectorAll("[data-assign]").forEach(
    (x) =>
      (x.onchange = () => {
        state.tribes.forEach(
          (t) =>
            (t.members = t.members.filter((id) => id !== x.dataset.assign)),
        );
        state.tribes
          .find((t) => t.id === x.value)
          .members.push(x.dataset.assign);
        save();
      }),
  );
  app.querySelectorAll("[data-tribe-name]").forEach(
    (x) =>
      (x.onchange = () => {
        state.tribes.find((t) => t.id === x.dataset.tribeName).name = x.value;
        save();
      }),
  );
  app.querySelectorAll("[data-tribe-title]").forEach(
    (x) =>
      (x.onchange = () => {
        state.tribes.find((t) => t.id === x.dataset.tribeTitle).title = x.value;
        save();
      }),
  );
  app.querySelectorAll("[data-tribe-color]").forEach(
    (x) =>
      (x.oninput = () => {
        state.tribes.find((t) => t.id === x.dataset.tribeColor).color = x.value;
        save();
      }),
  );
  const f = app.querySelector("#bond");
  if (f)
    f.onsubmit = (e) => {
      e.preventDefault();
      const d = new FormData(f),
        a = d.get("a"),
        b = d.get("b");
      if (a === b) return toast("Διάλεξε δύο διαφορετικούς παίκτες.");
      state.bonds[pairKey(a, b)] = +d.get("score");
      save();
      toast("Η σχέση αποθηκεύτηκε.");
    };
  const c = app.querySelector("#clique");
  if (c)
    c.onsubmit = (e) => {
      e.preventDefault();
      const d = new FormData(c),
        members = d.getAll("member");
      if (members.length < 2)
        return toast("Η κλίκα χρειάζεται τουλάχιστον δύο μέλη.");
      state.alliances.push({ name: d.get("name"), members });
      members.forEach((a) =>
        members.forEach((b) => {
          if (a !== b)
            state.bonds[pairKey(a, b)] = Math.max(
              6,
              state.bonds[pairKey(a, b)] || 0,
            );
        }),
      );
      save();
      render();
    };
  const idol = app.querySelector("#idol-owner");
  if (idol)
    idol.onchange = () => {
      state.idolOwner = idol.value || null;
      save();
    };
}
async function choice(title, text, players) {
  return new Promise((resolve) => {
    modal.innerHTML = `<form><h2>${title}</h2><p>${text}</p><div class="choices">${players.map((p, i) => `<label><input type="radio" name="pick" value="${p.id}" ${i ? "" : "checked"}><img src="${p.image}"><b>${esc(p.name)}</b></label>`).join("")}</div><div class="actions"><button type="button" id="random">Τυχαία επιλογή</button><button class="primary">Επιβεβαίωση</button></div></form>`;
    modal.showModal();
    const done = (id) => {
      modal.close();
      resolve(id);
    };
    modal.querySelector("#random").onclick = () =>
      done(players[Math.floor(Math.random() * players.length)].id);
    modal.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      done(new FormData(e.target).get("pick"));
    };
  });
}
async function intro() {
  if (!state.cinema) return;
  const g = state.game,
    overlay = document.createElement("div"),
    music = new Audio("intro_music.mp3");
  music.loop = true;
  music.volume = 0.62;
  overlay.className = "intro";
  overlay.innerHTML =
    '<button>SKIP INTRO</button><div class="introcontent"></div>';
  document.body.append(overlay);
  music.play().catch(() => {});
  let stop = false;
  const finish = () => {
    stop = true;
    music.pause();
    music.currentTime = 0;
    overlay.remove();
  };
  overlay.querySelector("button").onclick = () => {
    finish();
  };
  const box = overlay.querySelector(".introcontent"),
    wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const t of g.tribes) {
    if (stop) return;
    box.innerHTML = `<div class="tribemark" style="--c:${t.color}"><i>◇</i><h1>${esc(t.name)}</h1><p>${esc(t.title)}</p></div>`;
    await wait(1800);
    const members = [...g.players.filter((p) => p.tribe === t.id)].sort(
      () => Math.random() - 0.5,
    );
    for (const p of members) {
      if (stop) return;
      const ix = g.order.indexOf(p.id),
        place = ix < 0 ? null : g.players.length - ix;
      box.innerHTML = `<div class="introperson ${p.out ? "gone" : ""}" style="--c:${t.color}"><img src="${p.image}"><h1>${esc(p.name)} ${place ? `<small>ΘΕΣΗ ${place}</small>` : ""}</h1><b>${esc(t.name)}</b></div>`;
      await wait(1700);
    }
  }
  if (!stop) finish();
}
async function councilReveal(e) {
  if (!state.cinema || !e.evicted) return;
  const g = state.game,
    ov = document.createElement("div");
  ov.className = "council";
  ov.innerHTML =
    "<div><span>ΤΟ ΣΥΜΒΟΥΛΙΟ ΑΠΟΦΑΣΙΣΕ</span><h1></h1><img><p></p></div><button>Συνέχεια</button>";
  document.body.append(ov);
  const h = ov.querySelector("h1"),
    img = ov.querySelector("img"),
    p = ov.querySelector("p"),
    wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const id of e.safeOrder) {
    const x = g.players.find((q) => q.id === id);
    h.textContent = "Ο επόμενος που παραμένει είναι… " + x.name;
    img.src = x.image;
    p.textContent = "Η φλόγα σου συνεχίζει.";
    await wait(1200);
  }
  const out = g.players.find((q) => q.id === e.evicted);
  h.textContent = out.name;
  img.src = out.image;
  p.textContent = `Η φλόγα σου σβήνει · Θέση ${e.place}`;
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 3500);
    ov.querySelector("button").onclick = () => {
      clearTimeout(t);
      resolve();
    };
  });
  ov.remove();
  await intro();
}
async function dialogueScene(e) {
  if (!state.cinema || !e?.dialogue?.length) return;
  const ov = document.createElement("div");
  ov.className = "council pov";
  ov.innerHTML =
    "<div><span>● LIVE · ISLAND CAM</span><h1></h1><img><p></p></div><button>Παράλειψη</button>";
  document.body.append(ov);
  let stopped = false;
  ov.querySelector("button").onclick = () => {
    stopped = true;
    ov.remove();
  };
  for (const line of e.dialogue) {
    if (stopped) return;
    const player = state.game.players.find((p) => p.name === line.speaker);
    ov.querySelector("h1").textContent = line.speaker;
    ov.querySelector("img").src = player?.image || "icon.svg";
    ov.querySelector("p").textContent = `“${line.text}”`;
    await new Promise((resolve) => setTimeout(resolve, 2200));
  }
  if (!stopped) ov.remove();
}
async function action(a) {
  if (a.startsWith("tab-")) {
    tab = a.slice(4);
    return render();
  }
  if (a === "custom") return customPlayer();
  if (a === "reset") {
    state.game = null;
    save();
    return render();
  }
  if (a === "choose-tribe") {
    const active = state.game.tribes.filter((t) =>
        state.game.players.some((p) => !p.out && p.tribe === t.id),
      ),
      id = await choice(
        "Νικήτρια ομάδα",
        "Διάλεξε ποια ομάδα κερδίζει την ασυλία.",
        active.map((t) => ({
          id: t.id,
          name: t.name,
          image: "island-hero.png",
        })),
      );
    state.game.winnerTeamChoice = id;
    save();
    return toast("Η νικήτρια ομάδα ορίστηκε.");
  }
  if (a === "choose-winner") {
    const ps = state.game.players.filter((p) => !p.out),
      id = await choice(
        "Νικητής ασυλίας",
        "Διάλεξε ποιος κερδίζει την ατομική ασυλία.",
        ps,
      );
    state.game.individualWinnerChoice = id;
    save();
    toast("Η επιλογή θα ισχύσει στην επόμενη δοκιμασία.");
    return;
  }
  if (a === "start") {
    syncTribes();
    const map = new Map(
        state.tribes.flatMap((t) => t.members.map((id) => [id, t.id])),
      ),
      ps = selected().map((p) => ({ ...p, tribe: map.get(p.id) }));
    state.game = createGame(ps, state.tribes, state.bonds, state.idolOwner);
    save();
    render();
    return intro();
  }
  if (a === "next" && !busy) {
    busy = true;
    try {
      let e = step(state.game);
      while (e?.requiresChoice) {
        const ps = e.candidates.map((id) =>
            state.game.players.find((p) => p.id === id),
          ),
          id = await choice(
            "Επιστροφή από την Εξορία",
            "Διάλεξε τον πρώτο παίκτη. Ο δεύτερος θα είναι τυχαίος.",
            ps,
          );
        state.game.returnChoice = id;
        e = step(state.game);
      }
      save();
      render();
      if (e?.evicted) await councilReveal(e);
      else if (e?.merge || e?.returned) await intro();
      else await dialogueScene(e);
    } catch (err) {
      console.error(err);
      document.querySelectorAll(".intro,.council").forEach((x) => x.remove());
      toast("Η ροή αποκαταστάθηκε. Πάτησε ξανά.");
    } finally {
      busy = false;
      save();
      render();
    }
  }
}
function customPlayer() {
  modal.innerHTML =
    '<form id="custom"><h2>Custom castaway</h2><input name="name" placeholder="Όνομα" required><input name="photo" type="file" accept="image/*" required><label>Στρατηγική <input name="strategy" type="range" min="1" max="10" value="5"></label><label>Κοινωνικότητα <input name="social" type="range" min="1" max="10" value="5"></label><label>Δύναμη <input name="competition" type="range" min="1" max="10" value="5"></label><button class="primary">Προσθήκη</button></form>';
  modal.showModal();
  modal.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const d = new FormData(e.target),
      file = d.get("photo"),
      r = new FileReader();
    r.onload = () => {
      const p = {
        id: crypto.randomUUID(),
        name: d.get("name"),
        image: r.result,
        strategy: +d.get("strategy"),
        social: +d.get("social"),
        competition: +d.get("competition"),
        custom: true,
      };
      state.players.push(p);
      state.selected.push(p.id);
      syncTribes();
      save();
      modal.close();
      render();
    };
    r.readAsDataURL(file);
  };
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});
document.querySelector("#install").onclick = async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = null;
  } else toast("Στο iPhone: Share → Add to Home Screen");
};
document.querySelector("#update").onclick = async () => {
  const v = await fetch(`version.json?${Date.now()}`, {
    cache: "no-store",
  }).then((r) => r.json());
  if (v.version !== VERSION) {
    for (const r of await navigator.serviceWorker.getRegistrations())
      await r.unregister();
    for (const c of await caches.keys()) await caches.delete(c);
    location.reload();
  } else toast("Έχεις την τελευταία έκδοση.");
};
await ready;
state.bonds ||= {};
state.alliances ||= [];
state.selected ||= defaults.slice(0, 16).map((p) => p.id);
state.players ||= defaults;
state.tribes ||= [];
syncTribes();
render();
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
