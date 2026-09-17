export const pairKey = (a, b) => [a, b].sort().join("|");
export const IDOL_TYPES = [
  {
    id: "flame",
    name: "Idol της Φλόγας",
    effect: "Ακυρώνει όλες τις ψήφους εναντίον ενός παίκτη.",
    searchMethod: "ruins",
  },
  {
    id: "mirror",
    name: "Idol του Καθρέφτη",
    effect: "Επιστρέφει τις ψήφους στον ισχυρότερο αντίπαλο.",
    searchMethod: "dig",
  },
  {
    id: "storm",
    name: "Idol της Καταιγίδας",
    effect: "Σβήνει μία εχθρική ψήφο και χαρίζει μία δεύτερη ψήφο.",
    searchMethod: "fish",
  },
  {
    id: "twin",
    name: "Δίδυμο Idol των Δεσμών",
    effect: "Προστατεύει τον κάτοχο και τον πιο στενό του σύμμαχο.",
    searchMethod: "jungle",
  },
  {
    id: "oracle",
    name: "Idol του Χρησμού",
    effect: "Προβλέπει την αποχώρηση και δίνει κρυφή ασυλία στον κάτοχο.",
    searchMethod: "dive",
  },
];
const idolInfo = (type = "flame") =>
  IDOL_TYPES.find((x) => x.id === type) || IDOL_TYPES[0];
const pick = (items, score, rng) =>
  items
    .map((x) => ({ x, n: score(x) + rng() * 10 }))
    .sort((a, b) => b.n - a.n)[0]?.x;

export function createGame(
  players,
  tribes,
  bonds,
  idolOwner = null,
  alliances = [],
) {
  return {
    players: structuredClone(players).map((p) => ({
      ...p,
      out: false,
      wins: 0,
    })),
    tribes: structuredClone(tribes),
    bonds: structuredClone(bonds),
    cliques: structuredClone(alliances).map((c, i) => ({
      id: c.id || `clique-${i}`,
      name: c.name,
      members: [...c.members],
      active: true,
      createdEpisode: 1,
    })),
    episode: 1,
    stage: "challenge",
    merge: false,
    mergePending: false,
    returnDone: false,
    order: [],
    jury: [],
    history: [],
    winner: null,
    finalists: [],
    finalData: null,
    idols: idolOwner
      ? [
          {
            id: "idol-start",
            owner: idolOwner,
            used: false,
            foundEpisode: 0,
            type: "flame",
          },
        ]
      : [],
    idol: { owner: idolOwner, used: false },
    idolSerial: idolOwner ? 1 : 0,
    winnerTeamChoice: null,
    individualWinnerChoice: null,
    returnChoice: null,
  };
}

export function step(s, rng = Math.random) {
  s.cliques ||= [];
  s.idols ||=
    s.idol?.owner && !s.idol.used
      ? [
          {
            id: "idol-legacy",
            owner: s.idol.owner,
            used: false,
            foundEpisode: 0,
            type: "flame",
          },
        ]
      : [];
  s.idolSerial ||= s.idols.length;
  s.idols.forEach((idol) => (idol.type ||= "flame"));
  const alive = s.players.filter((p) => !p.out),
    get = (id) => s.players.find((p) => p.id === id),
    name = (id) => get(id)?.name || "";
  const bond = (a, b) =>
    (s.bonds[pairKey(a, b)] || 0) +
    s.cliques.filter(
      (c) => c.active && c.members.includes(a) && c.members.includes(b),
    ).length *
      6;
  const event = (title, text, ids = [], extra = {}) => {
    const e = {
      episode: s.episode,
      stage: s.stage,
      title,
      text,
      ids,
      ...extra,
    };
    s.history.push(e);
    return e;
  };
  const activateMerge = (returned = []) => {
    s.merge = true;
    s.mergePending = false;
    s.stage = "challenge";
    return event(
      "MERGE · Το ατομικό παιχνίδι αρχίζει",
      `${returned.length ? `${returned.map((p) => p.name).join(" και ")} επιστρέφουν. ` : ""}${s.players
        .filter((p) => !p.out)
        .map((p) => p.name)
        .join(
          ", ",
        )} έφτασαν στα ατομικά. Από τώρα κάθε ασυλία και κάθε ψήφος είναι προσωπική.`,
      s.players.filter((p) => !p.out).map((p) => p.id),
      { merge: true, returned: returned.map((p) => p.id), mergeCast: true },
    );
  };
  if (s.winner) return null;
  if (alive.length === 3) {
    const voters = s.order.map(get).filter(Boolean),
      votes = voters.map((v) => ({
        voter: v.id,
        target: pick(
          alive,
          (p) =>
            bond(v.id, p.id) + p.social * 1.1 + p.strategy * 0.7 + p.wins * 1.5,
            rng,
        ).id,
      })),
      makeTally = () =>
        alive
          .map((p) => ({
            id: p.id,
            n: votes.filter((v) => v.target === p.id).length,
          }))
          .sort(
            (a, b) =>
              b.n - a.n ||
              get(b.id).social + get(b.id).strategy * 0.35 -
                (get(a.id).social + get(a.id).strategy * 0.35),
          );
    let tally = makeTally(),
      third = tally[2],
      finalTwo = tally.slice(0, 2),
      tieBreaker = null;
    const tiedForWin = tally.filter((x) => x.n === tally[0].n);
    if (tiedForWin.length >= 2) {
      const contenders = tiedForWin.slice(0, 2);
      third = tally.find((x) => !contenders.some((c) => c.id === x.id)) || tally[2];
      const decidingPlayer = get(third.id),
        target = pick(
          contenders.map((x) => get(x.id)),
          (candidate) =>
            bond(decidingPlayer.id, candidate.id) +
            candidate.social * 1.15 +
            candidate.strategy * 0.55 +
            candidate.wins,
          rng,
        );
      votes.push({
        voter: decidingPlayer.id,
        target: target.id,
        tieBreaker: true,
      });
      tieBreaker = {
        voter: decidingPlayer.id,
        target: target.id,
        finalists: contenders.map((x) => x.id),
      };
      tally = makeTally();
      finalTwo = contenders
        .map((x) => tally.find((row) => row.id === x.id))
        .sort((a, b) => b.n - a.n);
    }
    const winner = get(finalTwo[0].id);
    s.winner = winner.id;
    s.finalists = alive.map((p) => p.id);
    s.stage = "final";
    s.finalData = {
      voters: voters.map((p) => p.id),
      votes,
      tally,
      third: third.id,
      finalTwo: finalTwo.map((x) => x.id),
      tieBreaker,
    };
    return event(
      "Ο ζωντανός τελικός",
      `${winner.name} κερδίζει το Spirit Island. Όλοι οι αποχωρήσαντες ψήφισαν τον νικητή.${tieBreaker ? ` Μετά την ισοψηφία, ο/η ${name(tieBreaker.voter)} έδωσε την καθοριστική ψήφο.` : ""}`,
      alive.map((p) => p.id),
      { final: true, votes, ...s.finalData },
    );
  }
  if (s.stage === "return") {
    const pool = s.order.map(get).filter((p) => p?.out),
      chosen = pool.find((p) => p.id === s.returnChoice);
    if (!chosen)
      return { requiresChoice: "return", candidates: pool.map((p) => p.id) };
    const rest = pool.filter((p) => p.id !== chosen.id),
      random = rest[Math.floor(rng() * rest.length)],
      returned = [chosen, random].filter(Boolean);
    returned.forEach((p) => {
      p.out = false;
      s.order = s.order.filter((id) => id !== p.id);
      s.jury = s.jury.filter((id) => id !== p.id);
    });
    s.returnChoice = null;
    s.returnDone = true;
    return activateMerge(returned);
  }
  if (s.stage === "challenge") {
    const challenges = [
        { type: "race", name: "Δρόμος της Ζούγκλας" },
        { type: "balance", name: "Γέφυρα της Ισορροπίας" },
        { type: "puzzle", name: "Παζλ των Αρχαίων Πνευμάτων" },
        { type: "endurance", name: "Στύλοι της Παλίρροιας" },
        { type: "memory", name: "Μνήμη των Κρυστάλλων" },
        { type: "totem", name: "Κυνήγι των Τοτέμ" },
        { type: "raft", name: "Σχεδία της Τρικυμίας" },
        { type: "archery", name: "Βέλη του Ορίζοντα" },
        { type: "climb", name: "Πύργος του Ανέμου" },
        { type: "maze", name: "Λαβύρινθος της Ζούγκλας" },
        { type: "spear", name: "Δόρατα στην Παλίρροια" },
        { type: "fire", name: "Ναός της Φωτιάς" },
      ],
      challenge = challenges[(s.episode - 1) % challenges.length];
    if (!s.merge) {
      const active = s.tribes.filter((t) =>
        alive.some((p) => p.tribe === t.id),
      );
      if (active.length <= 1 || alive.length <= 10) {
        if (!s.returnDone && s.order.length >= 2) {
          s.mergePending = true;
          s.stage = "return";
          return event(
            "Η τελευταία πύλη πριν από το Merge",
            `Το ομαδικό παιχνίδι ολοκληρώθηκε στους ${alive.length}. Δύο παίκτες θα επιστρέψουν και αμέσως μετά θα ανακοινωθεί το ατομικό cast.`,
            alive.map((p) => p.id),
            { twist: true, mergePending: true },
          );
        }
        return activateMerge();
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
        `${challenge.name} · Η ασυλία ανήκει στη ${winner.name}`,
        `${winner.name} κερδίζει τη δοκιμασία «${challenge.name}». Η σημαία της υψώνεται και η ομάδα δεν πηγαίνει στο Συμβούλιο.`,
        alive.filter((p) => p.tribe === winner.id).map((p) => p.id),
        {
          tribe: winner.id,
          immunityAnnouncement: true,
          challengeType: challenge.type,
          challengeName: challenge.name,
        },
      );
    }
    const selected = alive.find((p) => p.id === s.individualWinnerChoice),
      winner =
        selected ||
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
      `${challenge.name} · Ατομική ασυλία`,
      `${winner.name} κερδίζει τη δοκιμασία «${challenge.name}» και δεν μπορεί να αποχωρήσει απόψε.`,
      [winner.id],
      {
        immunityAnnouncement: true,
        challengeType: challenge.type,
        challengeName: challenge.name,
      },
    );
  }
  if (s.stage === "camp") {
    const activeIdols = s.idols.filter(
      (i) => !i.used && get(i.owner) && !get(i.owner).out,
    );
    const maxIdols = s.merge
      ? 2
      : Math.min(4, Math.max(2, s.tribes.length + 1));
    if (activeIdols.length < maxIdols && rng() < 0.3) {
      const searchers = alive.filter(
          (p) => !activeIdols.some((idol) => idol.owner === p.id),
        ),
        finder =
          searchers[Math.floor(rng() * searchers.length)] ||
          alive[Math.floor(rng() * alive.length)],
        type = IDOL_TYPES[Math.floor(rng() * IDOL_TYPES.length)],
        idol = {
          id: `idol-${++s.idolSerial}`,
          owner: finder.id,
          used: false,
          foundEpisode: s.episode,
          type: type.id,
        };
      s.idols.push(idol);
      s.idol = { owner: finder.id, used: false };
      s.stage = "council";
      return event(
        `${type.name} · Βρέθηκε!`,
        `${finder.name} ανακαλύπτει το ${type.name}. ${type.effect} Υπάρχουν ${activeIdols.length + 1} ενεργά Idols στο παιχνίδι.`,
        [finder.id],
        {
          idol: true,
          idolFound: idol.id,
          idolOwner: finder.id,
          idolType: type.id,
          idolName: type.name,
          idolEffect: type.effect,
          searchMethod: type.searchMethod,
        },
      );
    }
    const viable = s.cliques.filter(
      (c) => c.active && c.members.filter((id) => !get(id)?.out).length >= 2,
    );
    if (viable.length && rng() < 0.2) {
      const clique = viable[Math.floor(rng() * viable.length)];
      clique.active = false;
      clique.brokenEpisode = s.episode;
      s.stage = "council";
      const ids = clique.members.filter((id) => !get(id)?.out);
      return event(
        "Μια κλίκα διαλύεται",
        `Η κλίκα «${clique.name}» σπάει μετά από προδοσία.`,
        ids,
        {
          cliqueBroken: clique.id,
          dialogue: ids.slice(0, 2).map((id, i) => ({
            speakerId: id,
            speaker: name(id),
            text: i ? "Η συμφωνία τελείωσε." : "Κάποιος μας πρόδωσε.",
          })),
        },
      );
    }
    if (alive.length >= 4 && rng() < 0.18) {
      const members = [...alive].sort(() => rng() - 0.5).slice(0, 3),
        clique = {
          id: crypto.randomUUID(),
          name: `Κρυφό Σύμφωνο ${s.episode}`,
          members: members.map((p) => p.id),
          active: true,
          createdEpisode: s.episode,
        };
      s.cliques.push(clique);
      s.stage = "council";
      return event(
        "Νέα κλίκα γεννιέται",
        `${members.map((p) => p.name).join(", ")} δημιουργούν την κλίκα «${clique.name}».`,
        clique.members,
        {
          cliqueCreated: clique.id,
          dialogue: members.slice(0, 3).map((p, i) => ({
            speakerId: p.id,
            speaker: p.name,
            text:
              i === 0
                ? "Απόψε ξεκινά το σχέδιό μας. Θα μοιραζόμαστε πληροφορίες, όχι όλες τις ψήφους."
                : i === 1
                  ? "Το όνομά μας δεν θα ακουστεί. Αν αλλάξουν οι αριθμοί, θέλω να το ξέρω πρώτος."
                  : "Συμφωνώ, αλλά κρατάω ανοιχτή και μια δεύτερη διαδρομή.",
          })),
        },
      );
    }
    const councilPool = s.merge
        ? alive
        : alive.filter((p) => p.tribe !== s.safeTribe),
      socialPool =
        councilPool.length >= 2
          ? councilPool
          : [
              ...new Set(alive.map((p) => p.tribe)),
            ]
              .map((tribe) => alive.filter((p) => p.tribe === tribe))
              .sort((x, y) => y.length - x.length)[0],
      a = socialPool[Math.floor(rng() * socialPool.length)],
      possibleB = socialPool.filter(
        (p) => p.id !== a.id && (s.merge || p.tribe === a.tribe),
      ),
      b = possibleB[Math.floor(rng() * possibleB.length)],
      conflictKey = pairKey(a.id, b.id);
    if (
      alive.length > 4 &&
      rng() < 0.035 &&
      (s.bonds[conflictKey] || 0) <= 0
    ) {
      const attacker = a.strategy + a.competition >= b.strategy + b.competition ? a : b,
        target = attacker.id === a.id ? b : a,
        attackTypes = ["spirit-pistol", "magic-blast", "duel-strike"],
        attackType = attackTypes[Math.floor(rng() * attackTypes.length)],
        place = s.players.length - s.order.length;
      target.out = true;
      s.order.push(target.id);
      if (s.merge) s.jury.push(target.id);
      s.individualImmune = null;
      s.safeTribe = null;
      const result = event(
        "ΕΚΤΑΚΤΟ · Η σύγκρουση ξεφεύγει",
        attackType === "spirit-pistol"
          ? `${attacker.name} τραβά το καταραμένο όπλο των Πνευμάτων. Μια εκτυφλωτική βολή πετυχαίνει τον/την ${target.name}, που βγαίνει αμέσως από το παιχνίδι στη θέση ${place}.`
          : attackType === "magic-blast"
            ? `${attacker.name} εξαπολύει μια απαγορευμένη μαγική επίθεση. Ο/Η ${target.name} απομακρύνεται οριστικά από το νησί στη θέση ${place}.`
            : `${attacker.name} και ${target.name} οδηγούνται σε άγρια μονομαχία. Ο/Η ${target.name} χάνει και βγαίνει από το παιχνίδι στη θέση ${place}.`,
        [attacker.id, target.id],
        {
          attackElimination: true,
          attacker: attacker.id,
          target: target.id,
          attackType,
          evicted: target.id,
          evictedIds: [target.id],
          evictions: [{ id: target.id, place }],
          place,
          dialogue: [
            {
              speakerId: attacker.id,
              speaker: attacker.name,
              text: "Σου είπα να μη με προκαλέσεις. Αυτή η ιστορία τελειώνει τώρα.",
            },
            {
              speakerId: target.id,
              speaker: target.name,
              text: "Δεν θα με τρομάξεις. Κάνε ό,τι νομίζεις.",
            },
          ],
        },
      );
      s.stage = "challenge";
      s.episode++;
      return result;
    }
    const witness = alive
        .filter((p) => p.id !== a.id && p.id !== b.id)
        .sort((x, y) => y.strategy - x.strategy)[0],
      k = pairKey(a.id, b.id),
      delta = rng() > 0.42 ? 2 : -2;
    s.bonds[k] = Math.max(-10, Math.min(10, (s.bonds[k] || 0) + delta));
    s.stage = "council";
    return event(
      delta > 0 ? "Συμμαχία στην ακτή" : "Ρήγμα στην παραλία",
      delta > 0
        ? `${a.name} και ${b.name} δίνουν κρυφό όρκο.`
        : `${a.name} και ${b.name} συγκρούονται για την ψηφοφορία.`,
      [a.id, b.id],
      {
        dialogue: [
          {
            speakerId: a.id,
            speaker: a.name,
            text: delta > 0 ? "Μέχρι το τέλος μαζί." : "Δεν σε εμπιστεύομαι.",
          },
          {
            speakerId: b.id,
            speaker: b.name,
            text:
              delta > 0 ? "Κανείς δεν θα το μάθει." : "Θα γράψω το όνομά σου.",
          },
          witness && {
            speakerId: witness.id,
            speaker: witness.name,
            text:
              delta > 0
                ? `Τους είδα να απομακρύνονται μαζί. Αν οι ${a.name} και ${b.name} ενώθηκαν, πρέπει να αλλάξω το δικό μου πλάνο.`
                : `Η σύγκρουση των ${a.name} και ${b.name} ανοίγει χώρο για μια νέα πλειοψηφία.`,
          },
        ].filter(Boolean),
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
    const rank = () =>
      vulnerable
        .map((p) => ({
          id: p.id,
          n: votes.filter((v) => v.target === p.id).length,
        }))
        .sort((a, b) => b.n - a.n || rng() - 0.5);
    let out = rank()[0].id;
    const idolPlays = [],
      nullified = new Set();
    for (const idol of s.idols.filter((x) => !x.used)) {
      const holder = get(idol.owner);
      if (
        !holder ||
        holder.out ||
        !voters.some((v) => v.id === holder.id) ||
        nullified.has(out)
      )
        continue;
      const info = idolInfo(idol.type),
        holderVotes = votes.filter((v) => v.target === holder.id).length,
        maxVotes = rank()[0]?.n || 0,
        shouldPlay =
          out === holder.id ||
          bond(holder.id, out) >= 6 ||
          (idol.type === "storm" && holderVotes >= Math.max(1, maxVotes - 1));
      if (shouldPlay) {
        const saved = out;
        idol.used = true;
        idol.playedEpisode = s.episode;
        idol.saved = saved;
        let redirectedTo = null;
        if (idol.type === "mirror") {
          redirectedTo = rank().find((x) => x.id !== saved && x.id !== holder.id)?.id;
          if (redirectedTo)
            votes.forEach((vote) => {
              if (vote.target === saved) vote.target = redirectedTo;
            });
        } else if (idol.type === "storm") {
          const hostile = votes.findIndex((v) => v.target === holder.id);
          if (hostile >= 0) votes.splice(hostile, 1);
          redirectedTo = rank().find((x) => x.id !== holder.id)?.id;
          if (redirectedTo) votes.push({ voter: holder.id, target: redirectedTo, bonus: true });
        } else {
          nullified.add(saved);
          if (idol.type === "twin") {
            const ally = vulnerable
              .filter((p) => p.id !== holder.id && p.id !== saved)
              .sort((a, b) => bond(holder.id, b.id) - bond(holder.id, a.id))[0];
            if (ally && bond(holder.id, ally.id) > 0) nullified.add(ally.id);
          }
        }
        idolPlays.push({
          idol: idol.id,
          type: idol.type,
          name: info.name,
          effect: info.effect,
          actor: holder.id,
          saved,
          redirectedTo,
          protected: [...nullified],
        });
        out = rank().find((x) => !nullified.has(x.id))?.id || out;
      }
    }
    const idolPlayed = idolPlays[0]?.actor || null,
      idolSaved = idolPlays[0]?.saved || null;
    s.idol = {
      owner: s.idols.find((x) => !x.used)?.owner || null,
      used: !s.idols.some((x) => !x.used),
    };
    const leadingVote = votes.find((v) => v.target === out),
      accuser = get(leadingVote?.voter) || voters[0],
      target = get(out),
      observer = voters
        .filter((p) => p.id !== accuser?.id && p.id !== target?.id)
        .sort((a, b) => b.strategy + b.social - (a.strategy + a.social))[0],
      councilDialogue = [
        accuser && {
          speakerId: accuser.id,
          speaker: accuser.name,
          text:
            accuser.strategy >= 7
              ? "Οι αριθμοί άλλαξαν σήμερα. Κάποιος που νιώθει ασφαλής δεν είναι."
              : accuser.social >= 7
                ? "Άκουσα πολλές υποσχέσεις, αλλά απόψε μετράει ποιος τις κράτησε."
                : "Στο νησί επιβιώνεις μόνο όταν παίρνεις δύσκολες αποφάσεις.",
        },
        target && {
          speakerId: target.id,
          speaker: target.name,
          text:
            target.strategy >= 7
              ? "Αν το σχέδιο είναι εναντίον μου, ίσως δεν γνωρίζετε ολόκληρο το σχέδιο."
              : target.social >= 7
                ? "Οι σχέσεις μου είναι αληθινές. Απόψε θα μάθω αν ήταν και αμοιβαίες."
                : "Δεν ήρθα μέχρι εδώ για να παραδώσω τη φλόγα μου χωρίς μάχη.",
        },
        observer && {
          speakerId: observer.id,
          speaker: observer.name,
          text: s.cliques.some(
            (c) =>
              c.active &&
              c.members.includes(observer.id) &&
              c.members.includes(out),
          )
            ? "Μερικές συμμαχίες φαίνονται δυνατές μέχρι τη στιγμή που δοκιμάζονται."
            : "Η σιωπή απόψε λέει περισσότερα από τις κουβέντες στην παραλία.",
        },
      ].filter(Boolean);
    const eligibleRank = rank().filter((x) => !nullified.has(x.id)),
      topVotes = eligibleRank[0]?.n || 0,
      tied = eligibleRank.filter((x) => x.n === topVotes).slice(0, 2),
      evictedIds = [],
      tieResolution = tied.length > 1 ? { contestants: tied.map((x) => x.id) } : null;
    if (tieResolution) {
      const fate = rng();
      if (fate < 0.8) {
        const survivor = pick(
          tied.map((x) => get(x.id)),
          (p) => p.competition * 1.25 + p.strategy * 0.75,
          rng,
        );
        out = tied.find((x) => x.id !== survivor.id).id;
        evictedIds.push(out);
        Object.assign(tieResolution, {
          type: "duel",
          survivor: survivor.id,
          evicted: out,
          title: "Μονομαχία της Φωτιάς",
        });
      } else if (fate < 0.9 && alive.length > 4) {
        evictedIds.push(...tied.map((x) => x.id));
        out = evictedIds[0];
        Object.assign(tieResolution, {
          type: "doubleOut",
          evicted: [...evictedIds],
          title: "Διπλή αποχώρηση",
        });
      } else if (fate >= 0.9) {
        out = null;
        Object.assign(tieResolution, {
          type: "bothStay",
          title: "Το Νησί τους κρατά και τους δύο",
        });
      } else {
        const survivor = pick(
          tied.map((x) => get(x.id)),
          (p) => p.competition * 1.25 + p.strategy * 0.75,
          rng,
        );
        out = tied.find((x) => x.id !== survivor.id).id;
        evictedIds.push(out);
        Object.assign(tieResolution, {
          type: "duel",
          survivor: survivor.id,
          evicted: out,
          title: "Μονομαχία της Φωτιάς",
        });
      }
    } else if (out) evictedIds.push(out);
    const evictions = evictedIds.map((id) => {
      const leaving = get(id),
        place = s.players.length - s.order.length,
        angryChance = Math.min(
          0.48,
          0.1 + Math.max(0, 6 - leaving.social) * 0.045 + Math.max(0, leaving.strategy - 7) * 0.035,
        ),
        angry = rng() < angryChance,
        angryLines = [
          "Αυτό το καταραμένο νησί δεν αξίζει κανέναν σας!",
          "Να πάτε όλοι στον διάβολο — θα τα πούμε έξω!",
          "****! Νομίζετε ότι τελείωσε; Τώρα αρχίζει το χάος!",
          "Κρατήστε τις ψεύτικες υποσχέσεις σας. Εγώ φεύγω όρθιος!",
        ];
      leaving.out = true;
      s.order.push(id);
      if (s.merge) s.jury.push(id);
      return {
        id,
        place,
        angry,
        exitLine: angry ? angryLines[Math.floor(rng() * angryLines.length)] : null,
      };
    });
    const voteTally = vulnerable
        .map((p) => ({
          id: p.id,
          n: nullified.has(p.id)
            ? 0
            : votes.filter((v) => v.target === p.id).length,
        }))
        .sort((a, b) => b.n - a.n || rng() - 0.5),
      dangerIds = tieResolution?.contestants?.length
        ? [...tieResolution.contestants]
        : voteTally.slice(0, 2).map((row) => row.id),
      safeOrder = [...voteTally]
        .sort((a, b) => a.n - b.n)
        .filter(
          (row) =>
            !evictedIds.includes(row.id) &&
            !dangerIds.includes(row.id),
        )
        .map((row) => row.id),
      place = evictions[0]?.place || null;
    s.individualImmune = null;
    s.safeTribe = null;
    s.stage = "challenge";
    const result = event(
      "Συμβούλιο του Νησιού",
      evictions.length
        ? `${evictions.map((x) => `${name(x.id)} — Θέση ${x.place}`).join(" και ")}. ${tieResolution ? tieResolution.title + ". " : ""}${idolPlays.length ? `Παίχτηκαν ${idolPlays.length} διαφορετικά Idol.` : ""}`
        : `${tieResolution?.title}. Η ψηφοφορία ολοκληρώνεται χωρίς αποχώρηση.`,
      [...new Set([...safeOrder, ...dangerIds])],
      {
        council: true,
        evicted: evictedIds[0] || null,
        evictedIds,
        evictions,
        safeOrder,
        dangerIds,
        place,
        idolPlayed,
        idolSaved,
        idolPlays,
        councilDialogue,
        tieResolution,
        votes,
        voteTally,
      },
    );
    s.episode++;
    return result;
  }
}
