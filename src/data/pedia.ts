/** Static glossary content for the RugbyPedia view — grouped reference entries. */
export interface PediaEntry {
  term: string;
  def: string;
}
export interface PediaSection {
  title: string;
  entries: PediaEntry[];
}

export const PEDIA: PediaSection[] = [
  {
    title: "Positions",
    entries: [
      { term: "Prop (LHP / THP, 1 & 3)", def: "Front-row forwards. The engine of the scrum — strength and scrummaging matter most." },
      { term: "Hooker (HK, 2)", def: "Throws into the lineout and hooks the ball at the scrum. Needs accurate throwing." },
      { term: "Lock (LK, 4 & 5)", def: "Second-row enforcers and the primary lineout jumpers. Height, lineoutJump, strength." },
      { term: "Flanker (BSF / OSF, 6 & 7)", def: "Back-row workers. The openside (7) hunts turnovers at the breakdown; the blindside (6) does the hard yards." },
      { term: "Number 8 (N8)", def: "Back-row ball-carrier at the base of the scrum. Power and handling to link play." },
      { term: "Scrum-half (SH, 9)", def: "Links forwards and backs, clears the ruck, box-kicks. Quick, sharp decisions." },
      { term: "Fly-half (FH, 10)", def: "The playmaker — runs the attack, kicks for goal and territory. Decision-making and kicking." },
      { term: "Centres (IC / OC, 12 & 13)", def: "Midfield. The inside centre often crashes it up; the outside centre is a strike runner." },
      { term: "Back three (LW / RW / FB, 11, 14, 15)", def: "Wings and full-back — finishers and counter-attackers. Pace and handling under the high ball." },
    ],
  },
  {
    title: "Attributes",
    entries: [
      { term: "Pace", def: "Top running speed — beats the cover, finishes breaks." },
      { term: "Strength", def: "Winning the collision, breaking tackles, the scrum shove." },
      { term: "Stamina", def: "Resists fatigue so a player holds his level for 80 minutes." },
      { term: "Handling", def: "Passing and catching — fewer knock-ons under pressure." },
      { term: "Tackling", def: "Tackle completion — bringing the carrier down cleanly." },
      { term: "Kicking", def: "Distance and goal accuracy off the tee and out of hand." },
      { term: "Decision-making", def: "Picking the right pass, kick or run — the shrewd option." },
      { term: "Positioning", def: "Defensive reading, covering and support lines." },
      { term: "Discipline", def: "Staying onside and legal — fewer penalties conceded." },
      { term: "Scrummaging / Lineout jump / Throwing", def: "The set-piece specialisms for the front five and hooker." },
    ],
  },
  {
    title: "Tactics",
    entries: [
      { term: "Defensive line speed", def: "How fast the line comes off its mark — rush up to pressure, or sit back and stay organised." },
      { term: "Breakdown aggression", def: "How hard you contest the ruck — more turnovers, but more penalties." },
      { term: "Attacking width", def: "Narrow forward bash versus stretching the defence out to the touchline." },
      { term: "Kicking game", def: "Ball in hand versus kicking for territory and field position." },
      { term: "Tempo", def: "Slow and controlled versus fast ruck ball and high pace." },
      { term: "Drift / Blitz / Umbrella", def: "Defensive systems: push to the touch (drift), fly off the line (blitz), or rush midfield while hanging back on the edges (umbrella)." },
      { term: "Opposition plan", def: "A focus aimed at the foe — rush their 10, shut the channels, contest their kicks, or target their set piece." },
    ],
  },
  {
    title: "Player duties",
    entries: [
      { term: "Playmaker (FH)", def: "Calms the attack and looks after the ball — fewer handling errors." },
      { term: "Fetcher (openside)", def: "A breakdown specialist — wins more turnovers at the ruck." },
      { term: "Ball-carrier / Crash-ball", def: "Takes it into contact hard — breaks more tackles (crash-ball runs tighter)." },
      { term: "Distributor", def: "Looks for the wider gap and keeps the ball moving." },
      { term: "Enforcer", def: "A tight-five grunt who does the physical donkey work." },
    ],
  },
  {
    title: "Set-piece calls",
    entries: [
      { term: "Lineout: full vs short", def: "A full line offers more options but can be contested; a short line is safer ball with fewer plays." },
      { term: "Scrum: steady / channel one / pushover", def: "Win it cleanly, get fast ball off the base, or shove for the line near it." },
      { term: "Restart: long vs contest", def: "Kick deep and concede possession for territory, or go short and chase to win it back." },
      { term: "Maul", def: "A catch-and-drive from the lineout — slow, powerful, a try threat near the line." },
      { term: "Bonus points", def: "League points for scoring four-plus tries, or losing by seven or fewer." },
    ],
  },
];
