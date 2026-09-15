export const pairKey = (a, b) => [a, b].sort().join("|");
const pick = (items, score, rng = Math.random) =>
  items
    .map((x) => ({ x, n: score(x) + rng() * 10 }))
    .sort((a, b) => b.n - a.n)[0]?.x;
export function createGame(players, tribes, bonds, idolOwner = null) {
  return {
    players: structuredClone(players).map((p) => ({
      ...p,
      out: false,
      wins: 0,
    })),
    tribes: structuredClone(tribes),
    bonds: structuredClone(bonds),
    episode: 1,
    stage: "challenge",
    merge: false,
    mergeAnnounced: false,
    returnDone: false,
    order: [],
    jury: [],
    history: [],
    winner: null,
    finalists: [],
    idol: { owner: idolOwner, used: false },
    winnerTeamChoice: null,
    individualWinnerChoice: null,
    returnChoice: null,
  };
}
export function step(s, rng = Math.random) {
  const alive = s.players.filter((p) => !p.out),
    get = (id) => s.players.find((p) => p.id === id),
    name = (id) => get(id)?.name || "",
    bond = (a, b) => s.bonds[pairKey(a, b)] || 0;
  const event = (title, text, ids = [], extra = {}) => {
    const e = { episode: s.episode, title, text, ids, ...extra };
    s.history.push(e);
    return e;
  };
  if (s.winner) return null;
  if (alive.length === 3) {
    const jury = s.jury.map(get).filter(Boolean),
      votes = jury.map((j) => ({
        voter: j.id,
        target: pick(
          alive,
          (p) =>
            bond(j.id, p.id) + p.social * 1.1 + p.strategy * 0.7 + p.wins * 1.5,
          rng,
        ).id,
      }));
    const tally = alive
      .map((p) => ({ p, n: votes.filter((v) => v.target === p.id).length }))
      .sort((a, b) => b.n - a.n);
    const winner =
      tally[0].n === tally[1].n
        ? pick(alive, (p) => p.social + p.strategy + p.wins, rng)
        : tally[0].p;
    s.winner = winner.id;
    s.finalists = alive.map((p) => p.id);
    s.stage = "final";
    return event(
      "Ο ζωντανός τελικός",
      `${winner.name} κερδίζει το Spirit Island! Ψήφισαν μόνο όσοι έφτασαν στο Merge.`,
      alive.map((p) => p.id),
      { final: true, votes },
    );
  }
  if (s.stage === "return") {
    const pool = s.order.map(get).filter((p) => p?.out);
    const chosen = pool.find((p) => p.id === s.returnChoice);
    if (!chosen)
      return { requiresChoice: "return", candidates: pool.map((p) => p.id) };
    const rest = pool.filter((p) => p.id !== chosen.id),
      random = rest[Math.floor(rng() * rest.length)],
      returned = [chosen, random].filter(Boolean);
    returned.forEach((p) => {
      p.out = false;
      s.order = s.order.filter((id) => id !== p.id);
    });
    s.returnChoice = null;
    s.returnDone = true;
    s.stage = "challenge";
    return event(
      "Η Παλίρροια της Επιστροφής",
      `${returned.map((p) => p.name).join(" και ")} επιστρέφουν. Ο ένας επιλέχθηκε από το κοινό και ο άλλος από την τύχη.`,
      returned.map((p) => p.id),
      { twist: true, returned: returned.map((p) => p.id) },
    );
  }
  if (s.stage === "challenge") {
    if (!s.merge) {
      const active = s.tribes.filter((t) =>
        alive.some((p) => p.tribe === t.id),
      );
      if (active.length <= 1 || alive.length <= 10) {
        s.merge = true;
        s.mergeAnnounced = true;
        s.stage = !s.returnDone && s.order.length >= 2 ? "return" : "challenge";
        return event(
          "MERGE · Μία νέα παραλία",
          `Οι ${alive.length} επιζώντες πετούν τα παλιά χρώματα. Από εδώ και πέρα το παιχνίδι είναι ατομικό.`,
          alive.map((p) => p.id),
          { merge: true, twist: true },
        );
      }
      const chosen = active.find((t) => t.id === s.winnerTeamChoice),
        winner =
          chosen ||
          pick(
            active,
            (t) =>
              t.members
                .filter((id) => !get(id)?.out)
                .reduce((n, id) => n + get(id).competition, 0),
            rng,
          );
      s.winnerTeamChoice = null;
      s.safeTribe = winner.id;
      s.stage = "camp";
      alive.filter((p) => p.tribe === winner.id).forEach((p) => p.wins++);
      return event(
        "Δοκιμασία ασυλίας",
        `${winner.name} κερδίζει την ομαδική ασυλία. Οι υπόλοιπες ομάδες πηγαίνουν στο Συμβούλιο.`,
        alive.filter((p) => p.tribe === winner.id).map((p) => p.id),
        { tribe: winner.id },
      );
    }
    const selectedWinner = alive.find((p) => p.id === s.individualWinnerChoice),
      winner =
        selectedWinner ||
        pick(
          alive,
          (p) => p.competition * 1.2 + p.strategy * 0.4 + p.wins * 0.3,
          rng,
        );
    s.individualWinnerChoice = null;
    winner.wins++;
    s.individualImmune = winner.id;
    s.stage = "camp";
    return event(
      "Ατομική ασυλία",
      `${winner.name} κερδίζει το φυλαχτό και δεν μπορεί να αποχωρήσει απόψε.`,
      [winner.id],
    );
  }
  if (s.stage === "camp") {
    if (!s.idol.owner && !s.idol.used && rng() < 0.18) {
      const finder = alive[Math.floor(rng() * alive.length)];
      s.idol.owner = finder.id;
      s.stage = "council";
      return event(
        "Το κρυμμένο Idol βρέθηκε",
        `${finder.name} ανακαλύπτει το μοναδικό Idol του νησιού. Το μυστικό σύμβολο εμφανίζεται στην κάρτα του.`,
        [finder.id],
        { idol: true },
      );
    }
    const a = alive[Math.floor(rng() * alive.length)],
      others = alive.filter((p) => p.id !== a.id),
      b = others[Math.floor(rng() * others.length)],
      k = pairKey(a.id, b.id),
      delta = rng() > 0.42 ? 2 : -2;
    s.bonds[k] = Math.max(-10, Math.min(10, (s.bonds[k] || 0) + delta));
    s.stage = "council";
    return event(
      delta > 0 ? "Συμμαχία στην ακτή" : "Ρήγμα στην κλίκα",
      delta > 0
        ? `${a.name} και ${b.name} δίνουν κρυφό όρκο δίπλα στη φωτιά.`
        : `${a.name} και ${b.name} συγκρούονται για το σχέδιο της ψηφοφορίας.`,
      [a.id, b.id],
      {
        dialogue: [
          {
            speaker: a.name,
            text: delta > 0 ? "Μέχρι το τέλος μαζί." : "Δεν σε εμπιστεύομαι.",
          },
          {
            speaker: b.name,
            text:
              delta > 0
                ? "Κανείς δεν θα το μάθει."
                : "Τότε θα γράψω το όνομά σου.",
          },
        ],
      },
    );
  }
  if (s.stage === "council") {
    let vulnerable = s.merge
      ? alive.filter((p) => p.id !== s.individualImmune)
      : alive.filter((p) => p.tribe !== s.safeTribe);
    if (!vulnerable.length) vulnerable = alive;
    const voters = s.merge ? alive : vulnerable,
      votes = voters
        .map((v) => ({
          voter: v.id,
          target: pick(
            vulnerable.filter((p) => p.id !== v.id),
            (p) => -bond(v.id, p.id) + p.strategy * 0.45 - p.social * 0.25,
            rng,
          )?.id,
        }))
        .filter((v) => v.target);
    if (!votes.length)
      alive
        .filter((p) => vulnerable.some((x) => x.id === p.id))
        .forEach((v) =>
          votes.push({
            voter: v.id,
            target: pick(
              vulnerable.filter((p) => p.id !== v.id),
              (p) => -bond(v.id, p.id) + p.strategy * 0.4,
              rng,
            )?.id,
          }),
        );
    const rank = () =>
        vulnerable
          .map((p) => ({
            id: p.id,
            n: votes.filter((v) => v.target === p.id).length,
          }))
          .sort((a, b) => b.n - a.n),
      first = rank()[0];
    let out = first.id,
      idolPlayed = null;
    const holder = get(s.idol.owner);
    if (
      holder &&
      !holder.out &&
      !s.idol.used &&
      (out === holder.id || bond(holder.id, out) >= 6)
    ) {
      idolPlayed = out;
      s.idol.used = true;
      s.idol.owner = null;
      const next = rank().find((x) => x.id !== out);
      if (next) out = next.id;
    }
    const leaving = get(out);
    leaving.out = true;
    s.order.push(out);
    if (s.merge) s.jury.push(out);
    const safeOrder = vulnerable
      .filter((p) => p.id !== out)
      .sort(() => rng() - 0.5)
      .map((p) => p.id);
    const place = s.players.length - s.order.length + 1;
    s.individualImmune = null;
    s.safeTribe = null;
    s.stage = "challenge";
    s.episode++;
    return event(
      "Συμβούλιο του Νησιού",
      `${safeOrder.map(name).join(", ")} παραμένουν. ${leaving.name}, η φλόγα σου σβήνει — Θέση ${place}.${idolPlayed ? ` Το Idol έσωσε τον ${name(idolPlayed)} και ενεργοποιήθηκε η δεύτερη επιλογή.` : ""}`,
      safeOrder.concat(out),
      { evicted: out, safeOrder, place, idolPlayed, votes },
    );
  }
}
