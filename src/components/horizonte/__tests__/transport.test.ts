import { describe, expect, it } from "vitest";
import * as T from "../engine/transport";
import type { AudioEffect, Catalog } from "../engine/transport";
import { initialState } from "../state";
import type { FieldState } from "../types";

const TRACKS = [2, 3, 4];

const catalog: Catalog = {
  size: TRACKS.length,
  trackCount: (alb) => TRACKS[alb],
  trackDuration: (alb, trk) => 100 + alb * 10 + trk,
  hasTrack: (alb, trk) => alb >= 0 && alb < TRACKS.length && trk >= 0 && trk < TRACKS[alb],
};

const state = (over: Partial<FieldState> = {}): FieldState => ({ ...initialState(), ...over });

const playing = (over: Partial<FieldState> = {}) =>
  state({ scale: "track", mode: "playing", playAlb: 1, alb: 1, trk: 1, sel: 1, ...over });

const kinds = (effects: AudioEffect[]) => effects.map((e) => e.kind);

describe("enterAlbum", () => {
  it("takes the album scale and aligns navigation", () => {
    const s = state();
    expect(T.enterAlbum(s, catalog, 2)).toEqual([]);
    expect(s).toMatchObject({ alb: 2, navT: 2, scale: "album", zoomT: 1 });
  });

  it("rounds and saturates inside the catalogue", () => {
    const s = state();
    T.enterAlbum(s, catalog, 9);
    expect(s.alb).toBe(2);
    T.enterAlbum(s, catalog, -4);
    expect(s.alb).toBe(0);
    T.enterAlbum(s, catalog, 1.6);
    expect(s.alb).toBe(2);
  });

  it("entering the playing album selects the current track", () => {
    const s = state({ playAlb: 1, trk: 2 });
    T.enterAlbum(s, catalog, 1);
    expect(s.sel).toBe(2);
  });

  it("entering another album starts from the first track", () => {
    const s = state({ playAlb: 1, trk: 2 });
    T.enterAlbum(s, catalog, 0);
    expect(s.sel).toBe(0);
  });
});

describe("enterAlbum — listening survives the record swap", () => {
  it("at rest, entering an album stays silent", () => {
    const s = state();
    expect(T.enterAlbum(s, catalog, 2)).toEqual([]);
    expect(s.playAlb).toBe(-1);
    expect(s.mode).toBe("stopped");
    expect(s.scale).toBe("album");
  });

  it("while playing, entering another album opens on the first track", () => {
    const s = playing();
    const effects = T.enterAlbum(s, catalog, 2);

    expect(effects).toEqual([{ kind: "load", alb: 2, trk: 0 }]);
    expect(s.playAlb).toBe(2);
    expect(s.trk).toBe(0);
    expect(s.sel).toBe(0);
    expect(s.dur).toBe(catalog.trackDuration(2, 0));
  });

  it("swapping records is a splice, not a ceremony: the world introduces itself once", () => {
    const s = playing({ seqT: 9 });
    T.enterAlbum(s, catalog, 2);

    expect(s.mode).toBe("playing");
    expect(s.segueT).toBe(0);
    expect(s.seqT, "no ceremony was armed").toBe(9);
    expect(s.mix).toBe(0);
    expect(s.waveR).toBeLessThan(0);
  });

  it("after the swap the transport pauses instead of restarting", () => {
    const s = playing();
    T.enterAlbum(s, catalog, 2);

    expect(kinds(T.transport(s, catalog))).toEqual(["pause"]);
    expect(s.mode).toBe("paused");
    expect(s.trk).toBe(0);
  });

  it("while paused, entering another album respects the pause", () => {
    const s = playing({ mode: "paused" });
    expect(T.enterAlbum(s, catalog, 2)).toEqual([]);
    expect(s.playAlb).toBe(1);
    expect(s.mode).toBe("paused");
  });

  it("entering the record already playing does not restart the track", () => {
    const s = playing({ trk: 2, sel: 2 });
    expect(T.enterAlbum(s, catalog, 1)).toEqual([]);
    expect(s.trk).toBe(2);
    expect(s.sel).toBe(2);
    expect(s.mode).toBe("playing");
  });

  it("navigation follows the record along every path", () => {
    const s = playing({ navT: 1 });
    T.enterAlbum(s, catalog, 2);
    expect(s.navT).toBe(s.alb);

    const t = playing({ navT: 1, scale: "album" });
    T.playTrack(t, catalog, 2, 1);
    expect(t.navT).toBe(t.alb);

    const f = playing({ navT: 1 });
    T.fuseTo(f, 2, 0);
    T.endFusion(f, catalog, 120);
    expect(f.navT).toBe(f.alb);
  });
});

describe("playTrack", () => {
  it("collapses to the track and asks for the load", () => {
    const s = state({ alb: 2 });
    const effects = T.playTrack(s, catalog, 2, 3);
    expect(effects).toEqual([{ kind: "load", alb: 2, trk: 3 }]);
    expect(s).toMatchObject({
      playAlb: 2, alb: 2, trk: 3, sel: 3, scale: "track", mode: "collapse", pos: 0, seqT: 0,
    });
    expect(s.dur).toBe(catalog.trackDuration(2, 3));
  });

  it("asking for the track already playing toggles the transport", () => {
    const s = playing();
    expect(kinds(T.playTrack(s, catalog, 1, 1))).toEqual(["pause"]);
    expect(s.mode).toBe("paused");
  });

  it("another track with the record engaged fuses instead of restarting", () => {
    const s = playing();
    expect(T.playTrack(s, catalog, 1, 2)).toEqual([]);
    expect(s).toMatchObject({ mode: "fusion", fuseAlb: 1, fuseB: 2 });
    expect(s.trk).toBe(1);
  });

  it("outside the track scale, it always restarts", () => {
    const s = state({ scale: "album", mode: "playing", playAlb: 1, alb: 1, trk: 1 });
    expect(kinds(T.playTrack(s, catalog, 1, 2))).toEqual(["load"]);
    expect(s.mode).toBe("collapse");
  });
});

describe("transport", () => {
  it("with no loaded track, it plays the selection", () => {
    const s = state({ scale: "album", alb: 2, sel: 3 });
    expect(kinds(T.transport(s, catalog))).toEqual(["load"]);
    expect(s).toMatchObject({ playAlb: 2, trk: 3 });
  });

  it("playing becomes paused", () => {
    const s = playing();
    expect(kinds(T.transport(s, catalog))).toEqual(["pause"]);
    expect(s.mode).toBe("paused");
  });

  it("the collapse can be interrupted too", () => {
    const s = playing({ mode: "collapse" });
    expect(kinds(T.transport(s, catalog))).toEqual(["pause"]);
    expect(s.mode).toBe("paused");
  });

  it("paused, it plays again", () => {
    const s = playing({ mode: "paused" });
    expect(kinds(T.transport(s, catalog))).toEqual(["play"]);
    expect(s.mode).toBe("playing");
  });

  it("during the fusion the transport does not respond", () => {
    const s = playing({ mode: "fusion" });
    expect(T.transport(s, catalog)).toEqual([]);
    expect(s.mode).toBe("fusion");
  });
});

describe("back", () => {
  it("from the track it returns to the album", () => {
    const s = playing();
    T.back(s);
    expect(s).toMatchObject({ scale: "album", zoomT: 1 });
  });

  it("from the album it returns to the collection and releases the hover", () => {
    const s = state({ scale: "album", hover: 3 });
    T.back(s);
    expect(s).toMatchObject({ scale: "collection", zoomT: 0, hover: -1 });
  });

  it("in the collection there is nowhere to go back to", () => {
    const s = state();
    T.back(s);
    expect(s.scale).toBe("collection");
  });

  it("going back does not interrupt playback", () => {
    const s = playing();
    T.back(s);
    T.back(s);
    expect(s.mode).toBe("playing");
    expect(s.playAlb).toBe(1);
  });
});

describe("goScale", () => {
  it("the collection is always reachable", () => {
    const s = playing({ hover: 2 });
    T.goScale(s, catalog, "collection");
    expect(s).toMatchObject({ scale: "collection", zoomT: 0, hover: -1 });
  });

  it("from the collection, the album is whatever navigation sits on", () => {
    const s = state({ nav: 1.6 });
    T.goScale(s, catalog, "album");
    expect(s).toMatchObject({ scale: "album", alb: 2 });
  });

  it("from the track, the album is only a change of scale", () => {
    const s = playing();
    T.goScale(s, catalog, "album");
    expect(s).toMatchObject({ scale: "album", zoomT: 1, alb: 1 });
  });

  it("the track returns to the record that is playing", () => {
    const s = state({ scale: "collection", playAlb: 2, trk: 1, alb: 0 });
    expect(T.goScale(s, catalog, "track")).toEqual([]);
    expect(s).toMatchObject({ scale: "track", alb: 2 });
  });

  it("with nothing playing, the track starts the current selection", () => {
    const s = state({ scale: "album", alb: 2, sel: 3 });
    expect(kinds(T.goScale(s, catalog, "track"))).toEqual(["load"]);
    expect(s).toMatchObject({ playAlb: 2, trk: 3 });
  });
});

describe("primary", () => {
  it("in the collection, it enters the album under navigation", () => {
    const s = state({ nav: 2.4 });
    T.primary(s, catalog);
    expect(s).toMatchObject({ scale: "album", alb: 2 });
  });

  it("in the album, it plays the selection", () => {
    const s = state({ scale: "album", alb: 2, sel: 1 });
    expect(kinds(T.primary(s, catalog))).toEqual(["load"]);
  });

  it("on the track, it toggles the transport", () => {
    const s = playing();
    expect(kinds(T.primary(s, catalog))).toEqual(["pause"]);
  });
});

describe("stepSel", () => {
  it("in the collection there is no selection to move", () => {
    const s = state();
    expect(T.stepSel(s, catalog, 1)).toEqual([]);
    expect(s.sel).toBe(0);
  });

  it("cycles inside the album in both directions", () => {
    const s = state({ scale: "album", alb: 2, sel: 3 });
    T.stepSel(s, catalog, 1);
    expect(s.sel).toBe(0);
    T.stepSel(s, catalog, -1);
    expect(s.sel).toBe(3);
  });

  it("with the record engaged, moving the selection fuses", () => {
    const s = playing({ alb: 1, sel: 1 });
    T.stepSel(s, catalog, 1);
    expect(s).toMatchObject({ mode: "fusion", fuseB: 2, fuseAlb: 1 });
  });

  it("in the album, moving the selection does not touch the audio", () => {
    const s = state({ scale: "album", mode: "playing", playAlb: 1, alb: 1, sel: 0 });
    expect(T.stepSel(s, catalog, 1)).toEqual([]);
    expect(s.mode).toBe("playing");
  });
});

describe("skip", () => {
  it("in the collection with nothing playing, it crosses the records", () => {
    const s = state({ nav: 0.4 });
    T.skip(s, catalog, 1);
    expect(s.navT).toBe(1);
  });

  it("in the collection, it stops at the catalogue's edges", () => {
    const s = state({ nav: 0 });
    T.skip(s, catalog, -1);
    expect(s.navT).toBe(0);
    s.nav = 2;
    T.skip(s, catalog, 1);
    expect(s.navT).toBe(2);
  });

  it("with a track running, it fuses to the next", () => {
    const s = playing({ alb: 1, trk: 1 });
    T.skip(s, catalog, 1);
    expect(s).toMatchObject({ mode: "fusion", fuseAlb: 1, fuseB: 2 });
  });

  it("cycles at the record's end", () => {
    const s = playing({ alb: 1, trk: 2 });
    T.skip(s, catalog, 1);
    expect(s.fuseB).toBe(0);
  });

  it("previous on the first track goes to the last", () => {
    const s = playing({ alb: 1, trk: 0 });
    T.skip(s, catalog, -1);
    expect(s.fuseB).toBe(2);
  });

  it("during the collapse it fuses too", () => {
    const s = playing({ mode: "collapse", alb: 1, trk: 0 });
    T.skip(s, catalog, 1);
    expect(s.mode).toBe("fusion");
  });

  it("browsing the playing record, skipping still swaps the track", () => {
    const s = state({ scale: "album", alb: 2, sel: 0, playAlb: 2, mode: "playing" });
    expect(T.skip(s, catalog, 1)).toEqual([]);
    expect(s).toMatchObject({ mode: "fusion", fuseAlb: 2, fuseB: 1 });
  });

  it("browsing another record, skipping only moves the selection", () => {
    const s = state({ scale: "album", alb: 0, sel: 0, playAlb: 2, trk: 3, mode: "playing" });
    expect(T.skip(s, catalog, 1)).toEqual([]);
    expect(s).toMatchObject({ sel: 1, mode: "playing", playAlb: 2, trk: 3 });
  });
});

describe("fusion", () => {
  it("a fusion in progress is not interrupted by another", () => {
    const s = playing();
    T.fuseTo(s, 1, 2);
    T.fuseTo(s, 0, 0);
    expect(s).toMatchObject({ fuseAlb: 1, fuseB: 2 });
  });

  it("the fusion is born with the audio not yet swapped", () => {
    const s = playing();
    T.fuseTo(s, 1, 2);
    expect(s.fuseLoaded).toBe(false);
    expect(s.mix).toBe(0);
  });

  it("the audio swap happens exactly once", () => {
    const s = playing();
    T.fuseTo(s, 1, 2);
    expect(T.commitFusion(s, catalog)).toEqual([{ kind: "load", alb: 1, trk: 2 }]);
    expect(T.commitFusion(s, catalog)).toEqual([]);
    expect(T.commitFusion(s, catalog)).toEqual([]);
  });

  it("a nonexistent track triggers no load", () => {
    const s = playing();
    T.fuseTo(s, 1, 99);
    expect(T.commitFusion(s, catalog)).toEqual([]);
    expect(s.fuseLoaded).toBe(true);
  });

  it("ending promotes the target to the current track", () => {
    const s = playing({ alb: 1, trk: 0 });
    T.fuseTo(s, 2, 3);
    T.endFusion(s, catalog, 0);

    expect(s).toMatchObject({
      playAlb: 2, alb: 2, trk: 3, sel: 3, mode: "playing", mix: 0, pos: 0, waveR: -1, scale: "track",
    });
    expect(s.dur).toBe(catalog.trackDuration(2, 3));
  });

  it("the file's real duration takes precedence over the catalogue's", () => {
    const s = playing();
    T.fuseTo(s, 2, 3);
    T.endFusion(s, catalog, 321.5);
    expect(s.dur).toBe(321.5);
  });

  it("ending on the album does not drag the scale to the track", () => {
    const s = state({ scale: "album", mode: "fusion", fuseAlb: 2, fuseB: 1 });
    T.endFusion(s, catalog, 0);
    expect(s.scale).toBe("album");
  });
});

describe("seekFraction", () => {
  it("with no known duration it does not seek", () => {
    const s = playing({ dur: 0 });
    expect(T.seekFraction(s, 0.5)).toEqual([]);
  });

  it("converts the fraction into seconds", () => {
    const s = playing({ dur: 200 });
    expect(T.seekFraction(s, 0.25)).toEqual([{ kind: "seek", seconds: 50 }]);
  });

  it("saturates the fraction at the track's edges", () => {
    const s = playing({ dur: 200 });
    expect(T.seekFraction(s, -3)).toEqual([{ kind: "seek", seconds: 0 }]);
    expect(T.seekFraction(s, 9)).toEqual([{ kind: "seek", seconds: 200 }]);
  });
});

describe("the track's natural end", () => {
  it("splices into the next with no fusion ceremony", () => {
    const s = playing({ playAlb: 1, trk: 0 });
    expect(T.trackEnded(s, catalog)).toEqual([{ kind: "load", alb: 1, trk: 1 }]);
    expect(s).toMatchObject({ mode: "playing", trk: 1, sel: 1, pos: 0, segueT: 0 });
    expect(s.dur).toBe(catalog.trackDuration(1, 1));
  });

  it("the splice moves neither the scale nor the focused album", () => {
    const s = playing({ playAlb: 1, trk: 0, alb: 2, scale: "album", sel: 1 });
    T.trackEnded(s, catalog);
    expect(s).toMatchObject({ scale: "album", alb: 2, sel: 1, trk: 1 });
  });

  it("returns to the start of the record after the last", () => {
    const s = playing({ playAlb: 1, trk: 2 });
    T.trackEnded(s, catalog);
    expect(s.trk).toBe(0);
  });

  it("with no record running, there is no splice", () => {
    const s = state();
    expect(T.trackEnded(s, catalog)).toEqual([]);
    expect(s.mode).toBe("stopped");
  });

  it("during a fusion, the track's end does not trample the ceremony", () => {
    const s = playing({ playAlb: 1, trk: 0 });
    T.fuseTo(s, 1, 2);
    expect(T.trackEnded(s, catalog)).toEqual([]);
    expect(s).toMatchObject({ mode: "fusion", fuseB: 2, trk: 0 });
  });
});

describe("the fusion does not hijack the focused album", () => {
  it("navigating during the fusion keeps the album the user chose", () => {
    const s = playing({ alb: 1, trk: 0 });
    T.fuseTo(s, 1, 1);
    T.enterAlbum(s, catalog, 2);
    T.endFusion(s, catalog, 0);

    expect(s).toMatchObject({ alb: 2, scale: "album", playAlb: 1, trk: 1 });
  });

  it("without navigating, the target is still promoted", () => {
    const s = playing({ alb: 1, trk: 0 });
    T.fuseTo(s, 2, 3);
    T.endFusion(s, catalog, 0);

    expect(s).toMatchObject({ alb: 2, sel: 3, playAlb: 2, trk: 3, scale: "track" });
  });
});
