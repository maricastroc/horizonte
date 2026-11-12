import type { CompareAxis, Finding, Question } from "../anatomy";
import type { AnatomyWriter, Phrasing } from "./types";

type Of<P extends Finding["part"]> = Extract<Finding, { part: P }>;

const COUNT = ["no", "one", "two", "three", "four"];
const count = (n: number) => COUNT[n] ?? String(n);
const bodies = (n: number) => `${count(n)} small ${n === 1 ? "body" : "bodies"}`;
const when = (on: boolean, text: string) => (on ? text : "");
const mins = (n: number) => (n === 1 ? "1 minute" : `${n} minutes`);

const NEAR: Record<Exclude<Finding["part"], "satellites">, { ask: string; answer: string }> = {
  gaps: {
    ask: "What opens breaks in the ring?",
    answer:
      "How much the tracks differ in rhythm. Each sector of the ring is a track, and the breaks " +
      "widen when some tracks keep a steady beat and others don't; here the difference is " +
      "typical of the collection.",
  },
  strata: {
    ask: "What would split the ring into layers?",
    answer:
      "A regular rhythm. When the notes land on a repeating grid, the ring splits into layers, " +
      "further apart the steadier the grid; this record's rhythm is as regular as a typical one.",
  },
  contour: {
    ask: "What carves its edge?",
    answer:
      "The gap between calm and intense passages. The edge follows intensity across the record, " +
      "pushing out where the music swells; here that gap is typical of the collection, and so " +
      "are the cuts.",
  },
  posture: {
    ask: "What sets the shape's tilt?",
    answer:
      "Brightness: how much of the sound's energy sits in the treble. More treble turns the " +
      "shape toward you, round like the dashed line; less lays it down. This record's " +
      "brightness is typical of the collection, and so is its tilt.",
  },
  core: {
    ask: "What sets the size of its dark center?",
    answer:
      "How loud the record plays. In Horizonte, loudness is mass: louder records get a bigger " +
      "body and a center that narrows the ring; quieter ones, the reverse. This one sits in the " +
      "middle of the collection.",
  },
};

function satellites(f: Of<"satellites">): Phrasing {
  const { bodies: n, after, minutes: min, high } = f;
  const d = Math.abs(after - n);
  const ask =
    n === 0
      ? "Why is this shape alone?"
      : n === 1
        ? "Where does the small body beside it come from?"
        : `Where do the ${count(n)} small bodies come from?`;
  const come = n === 1 ? "It comes from its length." : "They come from its length.";
  const each =
    "Horizonte shows time as small bodies around the shape, one more for each added stretch";
  const answer = f.near
    ? `${n === 0 ? "It's down to its length." : come} At ${min} minutes, close to the ` +
      `collection's typical length, this record has ${n === 0 ? "none" : count(n)}: ${each}.`
    : n === 0
      ? `Because the record is short: ${min} minutes${when(f.bottom, ", the shortest here")}. ` +
        "Horizonte shows time as small bodies that gather around the shape as a record grows " +
        "longer, and this one ends before the first appears."
      : high
        ? `${come} At ${min} minutes, ${f.top ? "the longest record here" : "longer than most here"}, ` +
          "it doesn't get a bigger shape: each added stretch of time becomes a small body around it."
        : `${come} At ${min} minutes, shorter than most here, this record earns just ` +
          `${n === 1 ? "one" : count(n)}: ${each}.`;
  const extra = mins(Math.abs(f.extra));
  const change =
    after < n
      ? (d === n
          ? n === 1
            ? "the small body disappears."
            : "the small bodies disappear."
          : after === 1
            ? "one small body remains."
            : `${count(after)} small bodies remain.`) +
        ` ${d === 1 ? "The one that goes stood" : "The ones that go stood"} for this record's ` +
        `extra ${extra}.`
      : after > n
        ? (n === 0
            ? d === 1
              ? "a small body appears beside it."
              : `${bodies(d)} appear around it.`
            : d === 1
              ? "one more small body appears."
              : `${count(d)} more appear.`) +
          ` ${d === 1 ? "It stands" : "They stand"} for the ${extra} this record ` +
          "doesn't have."
        : n === 0
          ? "it stays alone."
          : n === 1
            ? `its small body stays, a little ${high ? "smaller" : "larger"}.`
            : `its ${bodies(n)} stay, a little ${high ? "smaller" : "larger"}.`;
  return {
    ask,
    answer,
    what: f.near ? null : high ? "What if the record were shorter?" : "What if the record were longer?",
    label: high ? "Shorter" : "Longer",
    result: `At ${f.usual} minutes, the collection's typical length, ${change}`,
  };
}

function gaps(f: Of<"gaps">): Phrasing {
  const { high, top, bottom } = f;
  const ask = f.open
    ? "Why is the ring broken apart?"
    : high
      ? "Why does the ring have breaks?"
      : "Why is the ring almost unbroken?";
  const answer = f.open
    ? "Some tracks on this record keep a steady beat; others move without one. Each " +
      "sector of the ring is a track, and the more the tracks differ in this way, the wider the " +
      "breaks open, all of them equally, around the whole ring" +
      `${when(top, ". No record here has tracks this different")}.`
    : high
      ? "Some tracks on this record keep a steadier rhythm than others. Each sector of the ring is " +
        "a track, and that difference opens breaks between all of them; here they are a little " +
        "wider than typical, though still narrow."
      : "The tracks on this record share a similar rhythm. Each sector of the ring is a track, and " +
        "breaks only open when tracks differ in rhythm, so here there is little to separate" +
        `${when(bottom, ". No record here has tracks this alike")}.`;
  return {
    ask,
    answer,
    what: high
      ? "What if its tracks were alike in rhythm?"
      : "What if its tracks varied more in rhythm?",
    label: high ? "Alike in rhythm" : "More varied",
    result: high
      ? "With tracks as alike in rhythm as a typical record's, the breaks narrow all around the ring."
      : "With tracks as varied in rhythm as a typical record's, the breaks widen all around the ring.",
  };
}

function strata(f: Of<"strata">): Phrasing {
  const { high, top, bottom } = f;
  const draw =
    "Horizonte draws that regularity as parallel rings: the more regular the rhythm, the " +
    "further apart they sit";
  const ask =
    f.beat === "steady"
      ? "Why does the ring have layers?"
      : f.beat === "none"
        ? "Why does the ring have no layers?"
        : high
          ? "Why does the ring split into layers?"
          : "Why are the ring's layers so faint?";
  const answer =
    f.beat === "steady"
      ? "The notes on this record land on a steady grid, like a pulse that repeats from start to " +
        `end. ${draw}${when(top, ". No record here is as regular")}.`
      : f.beat === "none"
        ? "The sounds on this record arrive without a repeating beat, free of any grid. The ring " +
          "only splits into layers when a rhythm is regular" +
          `${when(bottom, ". No record here moves as freely")}.`
        : high
          ? "The notes on this record fall on a fairly steady grid, more than on most records " +
            `here. ${draw}.`
          : "This record's rhythm has some regularity, but not much. The layers are there, " +
            "pressed together; they only pull apart as a rhythm grows steadier.";
  return {
    ask,
    answer,
    what: high ? "What if the rhythm were less regular?" : "What if the rhythm were more regular?",
    label: high ? "Less regular" : "More regular",
    result: high
      ? "With a rhythm as regular as a typical record's, the layers draw closer together."
      : f.beat === "none"
        ? "With a rhythm as regular as a typical record's, the ring splits into layers, still " +
          "close together."
        : "With a rhythm as regular as a typical record's, the layers pull apart and sharpen.",
  };
}

function contour(f: Of<"contour">): Phrasing {
  const { high, strong, top, bottom } = f;
  const ask = high
    ? strong
      ? "Why is its edge so jagged?"
      : "Why is its edge carved?"
    : strong
      ? "Why is its edge so smooth?"
      : "Why is its edge nearly smooth?";
  const follow =
    "The ring runs through the record from start to end, and the edge follows that swing: it " +
    "pushes out where the music swells and pulls in where it settles.";
  const answer = high
    ? strong
      ? `This record swings from very calm passages to very intense ones. ${follow} The bigger ` +
        `the gap between calm and intense, the deeper the cut${when(top, ", and no record here has a bigger one")}.`
      : `This record moves between calm and intense passages more than most here. ${follow}`
    : strong
      ? "This record's intensity barely changes: its calmest and most intense passages sit close " +
        "together. The edge follows that intensity across the record, so it hardly moves" +
        `${when(bottom, "; no record here varies less")}.`
      : "This record's intensity varies less than most here. The edge follows that intensity " +
        "across the record, so its cuts stay shallow.";
  return {
    ask,
    answer,
    what: high ? "What if its volume varied less?" : "What if its volume varied more?",
    label: high ? "Less contrast" : "More contrast",
    result: high
      ? "With calm and intense passages as close as in a typical record, the cuts grow shallower " +
        "but stay where they are."
      : "With calm and intense passages as far apart as in a typical record, the cuts deepen in " +
        "the same places.",
  };
}

const FACING = " The dashed line shows it face-on.";

function posture(f: Of<"posture">): Phrasing {
  const { high, strong, top, bottom } = f;
  const ask = high
    ? strong
      ? "Why does the shape look so open?"
      : "Why does the shape look open?"
    : strong
      ? "Why is the shape so flat?"
      : "Why is the shape flattened?";
  const answer = high
    ? strong
      ? "Much of this music's energy sits in the treble, which is what makes it sound bright. " +
        "Horizonte turns the shape toward you by that brightness: the more treble, the more it " +
        `faces you, almost round${when(top, ". No record here is brighter")}.`
      : "This music carries more treble than most here, so it sounds a little brighter. " +
        "Horizonte turns the shape toward you by that brightness, and it shows a rounder face."
    : strong
      ? "Nearly all of this music's energy sits in the low end, with little treble on top: it " +
        "sounds dark. To show that, Horizonte lays the shape down, flattened, as if seen from " +
        `the side${when(bottom, ". No record here is darker")}.`
      : "This music carries less treble than most here, so it sounds a little dark. To show " +
        "that, Horizonte tilts the shape back, and it flattens.";
  return {
    ask,
    answer: answer + FACING,
    what: high ? "What if it had less treble?" : "What if it had more treble?",
    label: high ? "Less treble" : "More treble",
    result: high
      ? "With a typical record's treble, the shape tips back and flattens, away from the " +
        "dashed line."
      : "With a typical record's treble, the shape lifts and rounds out, toward the dashed line.",
  };
}

function core(f: Of<"core">): Phrasing {
  const { high, strong, top, bottom } = f;
  const ask = high
    ? strong
      ? "Why is its dark center so large?"
      : "Why is its dark center large?"
    : strong
      ? "Why is its dark center so small?"
      : "Why is its dark center small?";
  const answer = high
    ? strong
      ? "This record plays loud from start to end. In Horizonte, loudness is mass: the louder " +
        "the record, the bigger the body and its dark center, which takes over the ring around " +
        `it${when(top, ". No record here is louder")}.`
      : "This record plays louder than most here. In Horizonte, loudness is mass, so the body " +
        "grows and the dark center presses into the ring."
    : strong
      ? "This record plays quietly from start to end. In Horizonte, loudness is mass: with " +
        "little of it, the body shrinks and the dark center leaves a wide ring around it" +
        `${when(bottom, ". No record here is quieter")}.`
      : "This record plays a little quieter than most here. In Horizonte, loudness is mass, so " +
        "the body stays smaller and the ring keeps more room.";
  return {
    ask,
    answer,
    what: high ? "What if it were quieter overall?" : "What if it were louder overall?",
    label: high ? "Quieter" : "Louder",
    result: high
      ? "At a typical record's loudness, the whole body shrinks and the dark center gives room " +
        "back to the ring."
      : "At a typical record's loudness, the whole body grows and the dark center presses into " +
        "the ring.",
  };
}

function phrase(q: Question): Phrasing {
  const f = q.finding;
  if (f.part === "satellites") return satellites(f);
  if (f.near) return { ...NEAR[f.part], what: null, label: "", result: "" };
  if (f.part === "gaps") return gaps(f);
  if (f.part === "strata") return strata(f);
  if (f.part === "contour") return contour(f);
  if (f.part === "posture") return posture(f);
  return core(f);
}

const EXTREMES: Record<CompareAxis, [string, string]> = {
  duration: ["longest", "shortest"],
  spread: ["most uneven", "most even"],
  pulse: ["most regular", "least regular"],
  dynamics: ["highest contrast", "lowest contrast"],
  brightness: ["brightest", "darkest"],
  loudness: ["loudest", "quietest"],
};

const ordinal = (n: number) => {
  const tens = n % 100;
  const unit = n % 10;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${unit === 1 ? "st" : unit === 2 ? "nd" : unit === 3 ? "rd" : "th"}`;
};

export const ANATOMY_EN: AnatomyWriter = {
  phrase,
  measure: {
    duration: "Length",
    spread: "Rhythm difference between tracks",
    pulse: "Rhythmic regularity",
    dynamics: "Contrast",
    brightness: "Brightness",
    loudness: "Average loudness",
  },
  shown(axis, v) {
    if (axis === "duration") return `${Math.round(v / 60)} min`;
    if (axis === "dynamics") return `${v.toFixed(1)} dB range`;
    if (axis === "brightness") return `${Math.round(v)} Hz`;
    if (axis === "loudness") return `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} dB`;
    return v.toFixed(2);
  },
  standing({ axis, rank, of }) {
    const [high, low] = EXTREMES[axis];
    if (rank === 1) return `${high} of ${of}`;
    if (rank === of) return `${low} of ${of}`;
    return `${ordinal(rank)} ${high} of ${of}`;
  },
  drawn: {
    satellites: "small bodies around the ring",
    gaps: "breaks between the sectors",
    strata: "layers in the ring",
    contour: "relief of the edge",
    posture: "tilt of the shape",
    core: "size of the body and its dark center",
  },
  details(q) {
    const f = q.finding;
    if (f.part === "satellites") {
      return [["Bodies appear at", `${f.onsets.map(Math.round).join(" · ")} min`]];
    }
    if (f.part === "core") return [["Name weight", String(f.nameWeight)]];
    return [];
  },
  depth(q) {
    if (q.part !== "satellites") return null;
    return (
      "The ring always makes one full turn, each track taking a slice in proportion to its " +
      "time, so the total length has to show outside it."
    );
  },
  nameFact(f) {
    const rel = f.near
      ? "This one has the typical weight."
      : f.top
        ? "This one is the heaviest here."
        : f.bottom
          ? "This one is the lightest here."
          : f.high
            ? f.strong
              ? "This one is among the heaviest."
              : "This one is set a little heavier than most."
            : f.strong
              ? "This one is among the lightest."
              : "This one is set a little lighter than most.";
    return (
      "The name follows average loudness too: the louder the record, the thicker its letters. " +
      rel
    );
  },
  colourNote: "The colours come from the cover, not from the music.",
};

