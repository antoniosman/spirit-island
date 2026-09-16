import { createGame, step, pairKey } from "./engine.js";
import { mountSpirit3D } from "./cinema3d.js";
const VERSION = "2026.09.16.2",
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
    faceImage: `characters/faces/${f.replace(/\.[^.]+$/, "")}.jpg`,
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
  liveTab = "episode",
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
    tribe = g?.tribes.find((t) => t.id === p.tribe),
    idolCount = live
      ? (g.idols || []).filter((idol) => !idol.used && idol.owner === p.id)
          .length
      : 0;
  return `<article class="card ${on && !live ? "picked" : ""} ${p.out ? "out" : ""}" style="--tribe:${tribe?.color || "#37e6c4"}"><div class="photo"><img src="${esc(p.image)}" alt="${esc(p.name)}">${idolCount ? `<b class="idol">◆ ${idolCount > 1 ? `${idolCount} IDOLS` : "IDOL"}</b>` : ""}${!live ? `<button data-toggle="${p.id}">${on ? "✓" : "+"}</button>` : ""}</div><h3>${esc(p.name)}</h3><small>${live ? (p.out ? "ΑΠΟΧΩΡΗΣΕ" : g.merge ? "MERGED" : tribe?.name || "ΝΗΣΙ") : "SPIRIT CASTAWAY"}</small></article>`;
}
function setup() {
  return `<section class="hero"><span>THE ISLAND IS AWAKE</span><h1>Δημιούργησε τη δική σου θρυλική σεζόν.</h1><p>Φυλές, κλίκες, κρυμμένα idols και μία φλόγα που πρέπει να μείνει αναμμένη.</p></section><nav>${button("01 Παίκτες", "tab-cast", tab === "cast" ? "active" : "")}${button("02 Ομάδες", "tab-tribes", tab === "tribes" ? "active" : "")}${button("03 Φιλίες & κλίκες", "tab-bonds", tab === "bonds" ? "active" : "")}</nav>${tab === "cast" ? castSetup() : tab === "tribes" ? tribeSetup() : bondSetup()}<aside class="launch"><div><b>${state.selected.length}</b><span>CASTAWAYS</span></div><div><b>${state.tribes?.length || 2}</b><span>TRIBES</span></div>${button("Ξεκίνα τη σεζόν ▷", "start", "primary")}</aside>`;
}
function castSetup() {
  return `<div class="title"><div><h2>Επίλεξε castaways</h2><p>Όρισε πρώτα το μέγεθος της σεζόν και μετά άλλαξε όποια πρόσωπα θέλεις.</p></div><div class="cast-count"><label>ΑΡΙΘΜΟΣ ΠΑΙΚΤΩΝ <select data-cast-size>${Array.from(
    { length: 19 },
    (_, i) => i + 8,
  )
    .map(
      (n) =>
        `<option value="${n}" ${state.selected.length === n ? "selected" : ""}>${n} παίκτες</option>`,
    )
    .join(
      "",
    )}</select></label>${button("+ Custom παίκτης", "custom")}</div></div><div class="grid">${state.players.map((p) => card(p)).join("")}</div>`;
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
    )}</div><button>+ Δημιουργία κλίκας</button></form><section class="idol-give"><h3>◆ Αρχικό Idol δοκιμής</h3><p>Δώσε ένα αρχικό idol σε παίκτη ή άφησέ το παιχνίδι να κρύψει δυναμικά πολλά idols στις παραλίες.</p><select id="idol-owner"><option value="">Κρυμμένο</option>${selected()
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
  const content = g.winner
    ? winnerView(g)
    : liveTab === "cliques"
      ? cliqueStats(g)
      : liveTab === "history"
        ? historyView(g)
        : liveTab === "ranking"
          ? rankingView(g)
          : eventView(last, g);
  return `<section class="livebar"><span>● LIVE · EPISODE ${g.episode}</span><b>${g.merge ? "MERGED · INDIVIDUAL GAME" : g.tribes.map((t) => t.name.toUpperCase()).join(" VS ")}</b><div>${button("Νέα σεζόν", "reset")}${!g.merge && g.stage === "challenge" ? button("Επιλογή νικήτριας ομάδας", "choose-tribe") : ""}${g.merge && g.stage === "challenge" ? button("Επιλογή νικητή ασυλίας", "choose-winner") : ""}${!g.winner ? button(stageName(g.stage) + " ▷", "next", "primary") : ""}</div></section><div class="phase-track"><span class="${g.stage === "challenge" ? "on" : ""}">ΑΣΥΛΙΑ</span><span class="${g.stage === "camp" ? "on" : ""}">ΣΥΖΗΤΗΣΕΙΣ</span><span class="${g.stage === "council" ? "on" : ""}">ΣΥΜΒΟΥΛΙΟ</span><span>TOP ${alive.length}</span></div>${groupedPlayers(g)}<nav class="live-tabs">${button("Επεισόδιο", "live-episode", liveTab === "episode" ? "active" : "")}${button("Κλίκες", "live-cliques", liveTab === "cliques" ? "active" : "")}${button("Ιστορικό", "live-history", liveTab === "history" ? "active" : "")}${button("Κατάταξη", "live-ranking", liveTab === "ranking" ? "active" : "")}</nav>${content}`;
}
function groupedPlayers(g) {
  const groups = g.merge
    ? [
        {
          name: "MERGED",
          title: "Ατομικό παιχνίδι",
          color: "#ffd36a",
          members: g.players.map((p) => p.id),
        },
      ]
    : g.tribes;
  return `<div class="tribe-groups">${groups
    .map(
      (t) =>
        `<section style="--c:${t.color}"><header><div><span>TRIBE</span><h2>${esc(t.name)}</h2><p>${esc(t.title || "")}</p></div><b>${t.members.filter((id) => !g.players.find((p) => p.id === id)?.out).length} ACTIVE</b></header><div class="grid livegrid">${t.members
          .map((id) => g.players.find((p) => p.id === id))
          .filter(Boolean)
          .map((p) => card(p, true))
          .join("")}</div></section>`,
    )
    .join("")}</div>`;
}
function eventView(e, g) {
  const get = (id) => g.players.find((p) => p.id === id);
  if (!e)
    return `<section class="episode"><span>ISLAND FEED</span><h2>Οι βάρκες πλησιάζουν</h2><p>Η σεζόν είναι έτοιμη να αρχίσει.</p></section>`;
  const category = e.final
    ? "ΤΕΛΙΚΟΣ"
    : e.evicted
      ? "ΣΥΜΒΟΥΛΙΟ"
      : e.immunityAnnouncement
        ? "ΑΣΥΛΙΑ"
        : e.merge
          ? "MERGE"
          : e.dialogue
            ? "ΣΥΖΗΤΗΣΕΙΣ"
            : stageName(e.stage).toUpperCase();
  return `<section class="episode ${e.idolPlayed || e.idol ? "idol-event" : ""}"><span>EPISODE ${e.episode} · ${esc(category)}</span><h2>${esc(e.title)}</h2><div class="faces">${e.ids.map((id) => (get(id) ? `<img src="${get(id).image}" title="${esc(get(id).name)}">` : "")).join("")}</div><p>${esc(e.text)}</p>${e.idolPlays?.length ? `<div class="idol-play-list">${e.idolPlays.map((x) => `◆ ${esc(get(x.actor)?.name)} σώζει ${esc(get(x.saved)?.name)}`).join("<br>")}</div>` : ""}${e.votes ? `<details open><summary>Ποιος ψήφισε ποιον</summary>${e.votes.map((v) => `<div class="vote-row"><span>${esc(get(v.voter)?.name)}</span><b>→</b><span>${esc(get(v.target)?.name)}</span></div>`).join("")}</details>` : ""}</section>`;
}
function historyView(g) {
  const episodes = [...new Set(g.history.map((e) => e.episode))].reverse();
  return `<section class="history"><h2>Αρχείο επεισοδίων</h2>${episodes
    .map(
      (n) =>
        `<details ${n === episodes[0] ? "open" : ""}><summary>EPISODE ${n}</summary>${g.history
          .filter((e) => e.episode === n)
          .map((e) => eventView(e, g))
          .join("")}</details>`,
    )
    .join("")}</section>`;
}
function cliqueStats(g) {
  const get = (id) => g.players.find((p) => p.id === id);
  return `<section class="clique-board"><h2>Κλίκες του νησιού</h2><p>Οι ενεργές κλίκες επηρεάζουν τις συζητήσεις, τα idols και κάθε ψήφο.</p>${
    g.cliques.length
      ? g.cliques
          .map(
            (c) =>
              `<article class="${c.active ? "active" : "broken"}"><span>${c.active ? "● ΕΝΕΡΓΗ" : "✕ ΔΙΑΛΥΘΗΚΕ"}</span><h3>${esc(c.name)}</h3><div class="faces">${c.members
                .map(get)
                .filter(Boolean)
                .map((p) => `<img src="${p.image}" title="${esc(p.name)}">`)
                .join("")}</div><p>${c.members
                .map((id) => get(id)?.name)
                .filter(Boolean)
                .join(" · ")}</p></article>`,
          )
          .join("")
      : '<p class="empty">Δεν υπάρχουν ακόμα κλίκες.</p>'
  }</section>`;
}
function rankingView(g) {
  const get = (id) => g.players.find((p) => p.id === id),
    rows = [];
  if (g.winner && g.finalData) {
    rows.push(
      { id: g.winner, place: 1 },
      { id: g.finalData.finalTwo.find((id) => id !== g.winner), place: 2 },
      { id: g.finalData.third, place: 3 },
    );
  }
  g.order.forEach((id, i) => rows.push({ id, place: g.players.length - i }));
  if (!g.winner)
    g.players
      .filter((p) => !p.out)
      .forEach((p) => rows.unshift({ id: p.id, place: "—" }));
  const unique = rows.filter(
    (r, i) => rows.findIndex((x) => x.id === r.id) === i,
  );
  return `<section class="ranking"><h2>Κατάταξη σεζόν</h2>${unique
    .map((r) => {
      const p = get(r.id);
      return `<div><b>${r.place === 1 ? "🏆" : r.place}.</b><img src="${p.image}"><span>${esc(p.name)}</span><small>${r.place === "—" ? "Ακόμα στο παιχνίδι" : r.place === 1 ? "Νικητής" : `Θέση ${r.place}`}</small></div>`;
    })
    .join("")}</section>`;
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
  return `<section class="winner"><span>SOLE SPIRIT OF THE ISLAND</span><img src="${w.image}"><h1>${esc(w.name)}</h1><p>Νικητής με την ψήφο όλων των αποχωρησάντων.</p><div class="winner-stats"><b>${w.wins}<small>ΝΙΚΕΣ</small></b><b>${w.strategy}/10<small>ΣΤΡΑΤΗΓΙΚΗ</small></b><b>${w.social}/10<small>ΚΟΙΝΩΝΙΚΟΤΗΤΑ</small></b></div></section>${eventView(g.history.at(-1), g)}${rankingView(g)}`;
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
        if (!state.selected.includes(id) && state.selected.length >= 26)
          return toast("Το μέγιστο είναι 26 παίκτες.");
        state.selected = state.selected.includes(id)
          ? state.selected.filter((x) => x !== id)
          : [...state.selected, id];
        syncTribes();
        save();
        render();
      }),
  );
  const castSize = app.querySelector("[data-cast-size]");
  if (castSize)
    castSize.onchange = () => {
      const size = +castSize.value,
        current = state.selected.filter((id) =>
          state.players.some((p) => p.id === id),
        ),
        additions = state.players
          .filter((p) => !current.includes(p.id))
          .map((p) => p.id);
      state.selected = current.slice(0, size);
      while (state.selected.length < size && additions.length)
        state.selected.push(additions.shift());
      syncTribes();
      save();
      render();
    };
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
  ov.innerHTML = `<div class="council-stage3d"></div><div class="council-hud"><span>● LIVE · ΣΥΜΒΟΥΛΙΟ ΤΟΥ ΝΗΣΙΟΥ</span><h1>Οι παίκτες παίρνουν τις θέσεις τους</h1><img class="reveal-portrait"><p>Η ψηφοφορία αρχίζει.</p></div><div class="jury-badge">JURY · ${Math.max(0, g.jury.length - 1)}</div><button>Παράλειψη σκηνής</button>`;
  document.body.append(ov);
  let skipped = false;
  ov.querySelector("button").onclick = () => (skipped = true);
  const h = ov.querySelector(".council-hud h1"),
    img = ov.querySelector(".reveal-portrait"),
    p = ov.querySelector(".council-hud p"),
    wait = (ms) => new Promise((r) => setTimeout(r, skipped ? 60 : ms)),
    participantIds = [
      ...new Set([
        ...e.votes.map((v) => v.voter),
        ...e.safeOrder,
        ...(e.idolSaved ? [e.idolSaved] : []),
        ...(e.idolPlays || []).map((play) => play.actor),
        e.evicted,
        ...g.jury.filter((id) => id !== e.evicted),
      ]),
    ],
    participants = participantIds
      .map((id) => g.players.find((x) => x.id === id))
      .filter(Boolean),
    colors = Object.fromEntries(g.tribes.map((t) => [t.id, t.color])),
    stage = await mountSpirit3D(
      ov.querySelector(".council-stage3d"),
      participants,
      {
        mode: "council",
        jury: g.jury.filter((id) => id !== e.evicted),
        colors,
      },
    );
  await wait(900);
  for (const line of e.councilDialogue || []) {
    if (skipped) break;
    const speaker = g.players.find((x) => x.name === line.speaker);
    stage.speak(speaker?.id);
    h.textContent = line.speaker;
    img.src = speaker?.image || "icon.svg";
    img.classList.add("visible");
    p.textContent = `“${line.text}”`;
    await wait(1900);
  }
  for (const vote of e.votes) {
    if (skipped) break;
    const voter = g.players.find((x) => x.id === vote.voter);
    h.textContent = `${voter.name} σηκώνεται για να ψηφίσει`;
    img.src = voter.image;
    img.classList.add("visible");
    p.textContent = "Η ψήφος παραμένει μυστική μέχρι την αποκάλυψη.";
    await stage.vote(voter.id);
  }
  img.classList.remove("visible");
  h.textContent = "Η κάλπη σφραγίστηκε";
  p.textContent = "Οι φλόγες θα αποκαλύψουν την απόφαση.";
  await wait(1000);
  for (const id of e.safeOrder) {
    const x = g.players.find((q) => q.id === id);
    h.textContent = "Ο επόμενος που παραμένει είναι… " + x.name;
    img.src = x.image;
    img.classList.add("visible");
    p.textContent = "Η φλόγα σου συνεχίζει.";
    await wait(1200);
  }
  const idolPlays = e.idolPlays?.length
    ? e.idolPlays
    : e.idolPlayed
      ? [{ actor: e.idolPlayed, saved: e.idolSaved }]
      : [];
  for (let idolIndex = 0; idolIndex < idolPlays.length; idolIndex++) {
    const play = idolPlays[idolIndex],
      actor = g.players.find((q) => q.id === play.actor),
      saved = g.players.find((q) => q.id === play.saved);
    h.textContent = `${saved.name}, η απόφαση φαίνεται οριστική…`;
    img.src = saved.image;
    p.textContent = "Η φλόγα ετοιμάζεται να σβήσει.";
    await wait(1800);
    ov.classList.add("idol-twist");
    stage.idolBurst(actor.id);
    h.textContent = `${idolIndex ? "ΚΙ ΑΛΛΟ IDOL!" : "Μισό λεπτό — έχει γίνει κάποιο λάθος!"}`;
    img.src = actor.image;
    p.innerHTML = `◆ ${esc(actor.name)} ΕΚΑΝΕ ΧΡΗΣΗ IDOL<br>${esc(saved.name)}, η φλόγα σου παραμένει αναμμένη.`;
    await wait(3600);
    ov.classList.remove("idol-twist");
    h.textContent = "Οι ψήφοι του Idol ακυρώθηκαν. Αποχωρεί ο επόμενος…";
    p.textContent = "Το Συμβούλιο αλλάζει απόφαση.";
    await wait(1800);
  }
  const out = g.players.find((q) => q.id === e.evicted);
  h.textContent = out.name;
  img.src = out.image;
  p.textContent = `Η φλόγα σου σβήνει · Θέση ${e.place}`;
  await wait(1200);
  h.textContent = `${out.name}, πάρε τη δάδα σου`;
  p.textContent = `Αποχωρεί από το νησί και παίρνει τη θέση ${e.place}.`;
  await stage.exit(out.id);
  await wait(650);
  stage.dispose();
  ov.remove();
  await topBoard();
  await intro();
}
async function topBoard() {
  if (!state.cinema) return;
  const g = state.game,
    alive = g.players.filter((p) => !p.out),
    ov = document.createElement("div");
  ov.className = "top-board";
  ov.innerHTML = `<button>Συνέχεια</button><div><span>THE GAME CONTINUES</span><h1>TOP ${alive.length}</h1>${g.tribes
    .map(
      (t) =>
        `<section style="--c:${t.color}"><h2>${esc(t.name)}</h2><div>${t.members
          .map((id) => g.players.find((p) => p.id === id))
          .filter(Boolean)
          .map(
            (p) =>
              `<figure class="${p.out ? "gone" : ""}"><img src="${p.image}"><figcaption>${esc(p.name)}</figcaption></figure>`,
          )
          .join("")}</div></section>`,
    )
    .join("")}</div>`;
  document.body.append(ov);
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 4500);
    ov.querySelector("button").onclick = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  ov.remove();
}
async function announcementScene(e) {
  if (!state.cinema || !e?.immunityAnnouncement) return;
  const g = state.game,
    tribe = g.tribes.find((t) => t.id === e.tribe),
    ov = document.createElement("div");
  ov.className = "announcement";
  ov.innerHTML = `<div style="--c:${tribe?.color || "#ffd36a"}"><span>IMMUNITY</span><i>◇</i><h1>${esc(tribe?.name || g.players.find((p) => p.id === e.ids[0])?.name)}</h1><p>${esc(e.text)}</p></div>`;
  document.body.append(ov);
  await new Promise((r) => setTimeout(r, 3000));
  ov.remove();
}
async function challengeScene(e) {
  if (!state.cinema || !e?.immunityAnnouncement) return;
  const g = state.game,
    ov = document.createElement("div"),
    alive = g.players.filter((p) => !p.out),
    colors = Object.fromEntries(g.tribes.map((t) => [t.id, t.color]));
  ov.className = "challenge-scene";
  ov.innerHTML = `<div class="challenge-stage3d"></div><div class="challenge-hud"><span>● LIVE · ${g.merge ? "ΑΤΟΜΙΚΗ" : "ΟΜΑΔΙΚΗ"} ΑΣΥΛΙΑ</span><h1>${esc(e.challengeName || "ΔΟΚΙΜΑΣΙΑ ΑΣΥΛΙΑΣ")}</h1><p>${{ race: "Ταχύτητα · εμπόδια · τερματισμός", balance: "Ισορροπία · συγκέντρωση · ψυχραιμία", puzzle: "Στρατηγική · συναρμολόγηση · ταχύτητα", endurance: "Αντοχή · θέληση · τελευταίος όρθιος", memory: "Μνήμη · κρύσταλλοι · σωστή ακολουθία", totem: "Αναζήτηση · ευστοχία · τοτέμ" }[e.challengeType] || "Δύναμη · στρατηγική · αντοχή"}</p></div><button>Παράλειψη</button>`;
  document.body.append(ov);
  const stage = await mountSpirit3D(
    ov.querySelector(".challenge-stage3d"),
    alive,
    {
      mode: "challenge",
      colors,
      challengeType: e.challengeType,
    },
  );
  let done = false,
    skip;
  const skipped = new Promise((resolve) => (skip = resolve));
  ov.querySelector("button").onclick = () => {
    done = true;
    skip();
  };
  await Promise.race([stage.playChallenge(e.ids || []), skipped]);
  if (done) {
    stage.dispose();
    ov.remove();
    return;
  }
  ov.querySelector(".challenge-hud h1").textContent =
    "Η ΔΟΚΙΜΑΣΙΑ ΟΛΟΚΛΗΡΩΘΗΚΕ";
  ov.querySelector(".challenge-hud p").textContent =
    "Η ασυλία έχει νέο κάτοχο.";
  await new Promise((r) => setTimeout(r, 1300));
  stage.dispose();
  ov.remove();
}
async function idolDiscoveryScene(e) {
  if (!state.cinema || !e?.idol || !e.idolOwner) return;
  const g = state.game,
    finder = g.players.find((p) => p.id === e.idolOwner),
    ov = document.createElement("div");
  if (!finder) return;
  ov.className = "idol-discovery";
  ov.innerHTML = `<div class="idol-stage3d"></div><div class="idol-discovery-hud"><span>SECRET SCENE</span><h1>ΕΝΑ IDOL ΞΥΠΝΗΣΕ</h1><p>${esc(finder.name)} ανακάλυψε ένα κρυμμένο φυλαχτό.</p></div><button>Συνέχεια</button>`;
  document.body.append(ov);
  const stage = await mountSpirit3D(
    ov.querySelector(".idol-stage3d"),
    [finder],
    {
      mode: "council",
    },
  );
  stage.idolBurst(finder.id);
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 4200);
    ov.querySelector("button").onclick = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  stage.dispose();
  ov.remove();
}
async function finalReveal(e) {
  if (!state.cinema || !e?.final) return;
  const g = state.game,
    get = (id) => g.players.find((p) => p.id === id),
    ov = document.createElement("div");
  ov.className = "finale-scene";
  ov.innerHTML = "<button>Παράλειψη</button><div></div>";
  document.body.append(ov);
  let stopped = false;
  ov.querySelector("button").onclick = () => {
    stopped = true;
    ov.remove();
  };
  const box = ov.querySelector("div"),
    wait = (ms) => new Promise((r) => setTimeout(r, ms));
  box.innerHTML = `<span>THE JURY</span><h1>Όλοι οι αποχωρήσαντες ψηφίζουν</h1><div class="final-grid">${e.voters.map((id) => `<figure><img src="${get(id).image}"><figcaption>${esc(get(id).name)}</figcaption></figure>`).join("")}</div>`;
  await wait(3600);
  if (stopped) return;
  box.innerHTML = `<span>FINAL THREE</span><h1>Οι τρεις φιναλίστ</h1><div class="final-grid finalists">${g.finalists.map((id) => `<figure><img src="${get(id).image}"><figcaption>${esc(get(id).name)}</figcaption></figure>`).join("")}</div>`;
  await wait(3200);
  if (stopped) return;
  const third = get(e.third);
  box.innerHTML = `<span>3Η ΘΕΣΗ</span><h1>${esc(third.name)}</h1><img class="final-single" src="${third.image}"><p>${e.tally.find((x) => x.id === third.id).n} ψήφοι</p>`;
  await wait(3000);
  if (stopped) return;
  box.innerHTML = `<span>FINAL TWO</span><h1>Μεταξύ των…</h1><div class="final-grid finalists">${e.finalTwo.map((id) => `<figure><img src="${get(id).image}"><figcaption>${esc(get(id).name)}</figcaption></figure>`).join("")}</div>`;
  await wait(3000);
  if (stopped) return;
  const winner = get(g.winner);
  box.innerHTML = `<span>SOLE SPIRIT OF THE ISLAND</span><h1>Ο ΝΙΚΗΤΗΣ ΕΙΝΑΙ…<br>${esc(winner.name)}</h1><img class="final-single winner-shot" src="${winner.image}"><p>${e.tally.find((x) => x.id === winner.id).n} ψήφοι νίκης</p>`;
  await wait(5000);
  if (!stopped) ov.remove();
}
async function mergeReveal(e) {
  if (!state.cinema || !e?.merge) return;
  const g = state.game,
    ov = document.createElement("div");
  ov.className = "merge-scene";
  ov.innerHTML = `<button>Συνέχεια</button><div><span>THE MERGE</span><h1>ΤΟ ΠΑΙΧΝΙΔΙ ΓΙΝΕΤΑΙ ΑΤΟΜΙΚΟ</h1>${e.returned?.length ? `<h2>ΕΠΙΣΤΡΕΦΟΥΝ: ${e.returned.map((id) => esc(g.players.find((p) => p.id === id)?.name)).join(" & ")}</h2>` : ""}<div class="final-grid">${g.players
    .filter((p) => !p.out)
    .map(
      (p) =>
        `<figure><img src="${p.image}"><figcaption>${esc(p.name)}</figcaption></figure>`,
    )
    .join(
      "",
    )}</div><p>Αυτοί είναι οι παίκτες που έφτασαν στα ατομικά.</p></div>`;
  document.body.append(ov);
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 6000);
    ov.querySelector("button").onclick = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  ov.remove();
}
async function dialogueScene(e) {
  if (!state.cinema || !e?.dialogue?.length) return;
  const g = state.game,
    ov = document.createElement("div"),
    speakers = [
      ...new Set(
        e.dialogue
          .map((line) => g.players.find((p) => p.name === line.speaker)?.id)
          .filter(Boolean),
      ),
    ]
      .map((id) => g.players.find((p) => p.id === id))
      .filter(Boolean),
    colors = Object.fromEntries(g.tribes.map((t) => [t.id, t.color]));
  ov.className = "council pov";
  ov.innerHTML = `<div class="dialogue-stage3d"></div><div class="council-hud dialogue-hud"><span>● LIVE · ISLAND CAM</span><h1></h1><img class="reveal-portrait visible"><p></p></div><button>Παράλειψη</button>`;
  document.body.append(ov);
  const stage = await mountSpirit3D(
    ov.querySelector(".dialogue-stage3d"),
    speakers,
    { mode: "council", colors },
  );
  let stopped = false;
  ov.querySelector("button").onclick = () => {
    stopped = true;
    stage.dispose();
    ov.remove();
  };
  for (const line of e.dialogue) {
    if (stopped) return;
    const player = state.game.players.find((p) => p.name === line.speaker);
    stage.speak(player?.id);
    ov.querySelector(".dialogue-hud h1").textContent = line.speaker;
    ov.querySelector(".dialogue-hud img").src = player?.image || "icon.svg";
    ov.querySelector(".dialogue-hud p").textContent = `“${line.text}”`;
    await new Promise((resolve) => setTimeout(resolve, 2200));
  }
  if (!stopped) {
    stage.dispose();
    ov.remove();
  }
}
async function action(a) {
  if (a.startsWith("live-")) {
    liveTab = a.slice(5);
    return render();
  }
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
    state.game = createGame(
      ps,
      state.tribes,
      state.bonds,
      state.idolOwner,
      state.alliances,
    );
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
      else if (e?.final) await finalReveal(e);
      else if (e?.merge) {
        await mergeReveal(e);
        await intro();
      } else if (e?.immunityAnnouncement) {
        await challengeScene(e);
        await announcementScene(e);
      } else if (e?.idol) await idolDiscoveryScene(e);
      else await dialogueScene(e);
    } catch (err) {
      console.error(err);
      document
        .querySelectorAll(
          ".intro,.council,.challenge-scene,.idol-discovery,.announcement,.merge-scene,.finale-scene,.top-board",
        )
        .forEach((x) => x.remove());
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
      if (state.selected.length < 26) state.selected.push(p.id);
      else toast("Ο παίκτης αποθηκεύτηκε. Το ενεργό cast έχει ήδη 26 άτομα.");
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
async function checkForUpdate(manual = false) {
  toast("Έλεγχος για ενημερωμένη έκδοση…");
  try {
    const v = await fetch(`version.json?${Date.now()}`, {
      cache: "no-store",
    }).then((r) => r.json());
    if (v.version !== VERSION) {
      toast("Βρέθηκε ενημέρωση · εγκατάσταση…");
      for (const registration of await navigator.serviceWorker.getRegistrations())
        await registration.unregister();
      for (const cache of await caches.keys()) await caches.delete(cache);
      location.replace(
        `${location.pathname}?version=${encodeURIComponent(v.version)}`,
      );
      return;
    }
    if (manual) toast("Έχεις την τελευταία έκδοση.");
  } catch {
    if (manual) toast("Δεν ήταν δυνατός ο έλεγχος. Δοκίμασε ξανά.");
  }
}
document.querySelector("#update").onclick = () => checkForUpdate(true);
await ready;
state.bonds ||= {};
state.alliances ||= [];
state.selected ||= defaults.slice(0, 16).map((p) => p.id);
state.players ||= defaults;
for (const standard of defaults) {
  const saved = state.players.find((p) => p.id === standard.id);
  if (saved && !saved.custom) saved.faceImage = standard.faceImage;
}
state.tribes ||= [];
if (state.game) {
  state.game.cliques ||= structuredClone(state.alliances).map((c, i) => ({
    id: c.id || `clique-${i}`,
    name: c.name,
    members: [...c.members],
    active: true,
    createdEpisode: 1,
  }));
  state.game.mergePending ||= false;
}
syncTribes();
render();
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
setTimeout(() => checkForUpdate(false), 350);
