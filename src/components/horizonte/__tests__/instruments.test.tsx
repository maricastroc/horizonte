import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import Instruments, { isInstrumentsTarget } from "../Instruments";
import { ALBUMS, OPENING } from "../content";
import { timecode } from "../format";
import { COLOR, rgba } from "../tokens";
import type { Snapshot } from "../types";
import { fakeEngine } from "./fakeInstruments";

const numbers = (color: string) => {
  const hex = color.match(/#([0-9a-f]{6})/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const v = (color.match(/[\d.]+/g) ?? []).map(Number);
  return v.length === 4 && v[3] === 1 ? v.slice(0, 3) : v;
};

const trackRail = () => document.querySelector("nav[aria-label^='Tracks of']") as HTMLElement;

const mount = (initial: Partial<Snapshot> = {}) => {
  const fake = fakeEngine(initial);
  render(<Instruments engine={fake.engine} />);
  return fake;
};

afterEach(cleanup);

describe("album rail", () => {
  it("lists the whole catalogue with artist and catalogue number", () => {
    mount();
    const rail = screen.getByRole("navigation", { name: "Albums" });
    const items = within(rail).getAllByRole("button");
    expect(items).toHaveLength(ALBUMS.length + 1);
    expect(within(rail).getByText(ALBUMS[0].artist)).toBeDefined();
    expect(within(rail).getByText(ALBUMS[0].cat)).toBeDefined();
  });

  it("a long name is never lost: full in the row's text and title, revealed on pointer and focus", () => {
    mount();
    const rail = screen.getByRole("navigation", { name: "Albums" });
    for (const album of ALBUMS) {
      const row = within(rail).getByText(album.artist).closest("button")!;
      expect(row.getAttribute("title")).toBe(album.artist);
      const name = within(row).getByText(album.artist);
      expect(name.className).toContain("group-hover:col-span-2");
      expect(name.className).toContain("group-focus-visible:col-span-2");
      expect(name.className).not.toContain("truncate");
      expect(within(row).getByText(album.cat).className).toContain("group-focus-visible:hidden");
    }
  });

  it("closes the rail with the local-record intake, without becoming a file manager", () => {
    mount();
    const rail = screen.getByRole("navigation", { name: "Albums" });
    const items = within(rail).getAllByRole("button");
    expect(items[items.length - 1].textContent).toContain("Bring a record");
    expect(within(rail).queryByText(/upload|file|send/i)).toBeNull();
  });
});

describe("intake for bringing a record", () => {
  const intake = () => {
    const rail = screen.getByRole("navigation", { name: "Albums" });
    const items = within(rail).getAllByRole("button");
    return items[items.length - 1];
  };

  const albumLine = () => {
    const rail = screen.getByRole("navigation", { name: "Albums" });
    return within(rail).getAllByRole("button")[1];
  };

  it("it is an action, not a catalogue item: it sits outside the album list", () => {
    mount();
    expect(intake().closest("ul")).toBeNull();
    expect(albumLine().closest("ul")).not.toBeNull();
  });

  it("it uses neither the catalogue-code column nor pretends to be a record", () => {
    mount();
    expect(intake().textContent).toBe("Bring a record");
    expect(intake().textContent).not.toMatch(/[HL]—\d/);
    expect(intake().className).toContain("grid-cols-[1fr_7px]");
    expect(albumLine().className).toContain("grid-cols-[1fr_46px_7px]");
  });

  it("it reads lighter than the records in the list, and no lighter than the focused record", () => {
    mount();
    expect(intake().className).toContain("text-ink-text-2");
    expect(intake().className).not.toContain("text-ink-faint");
    expect(albumLine().className).not.toContain("text-ink-text-2");
  });

  it("it is separated from the list by breathing room and its own rule", () => {
    mount();
    expect(intake().className).toContain("mt-2.5");
    expect(intake().className).toContain("border-t");
    expect(intake().className).toContain("border-rule");
  });

  it("it has a larger target than a catalogue line, and larger still when compact", () => {
    mount();
    expect(intake().className).toContain("h-[34px]");
    cleanup();
    mount({ variant: "mobile", scale: "collection" });
    fireEvent.click(screen.getByRole("button", { name: "Albums" }));
    expect(intake().className).toContain("min-h-[52px]");
  });

  it("the marker is an empty place that fills on pointing", () => {
    mount();
    const mark = intake().querySelector("span[aria-hidden]")!;
    const tokens = mark.className.split(/\s+/);
    expect(tokens).toContain("border-ink-faint");
    expect(tokens).not.toContain("bg-paper");
    expect(tokens).toContain("group-hover:bg-paper");
    expect(tokens).toContain("group-focus-visible:bg-paper");
  });

  it("pointing tells the field, and leaving gives it back", () => {
    const fake = mount();
    fireEvent.pointerEnter(intake());
    expect(fake.last("setIntake")?.args).toEqual([true]);
    expect(fake.last("setRailAlb")?.args).toEqual([-1]);
    fireEvent.pointerLeave(intake());
    expect(fake.last("setIntake")?.args).toEqual([false]);
  });

  it("keyboard focus tells the field just as the pointer does", () => {
    const fake = mount();
    fireEvent.focus(intake());
    expect(fake.last("setIntake")?.args).toEqual([true]);
    fireEvent.blur(intake());
    expect(fake.last("setIntake")?.args).toEqual([false]);
  });

  it("it is keyboard-reachable while the rail is open", () => {
    mount();
    expect(intake().getAttribute("tabindex")).toBe("0");
  });

  it("dragging files lights the intake and says what to do", () => {
    mount();
    const dt = { types: ["Files"] };
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event("dragenter"), { dataTransfer: dt }),
      );
    });
    expect(intake().textContent).toBe("Drop to measure");
    expect(intake().className).toContain("text-ink-text");
    expect(intake().querySelector("span[aria-hidden]")!.className.split(/\s+/)).toContain(
      "bg-paper",
    );
  });

  it("marks the focused record for assistive technology", () => {
    mount({ navAlb: 3 });
    const rail = screen.getByRole("navigation", { name: "Albums" });
    const currents = within(rail).getAllByRole("button").filter((b) => b.getAttribute("aria-current"));
    expect(currents).toHaveLength(1);
    expect(currents[0].textContent).toContain(ALBUMS[3].artist);
  });

  it("in the collection focus follows navigation, not the open album", () => {
    mount({ scale: "collection", navAlb: 2, alb: 5 });
    const rail = screen.getByRole("navigation", { name: "Albums" });
    const current = within(rail).getAllByRole("button").find((b) => b.getAttribute("aria-current"));
    expect(current?.textContent).toContain(ALBUMS[2].artist);
  });

  it("outside the collection focus is the open album", () => {
    mount({ scale: "album", navAlb: 2, alb: 5 });
    const rail = screen.getByRole("navigation", { name: "Albums" });
    const current = within(rail).getAllByRole("button").find((b) => b.getAttribute("aria-current"));
    expect(current?.textContent).toContain(ALBUMS[5].artist);
  });

  it("the mark distinguishes focus, playing record and rest", () => {
    const fake = mount({ scale: "album", alb: 1, playAlb: 4 });
    const rail = screen.getByRole("navigation", { name: "Albums" });
    const marks = within(rail).getAllByRole("button").map((b) => b.querySelector("span[aria-hidden]")!);

    expect(numbers(marks[1].getAttribute("style") ?? "")).toEqual(numbers(rgba(ALBUMS[1].inkA, 1)));
    expect(numbers(marks[4].getAttribute("style") ?? "")).toEqual(numbers(rgba(ALBUMS[4].inkA, 0.5)));
    expect(numbers(marks[7].getAttribute("style") ?? "")).toEqual(numbers(COLOR.inkGhost));
    void fake;
  });

  it("clicking a record asks to enter it", () => {
    const fake = mount();
    const rail = screen.getByRole("navigation", { name: "Albums" });
    fireEvent.click(within(rail).getAllByRole("button")[6]);
    expect(fake.last("enterAlbum")?.args).toEqual([6]);
  });

  it("pointing at and leaving the record turns the world's highlight on and off", () => {
    const fake = mount();
    const rail = screen.getByRole("navigation", { name: "Albums" });
    const target = within(rail).getAllByRole("button")[2];

    fireEvent.pointerEnter(target);
    expect(fake.last("setRailAlb")?.args).toEqual([2]);
    fireEvent.pointerLeave(target);
    expect(fake.last("setRailAlb")?.args).toEqual([-1]);
  });

  it("the highlight follows keyboard focus too", () => {
    const fake = mount();
    const rail = screen.getByRole("navigation", { name: "Albums" });
    fireEvent.focus(within(rail).getAllByRole("button")[3]);
    expect(fake.last("setRailAlb")?.args).toEqual([3]);
  });
});

describe("track rail", () => {
  it("it stays hidden and outside the tab order in the collection", () => {
    mount({ scale: "collection" });
    const rail = trackRail();
    expect(rail.getAttribute("aria-hidden")).toBe("true");
    for (const b of rail.querySelectorAll("button")) {
      expect(b.getAttribute("tabindex")).toBe("-1");
    }
  });

  it("it appears and becomes navigable in the album", () => {
    mount({ scale: "album", alb: 2 });
    const rail = trackRail();
    expect(rail.getAttribute("aria-label")).toBe(`Tracks of ${ALBUMS[2].title}`);
    expect(rail.getAttribute("aria-hidden")).toBe("false");
    const items = within(rail).getAllByRole("button");
    expect(items).toHaveLength(ALBUMS[2].tracks.length);
    expect(items[0].getAttribute("tabindex")).toBe("0");
  });

  it("shows number, title and duration of each track", () => {
    mount({ scale: "album", alb: 2 });
    const rail = trackRail();
    const first = within(rail).getAllByRole("button")[0];
    expect(first.textContent).toContain("01");
    expect(first.textContent).toContain(ALBUMS[2].tracks[0].title);
    expect(first.textContent).toContain(timecode(ALBUMS[2].tracks[0].dur));
  });

  it("the current track is announced as current", () => {
    mount({ scale: "track", alb: 2, playAlb: 2, trk: 3 });
    const rail = trackRail();
    const currents = within(rail).getAllByRole("button").filter((b) => b.getAttribute("aria-current"));
    expect(currents).toHaveLength(1);
    expect(currents[0].textContent).toContain(ALBUMS[2].tracks[3].title);
  });

  it("the mark grows on the playing track and on the selected one", () => {
    mount({ scale: "album", alb: 2, playAlb: 2, trk: 1, sel: 3 });
    const rail = trackRail();
    const marks = within(rail).getAllByRole("button").map((b) => b.querySelector("span[aria-hidden]")!);

    expect(marks[1].className).toContain("w-[7px]");
    expect(marks[3].className).toContain("w-[7px]");
    expect(marks[0].className).toContain("w-[5px]");
  });

  it("the playing track uses the record's ink and the selected one the text ink", () => {
    mount({ scale: "album", alb: 2, playAlb: 2, trk: 1, sel: 3 });
    const rail = trackRail();
    const marks = within(rail).getAllByRole("button").map((b) => b.querySelector("span[aria-hidden]")!);

    expect(numbers(marks[1].getAttribute("style") ?? "")).toEqual(numbers(rgba(ALBUMS[2].inkA, 1)));
    expect(numbers(marks[3].getAttribute("style") ?? "")).toEqual(numbers(COLOR.inkText));
  });

  it("clicking a track asks to play it in the open record", () => {
    const fake = mount({ scale: "album", alb: 2 });
    const rail = trackRail();
    fireEvent.click(within(rail).getAllByRole("button")[2]);
    expect(fake.last("playTrack")?.args).toEqual([2, 2]);
  });
});

describe("transport", () => {
  it("invites playing when nothing has loaded", () => {
    mount();
    expect(screen.getByRole("button", { name: /Play/ })).toBeDefined();
  });

  it("offers resume when a track is paused", () => {
    mount({ scale: "track", playAlb: 0, mode: "paused" });
    expect(screen.getByRole("button", { name: /Resume/ })).toBeDefined();
  });

  it("offers pause during playback and marks the state", () => {
    mount({ scale: "track", playAlb: 0, mode: "playing" });
    const button = screen.getByRole("button", { name: /Pause/ });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("the three controls call the engine", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    expect(fake.last("skip")?.args).toEqual([-1]);

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(fake.last("skip")?.args).toEqual([1]);

    fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
    expect(fake.last("transport")).toBeDefined();
  });

  it("the position in the track is a real slider, not a decorative bar", () => {
    mount({ scale: "track", playAlb: 0, mode: "playing" });
    const seek = screen.getByRole("slider", { name: "Position in track" });
    expect(seek.tagName).toBe("INPUT");
    expect(seek.tabIndex).toBe(0);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("dragging the slider seeks the corresponding fraction", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    const seek = screen.getByRole("slider", { name: "Position in track" });
    fireEvent.change(seek, { target: { value: "500" } });
    expect(fake.last("seekFraction")?.args).toEqual([0.5]);
  });

  it("the arrows move five seconds, not a fraction of the track", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    fake.frame({ progress: 0.5, position: 60, duration: 120 });
    const seek = screen.getByRole("slider", { name: "Position in track" });

    fireEvent.keyDown(seek, { key: "ArrowRight" });
    expect(fake.last("seekFraction")?.args[0]).toBeCloseTo(0.5 + 5 / 120, 6);

    fireEvent.keyDown(seek, { key: "ArrowLeft" });
    expect(fake.last("seekFraction")?.args[0]).toBeCloseTo(0.5 - 5 / 120, 6);
  });

  it("Home and End go to the track's ends", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    fake.frame({ progress: 0.5, position: 60, duration: 120 });
    const seek = screen.getByRole("slider", { name: "Position in track" });

    fireEvent.keyDown(seek, { key: "Home" });
    expect(fake.last("seekFraction")?.args[0]).toBeLessThanOrEqual(0);
    fireEvent.keyDown(seek, { key: "End" });
    expect(fake.last("seekFraction")?.args[0]).toBeGreaterThanOrEqual(1);
  });

  it("with no loaded track the keyboard does not seek into the void", () => {
    const fake = mount({ scale: "collection" });
    const seek = screen.getByRole("slider", { name: "Position in track" });
    fireEvent.keyDown(seek, { key: "ArrowRight" });
    expect(fake.last("seekFraction")).toBeUndefined();
  });
});

describe("volume", () => {
  it("there is a keyboard-reachable volume control", () => {
    mount();
    const vol = screen.getByRole("slider", { name: "Volume" });
    expect(vol.tagName).toBe("INPUT");
    expect(vol.tabIndex).toBe(0);
  });

  it("moving the control asks the engine for the new level", () => {
    const fake = mount();
    const vol = screen.getByRole("slider", { name: "Volume" });
    fireEvent.change(vol, { target: { value: "40" } });
    expect(fake.last("setVolume")?.args).toEqual([0.4]);
  });

  it("mute is a marked state, and sound returns when the level is touched", () => {
    const fake = mount();
    const button = screen.getByRole("button", { name: "Sound" });
    fireEvent.click(button);
    expect(fake.last("setMuted")?.args).toEqual([true]);
    expect(screen.getByRole("button", { name: "Mute" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "70" } });
    expect(fake.last("setVolume")?.args).toEqual([0.7]);
    expect(screen.getByRole("button", { name: "Sound" })).toBeDefined();
  });

  it("when muted the control shows zero without forgetting the chosen level", () => {
    mount();
    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Sound" }));
    expect((screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement).value).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect((screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement).value).toBe("60");
  });
});

describe("playback fault", () => {
  it("in silence, nothing is said", () => {
    mount({ scale: "track", playAlb: 0, mode: "playing" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("a track that fails to load says so, instead of pretending to play", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    act(() => fake.update({ fault: "source", mode: "paused" }));
    const warning = screen.getByRole("status");
    expect(warning.textContent).toMatch(/could not load/i);
    expect(screen.getByRole("button", { name: /Resume/ })).toBeDefined();
  });

  it("the browser's block is stated along with what to do next", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "paused" });
    act(() => fake.update({ fault: "blocked" }));
    expect(screen.getByRole("status").textContent).toMatch(/blocked the sound/i);
  });
});

describe("scales and return", () => {
  it("marks the current scale in the trail", () => {
    mount({ scale: "album" });
    const track = screen.getByRole("navigation", { name: "Scale" });
    const current = within(track).getAllByRole("button").find((b) => b.getAttribute("aria-current") === "step");
    expect(current?.textContent).toBe("Album");
  });

  it("clicking a scale asks for the change", () => {
    const fake = mount({ scale: "album" });
    const track = screen.getByRole("navigation", { name: "Scale" });
    fireEvent.click(within(track).getByText("Track"));
    expect(fake.last("goScale")?.args).toEqual(["track"]);
  });

  it("back is inert in the collection", () => {
    mount({ scale: "collection" });
    const goBack = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Back"))!;
    expect(goBack.getAttribute("tabindex")).toBe("-1");
    expect(goBack.getAttribute("aria-hidden")).toBe("true");
  });

  it("back is active outside the collection and calls the engine", () => {
    const fake = mount({ scale: "album" });
    const goBack = screen.getByRole("button", { name: /Back/ });
    expect(goBack.getAttribute("tabindex")).toBe("0");
    fireEvent.click(goBack);
    expect(fake.last("back")).toBeDefined();
  });
});

describe("credit and announcement", () => {
  it("credits the focused record's licence", () => {
    mount({ alb: 3 });
    const link = screen.getByRole("link", { name: ALBUMS[3].license.name });
    expect(link.getAttribute("href")).toBe(ALBUMS[3].license.source);
    expect(link.getAttribute("title")).toContain(ALBUMS[3].license.attribution);
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("the curation note follows the attribution, when the author requires it", () => {
    const i = ALBUMS.findIndex((a) => a.note);
    expect(i, "the catalogue needs at least one record with a note").toBeGreaterThanOrEqual(0);
    mount({ alb: i });
    const credit = screen.getByRole("link", { name: ALBUMS[i].license.name });
    expect(credit.getAttribute("title")).toContain(ALBUMS[i].note!);
  });

  it("a record with no note gets no stray dash in the credit", () => {
    const i = ALBUMS.findIndex((a) => !a.note);
    mount({ alb: i });
    const credit = screen.getByRole("link", { name: ALBUMS[i].license.name });
    expect(credit.getAttribute("title")).toBe(ALBUMS[i].license.attribution);
  });

  it("announces the playing track in a live region", () => {
    mount({ playAlb: 1, trk: 0 });
    const region = document.querySelector("[aria-live='polite']");
    expect(region?.textContent).toBe("01 · Le Manoir — Tristan Lohengrin");
  });

  it("announces the collection when nothing is playing", () => {
    mount();
    const region = document.querySelector("[aria-live='polite']");
    expect(region?.textContent).toBe(`Collection · ${ALBUMS.length} bodies`);
  });
});

describe("continuous channel", () => {
  it("writes progress, time and assistive reading without a new render", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    const seek = screen.getByRole("slider", { name: "Position in track" }) as HTMLInputElement;

    fake.frame({ progress: 0.25, position: 30, duration: 120 });

    expect(seek.style.getPropertyValue("--fill")).toBe("25%");
    expect(seek.value).toBe("250");
    expect(screen.getByText("00:30 / 02:00")).toBeDefined();
    expect(seek.getAttribute("aria-valuetext")).toBe("00:30 of 02:00");
  });

  it("the assistive reading is spaced out, the pixel is not", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    const seek = screen.getByRole("slider", { name: "Position in track" }) as HTMLInputElement;

    fake.frame({ progress: 0.1, position: 12, duration: 120 });
    fake.frame({ progress: 0.2, position: 24, duration: 120 });

    expect(seek.style.getPropertyValue("--fill")).toBe("20%");
    expect(seek.getAttribute("aria-valuetext")).toBe("00:12 of 02:00");
  });

  it("unmounting cancels the frame registration", () => {
    const fake = fakeEngine();
    const display = render(<Instruments engine={fake.engine} />);
    expect(fake.hasFrame()).toBe(true);
    display.unmount();
    expect(fake.hasFrame()).toBe(false);
  });
});

describe("with no engine", () => {
  it("draws the collection and does not break on click", () => {
    render(<Instruments engine={null} />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
    expect(() => fireEvent.click(screen.getByRole("button", { name: /Play/ }))).not.toThrow();
  });
});

describe("reaction to the snapshot", () => {
  it("an engine warning repaints the interface", () => {
    const fake = mount({ scale: "collection", alb: 0 });
    expect(screen.queryByText(ALBUMS[4].tracks[0].title)).toBe(null);

    act(() => fake.update({ scale: "album", alb: 4 }));
    expect(screen.getByText(ALBUMS[4].tracks[0].title)).toBeDefined();
  });
});

describe("boundary with the world", () => {
  it("recognizes a target born in the instruments layer", () => {
    mount();
    const button = screen.getByRole("button", { name: /Play/ });
    expect(isInstrumentsTarget({ target: button } as unknown as Event)).toBe(true);
  });

  it("a target from outside the panel does not belong to the layer", () => {
    mount();
    const outside = document.createElement("canvas");
    document.body.appendChild(outside);
    expect(isInstrumentsTarget({ target: outside } as unknown as Event)).toBe(false);
  });
});

describe("compact composition — the two rails do not fight for space", () => {
  const rail = (label: string) =>
    document.querySelector(`nav[aria-label^="${label}"]`) as HTMLElement;

  it("on the phone, opening an album collapses the record rail", () => {
    mount({ variant: "mobile", scale: "album", alb: 0 });
    const albums = rail("Albums");
    expect(albums.getAttribute("aria-hidden")).toBe("true");
    expect(albums.className).toContain("pointer-events-none");
    for (const b of within(albums).getAllByRole("button", { hidden: true })) {
      expect(b.tabIndex).toBe(-1);
    }
  });

  it("on the phone the record rail opens on demand, so it does not cover the world", () => {
    mount({ variant: "mobile", scale: "collection" });
    const albums = rail("Albums");
    expect(albums.getAttribute("aria-hidden")).toBe("true");

    const open = screen.getByRole("button", { name: "Albums" });
    expect(open.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(open);

    expect(rail("Albums").getAttribute("aria-hidden")).toBe("false");
    expect(rail("Albums").className).toContain("pointer-events-auto");
    expect(within(rail("Albums")).getAllByRole("button")[0].tabIndex).toBe(0);
    expect(screen.getByRole("button", { name: "Close" })).toBeDefined();
  });

  it("on the phone, choosing a record closes the rail", () => {
    const fake = mount({ variant: "mobile", scale: "collection" });
    fireEvent.click(screen.getByRole("button", { name: "Albums" }));
    const line = within(rail("Albums")).getAllByRole("button")[0];
    fireEvent.click(line);
    expect(fake.last("enterAlbum")?.args).toEqual([0]);
    expect(rail("Albums").getAttribute("aria-hidden")).toBe("true");
  });

  it("on desktop there is no open-rail button: it is already open", () => {
    mount({ variant: "desktop", scale: "collection" });
    expect(screen.queryByRole("button", { name: "Albums" })).toBeNull();
    expect(rail("Albums").getAttribute("aria-hidden")).toBe("false");
  });

  it("on desktop the two coexist, as always", () => {
    mount({ variant: "desktop", scale: "album", alb: 0 });
    const albums = rail("Albums");
    expect(albums.getAttribute("aria-hidden")).toBe("false");
    expect(albums.className).toContain("pointer-events-auto");
    expect(rail("Tracks").className).toContain("pointer-events-auto");
  });
});

describe("compact composition — device edges and touch targets", () => {
  it("the instruments layer respects the device's safe areas", () => {
    mount();
    const layer = document.querySelector("[data-instruments]") as HTMLElement;
    expect(layer.className).toContain("instruments-safe");
    expect(layer.className, "inset-0 would override the safe-area insets").not.toContain(
      "inset-0",
    );
  });

  it("the rails share a bounded column, without counting lines in pixels", () => {
    mount({ scale: "album" });
    const tracks = document.querySelector('nav[aria-label^="Tracks"]') as HTMLElement;
    const column = tracks.parentElement as HTMLElement;

    expect(column.className).toContain("top-14");
    expect(column.className).toContain("bottom-37.5");
    expect(column.className).toContain("flex-col");
    expect(tracks.className).toContain("overflow-y-auto");
    expect(tracks.className).toContain("min-h-0");
  });

  it("the record rail scrolls instead of overflowing when the catalogue grows", () => {
    mount();
    const rail = screen.getByRole("navigation", { name: "Albums" });
    const list = within(rail).getAllByRole("listitem")[0].parentElement as HTMLElement;
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toContain("min-h-0");
    expect(screen.getByText("Bring a record").closest("ul")).toBeNull();
  });

  it("the transport line wraps instead of clipping the timecode", () => {
    mount();
    const tc = screen.getByText(/00:00 \/ 00:00/);
    expect(tc.parentElement?.className).toContain("flex-wrap");
  });
});

describe("why this shape", () => {
  const EWORLD = ALBUMS.findIndex((a) => a.id === "zero-project-e-world");
  const MKULTRA = ALBUMS.findIndex((a) => a.id === "meho-mkultra");

  const openShape = () => fireEvent.click(screen.getByRole("tab", { name: "Why this shape?" }));

  it("sits beside the tracks, named as a question", () => {
    mount({ scale: "album", alb: EWORLD });
    const tabs = within(trackRail()).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Tracks", "Why this shape?"]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("opening it tells the engine and lights the record's leading question", () => {
    const fake = mount({ scale: "album", alb: EWORLD });
    openShape();
    expect(fake.last("openAnatomy")).toBeDefined();
    expect(fake.last("setAnatomyFocus")?.args).toEqual(["satellites"]);
  });

  it("the open question comes with its answer and a concrete experiment", () => {
    mount({ scale: "album", alb: EWORLD, focus: "satellites" });
    openShape();
    const q = screen.getByRole("heading", { level: 3 });
    expect(q.textContent).toBe("Where do the four small bodies come from?");
    expect(screen.getByText(/They come from its length\. At 75 minutes/)).toBeDefined();
    expect(screen.getByRole("button", { name: "What if the record were shorter? ▸" })).toBeDefined();
    expect(screen.queryByText(/median|dB|Hz/)).toBeNull();
  });

  it("trying it turns into a switch between the record and its other version", () => {
    const fake = mount({ scale: "album", alb: EWORLD, focus: "satellites" });
    openShape();
    fireEvent.click(screen.getByRole("button", { name: "What if the record were shorter? ▸" }));
    expect(fake.last("setCompare")?.args).toEqual([true]);
    act(() => fake.update({ compare: true }));
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("What if the record were shorter?");
    const shorter = screen.getByRole("button", { name: "Shorter" });
    expect(shorter.getAttribute("aria-pressed")).toBe("true");
    const said = screen.getAllByText(/two small bodies remain/);
    expect(said).toHaveLength(2);
    expect(said.some((el) => el.getAttribute("aria-live") === "polite")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "As it is" }));
    expect(fake.last("setCompare")?.args).toEqual([false]);
  });

  it("while peeking, the switch shows the record as it is", () => {
    const fake = mount({ scale: "album", alb: EWORLD, focus: "satellites" });
    openShape();
    fireEvent.click(screen.getByRole("button", { name: "What if the record were shorter? ▸" }));
    act(() => fake.update({ compare: true, peek: true }));
    expect(screen.getByRole("button", { name: "As it is" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("Escape inside the panel leaves the experiment", () => {
    const fake = mount({ scale: "album", alb: EWORLD, focus: "satellites" });
    openShape();
    fireEvent.click(screen.getByRole("button", { name: "What if the record were shorter? ▸" }));
    act(() => fake.update({ compare: true }));
    fireEvent.keyDown(screen.getByRole("tabpanel"), { key: "Escape" });
    expect(fake.last("setCompare")?.args).toEqual([false]);
    expect(screen.getByRole("button", { name: "What if the record were shorter? ▸" })).toBeDefined();
  });

  it("two more of the record's questions are at hand, and pointing one previews it", () => {
    const fake = mount({ scale: "album", alb: EWORLD, focus: "satellites" });
    openShape();
    const layers = screen.getByRole("button", { name: /Why does the ring have layers\?/ });
    fireEvent.focus(layers);
    expect(fake.last("previewAnatomy")?.args).toEqual(["strata"]);
    fireEvent.click(layers);
    expect(fake.last("setAnatomyFocus")?.args).toEqual(["strata"]);
  });

  it("the numbers stay one step away", () => {
    mount({ scale: "album", alb: EWORLD, focus: "satellites" });
    openShape();
    expect(screen.queryByText("Typical here")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /In numbers/ }));
    expect(screen.getByText("Typical here")).toBeDefined();
    expect(screen.getByText("34 min (median of the 14)")).toBeDefined();
    expect(screen.getByText("longest of 14")).toBeDefined();
    expect(screen.getByText("Bodies appear at")).toBeDefined();
    expect(screen.getByText("23 · 33 · 44 · 54 min")).toBeDefined();
    expect(screen.getByText(/The ring always makes one full turn/)).toBeDefined();
  });

  it("more about the shape holds the other questions and the plain facts", () => {
    mount({ scale: "album", alb: EWORLD, focus: "satellites" });
    openShape();
    fireEvent.click(screen.getByRole("button", { name: /More about this shape/ }));
    expect(screen.getByText(/The colours come from the cover/)).toBeDefined();
    expect(screen.getByText(/The name follows average loudness/)).toBeDefined();
  });

  it("a record close to the usual explains itself without an experiment", () => {
    mount({ scale: "album", alb: MKULTRA, focus: "core" });
    openShape();
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "What sets the size of its dark center?",
    );
    expect(screen.getByText(/nothing to compare/)).toBeDefined();
    expect(screen.queryByRole("button", { name: /What if/ })).toBeNull();
  });

  it("the invitation is the leading question, and opens it", () => {
    const fake = mount({
      scale: "album",
      alb: EWORLD,
      invite: { part: "satellites" },
    });
    expect(screen.getByText("Where do the four small bodies come from?")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Find out/ }));
    expect(fake.last("openAnatomy")).toBeDefined();
    expect(fake.last("setAnatomyFocus")?.args).toEqual(["satellites"]);
    const tab = screen.getByRole("tab", { name: "Why this shape?" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("the album list folds to one line while the shape is open, and unfolds on demand", () => {
    mount({ scale: "album", alb: EWORLD });
    openShape();
    const fold = screen.getByRole("button", { name: new RegExp(`${ALBUMS.length} albums`) });
    expect(fold.getAttribute("aria-expanded")).toBe("false");
    expect(fold.textContent).toContain(ALBUMS[EWORLD].artist);
    fireEvent.click(fold);
    expect(fold.getAttribute("aria-expanded")).toBe("true");
  });

  it("going back to the tracks releases the shape", () => {
    const fake = mount({ scale: "album", alb: EWORLD });
    openShape();
    fireEvent.click(screen.getByRole("tab", { name: "Tracks" }));
    expect(fake.last("closeAnatomy")).toBeDefined();
    expect(within(trackRail()).getByText(ALBUMS[EWORLD].tracks[0].title)).toBeDefined();
  });

  it("opening another question brings its title to the top of the panel", () => {
    const fake = mount({ scale: "album", alb: EWORLD, variant: "mobile", focus: "satellites" });
    openShape();
    const scroller = trackRail();
    const tabs = within(scroller).getByRole("tablist");
    Object.defineProperty(tabs, "offsetHeight", { configurable: true, value: 44 });
    scroller.scrollTop = 380;
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const top = this === scroller ? 300 : this.tagName === "SECTION" ? 120 : 0;
      return { top, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: top, toJSON() {} };
    });
    fireEvent.click(screen.getByRole("button", { name: /Next question/ }));
    act(() => fake.update({ focus: "strata" }));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 380 + 120 - 300 - 44, behavior: "smooth" });
    scrollTo.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /What if/ }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    rect.mockRestore();
  });

  it("the default view, before the engine starts, is the opening record", () => {
    render(<Instruments engine={null} />);
    expect(screen.getByText(`Collection · ${OPENING + 1}/${ALBUMS.length}`)).toBeDefined();
  });

  it("on touch it shows one question at a time with large targets", () => {
    const fake = mount({ scale: "album", alb: EWORLD, variant: "mobile", focus: "satellites" });
    openShape();
    for (const tab of screen.getAllByRole("tab")) expect(tab.className).toContain("min-h-[44px]");
    expect(screen.queryByText("Also")).toBeNull();
    const next = screen.getByRole("button", { name: /Next question/ });
    expect(next.className).toContain("min-h-[44px]");
    fireEvent.click(next);
    expect(fake.last("setAnatomyFocus")?.args).toEqual(["strata"]);
    fireEvent.click(screen.getByRole("button", { name: "What if the record were shorter? ▸" }));
    for (const b of within(screen.getByRole("group", { name: "Compare" })).getAllByRole("button")) {
      expect(b.className).toContain("min-h-[46px]");
    }
  });
});

describe("idle fade keeps the essentials readable", () => {
  const soft = (el: Element) => el.closest(".idle-soft") !== null;

  it("only secondary things fade: transport, time and the focused record stay whole", () => {
    mount({ idle: true });
    expect(screen.getByRole("button", { name: /Previous/ }).closest(".idle-soft")).toBeNull();
    expect(screen.getByRole("button", { name: /Play/ }).closest(".idle-soft")).toBeNull();
    expect(screen.getByRole("button", { name: /Next/ }).closest(".idle-soft")).toBeNull();
    expect(screen.getByText("00:00 / 00:00").closest(".idle-soft")).toBeNull();
    const rail = screen.getByRole("navigation", { name: "Albums" });
    const rows = within(rail).getAllByRole("button").slice(0, ALBUMS.length);
    const current = rows.filter((b) => b.getAttribute("aria-current"));
    expect(current).toHaveLength(1);
    expect(soft(current[0])).toBe(false);
    expect(rows.filter((b) => !b.getAttribute("aria-current")).every(soft)).toBe(true);
  });

  it("the fade is scoped to marked elements, never the whole layer", () => {
    mount({ idle: true });
    const style = document.querySelector("[data-instruments] style")!.textContent ?? "";
    expect(style).toContain("[data-instruments][data-idle] .idle-soft");
    expect(style).not.toMatch(/\[data-instruments\]\[data-idle\]\{opacity/);
  });
});

describe("controls read as controls", () => {
  it("actions are brighter than passive information, and time does not jitter", () => {
    mount();
    for (const name of [/Previous/, /Next/]) {
      expect(screen.getByRole("button", { name }).className).toContain("text-ink-text-2");
    }
    const time = screen.getByText("00:00 / 00:00");
    expect(time.className).toContain("tabular-nums");
    expect(time.className).not.toContain("text-ink-faint");
  });

  it("playing is told by words and glyph, not only by colour", () => {
    mount({ mode: "playing", playAlb: OPENING, alb: OPENING });
    const play = screen.getByRole("button", { name: /Pause/ });
    expect(play.getAttribute("aria-pressed")).toBe("true");
    expect(play.textContent).toMatch(/❙❙/);
  });
});
