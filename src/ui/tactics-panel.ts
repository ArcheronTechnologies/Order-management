import {
  DEFAULT_TACTICS,
  PRESETS,
  ATTACK_FORMATIONS,
  DEFENSIVE_SYSTEMS,
  FORMATION_BLURB,
  SYSTEM_BLURB,
  LINEOUT_CALLS,
  SCRUM_CALLS,
  KICKOFF_CALLS,
  OPPOSITION_PLANS,
  type TeamTactics,
  type AttackFormation,
  type DefensiveSystem,
} from "../engine/tactics";

const SLIDERS: { key: keyof TeamTactics; label: string; lo: string; hi: string }[] = [
  { key: "defensiveLineSpeed", label: "Defensive line speed", lo: "Sit back", hi: "Rush up" },
  { key: "defensiveAggression", label: "Breakdown aggression", lo: "Safe", hi: "Jackal" },
  { key: "attackingWidth", label: "Attacking width", lo: "Narrow", hi: "Wide" },
  { key: "kickingTendency", label: "Kicking game", lo: "Ball in hand", hi: "Kick" },
  { key: "tempo", label: "Tempo", lo: "Control", hi: "Fast" },
  { key: "ruckCommitment", label: "Ruck commitment", lo: "Spread", hi: "Secure" },
  { key: "setPieceFocus", label: "Set-piece focus", lo: "Off the top", hi: "Drive/maul" },
];

const $ = (id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
};

export interface TacticsPanel {
  tactics: () => TeamTactics;
  setTeamName: (name: string) => void;
  open: () => void;
  close: () => void;
}

/**
 * Builds the FM-style tactics drawer and manages the user's tactics. `onChange`
 * fires (with the full tactics object) whenever the user changes anything, so
 * the live match can apply it.
 */
export function createTacticsPanel(onChange: (t: TeamTactics) => void): TacticsPanel {
  const state: TeamTactics = { ...DEFAULT_TACTICS };

  const drawer = $("tacticsDrawer");
  const teamLabel = $("tacticsTeam");
  const presetSel = $("presetSel") as HTMLSelectElement;
  const formationBtns = $("formationBtns");
  const formationBlurb = $("formationBlurb");
  const systemBtns = $("systemBtns");
  const systemBlurb = $("systemBlurb");
  const slidersEl = $("sliders");

  // --- presets ---
  presetSel.innerHTML = `<option value="">Custom…</option>` +
    PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");
  presetSel.addEventListener("change", () => {
    const i = Number(presetSel.value);
    if (presetSel.value !== "" && PRESETS[i]) {
      Object.assign(state, PRESETS[i].tactics);
      render();
      emit();
    }
  });

  // --- formation buttons ---
  ATTACK_FORMATIONS.forEach((f) => {
    const b = document.createElement("button");
    b.textContent = f;
    b.dataset.formation = f;
    b.addEventListener("click", () => {
      state.attackFormation = f as AttackFormation;
      presetSel.value = "";
      render();
      emit();
    });
    formationBtns.appendChild(b);
  });

  // --- defensive system buttons ---
  DEFENSIVE_SYSTEMS.forEach((s) => {
    const b = document.createElement("button");
    b.textContent = s[0].toUpperCase() + s.slice(1);
    b.dataset.system = s;
    b.addEventListener("click", () => {
      state.defensiveSystem = s as DefensiveSystem;
      presetSel.value = "";
      render();
      emit();
    });
    systemBtns.appendChild(b);
  });

  // --- sliders ---
  const sliderInputs = new Map<keyof TeamTactics, HTMLInputElement>();
  for (const s of SLIDERS) {
    const wrap = document.createElement("div");
    wrap.className = "slider";
    const head = document.createElement("div");
    head.className = "slider-head";
    head.innerHTML = `<span>${s.label}</span><span class="val"></span>`;
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.addEventListener("input", () => {
      (state[s.key] as number) = Number(input.value);
      presetSel.value = "";
      (head.querySelector(".val") as HTMLElement).textContent = input.value;
      emit();
    });
    const ends = document.createElement("div");
    ends.className = "slider-ends";
    ends.innerHTML = `<span>${s.lo}</span><span>${s.hi}</span>`;
    wrap.append(head, input, ends);
    slidersEl.appendChild(wrap);
    sliderInputs.set(s.key, input);
  }

  // --- set-piece calls ---
  const setPieceEl = $("setPieceCalls");
  const callGroups: { key: keyof TeamTactics; title: string; opts: { v: string; label: string; blurb: string }[] }[] = [
    { key: "lineoutThrow", title: "Lineout", opts: LINEOUT_CALLS },
    { key: "scrumCall", title: "Scrum", opts: SCRUM_CALLS },
    { key: "kickoffCall", title: "Restart", opts: KICKOFF_CALLS },
  ];
  for (const g of callGroups) {
    const wrap = document.createElement("div");
    wrap.className = "callgroup";
    const row = document.createElement("div");
    row.className = "btnrow";
    g.opts.forEach((o) => {
      const b = document.createElement("button");
      b.textContent = o.label;
      b.dataset.call = `${String(g.key)}:${o.v}`;
      b.title = o.blurb;
      b.addEventListener("click", () => {
        (state[g.key] as string) = o.v;
        presetSel.value = "";
        render();
        emit();
      });
      row.appendChild(b);
    });
    const head = document.createElement("div");
    head.className = "callgroup-head";
    head.textContent = g.title;
    wrap.append(head, row);
    setPieceEl.appendChild(wrap);
  }

  // --- opposition plan ---
  const oppEl = $("oppositionPlan");
  const oppBlurb = $("oppositionBlurb");
  OPPOSITION_PLANS.forEach((o) => {
    const b = document.createElement("button");
    b.textContent = o.label;
    b.dataset.opp = o.v;
    b.title = o.blurb;
    b.addEventListener("click", () => {
      state.oppositionPlan = o.v;
      presetSel.value = "";
      render();
      emit();
    });
    oppEl.appendChild(b);
  });

  function render() {
    const oppCur = state.oppositionPlan ?? "none";
    oppEl.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      b.classList.toggle("active", (b.dataset.opp ?? "") === oppCur);
    });
    oppBlurb.textContent = OPPOSITION_PLANS.find((o) => o.v === oppCur)?.blurb ?? "";
    setPieceEl.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      const [key, v] = (b.dataset.call ?? "").split(":");
      b.classList.toggle("active", (state[key as keyof TeamTactics] ?? "") === v);
    });
    formationBtns.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", (b as HTMLElement).dataset.formation === state.attackFormation);
    });
    formationBlurb.textContent = FORMATION_BLURB[state.attackFormation];
    systemBtns.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", (b as HTMLElement).dataset.system === state.defensiveSystem);
    });
    systemBlurb.textContent = SYSTEM_BLURB[state.defensiveSystem];
    for (const s of SLIDERS) {
      const input = sliderInputs.get(s.key)!;
      input.value = String(state[s.key]);
      const val = input.parentElement!.querySelector(".val") as HTMLElement;
      val.textContent = String(state[s.key]);
    }
  }

  function emit() {
    onChange({ ...state });
  }

  const open = () => drawer.classList.remove("hidden");
  const close = () => drawer.classList.add("hidden");
  $("tacticsClose").addEventListener("click", close);
  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) close();
  });

  render();

  return {
    tactics: () => ({ ...state }),
    setTeamName: (name) => (teamLabel.textContent = name),
    open,
    close,
  };
}
