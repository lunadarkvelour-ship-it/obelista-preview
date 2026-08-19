import { describe, expect, it } from "vitest";
import { PLACEMENTS, RAW, parsePositions, splitPositions } from "@/lib/placements";

/* Проверяется одна вещь: панель не может отправить платформе имя позиции,
   которого у той не существует. Именно на этом дважды сгорал залив целиком —
   28.07 (16 кабов, 48 отказов) и 29.07 (10 кабов, 30 отказов, 0 объектов). */

describe("перевод позиций по платформам", () => {
  it("лента у FB это feed, у IG — stream", () => {
    const s = splitPositions(["feed"]);
    expect(s.facebook).toEqual(["feed"]);
    expect(s.instagram).toEqual(["stream"]);
  });

  it("рилсы у FB это facebook_reels, у IG — reels", () => {
    const s = splitPositions(["reels"]);
    expect(s.facebook).toEqual(["facebook_reels"]);
    expect(s.instagram).toEqual(["reels"]);
  });

  it("сторис называются одинаково и уходят обеим", () => {
    const s = splitPositions(["story"]);
    expect(s.facebook).toEqual(["story"]);
    expect(s.instagram).toEqual(["story"]);
  });

  /* Строка из старых пресетов и из прошлого плейсхолдера панели. Раньше она
     уходила в обе платформы как есть и убивала каждый адсет. */
  it("старая строка «feed, story, reels» раскладывается правильно", () => {
    const s = splitPositions(parsePositions("feed, story, reels"));
    expect(s.facebook).toEqual(["feed", "story", "facebook_reels"]);
    expect(s.instagram).toEqual(["stream", "story", "reels"]);
    expect(s.unknown).toEqual([]);
  });

  it("позиция только одной платформы другой не достаётся", () => {
    const s = splitPositions(["explore", "marketplace"]);
    expect(s.instagram).toEqual(["explore"]);
    expect(s.facebook).toEqual(["marketplace"]);
  });

  it("готовое имя FB принимается как есть и не дублируется", () => {
    const s = splitPositions(["stream", "feed"]);
    expect(s.instagram).toEqual(["stream"]);
    expect(s.facebook).toEqual(["feed"]);
  });

  it("выдуманное имя не уезжает в спеку, но и не теряется молча", () => {
    const s = splitPositions(["лента", "feed"]);
    expect(s.unknown).toEqual(["лента"]);
    expect(s.facebook).toEqual(["feed"]);
  });

  it("каждое имя из словаря есть в белом списке своей платформы", () => {
    for (const p of PLACEMENTS) {
      for (const plat of ["facebook", "instagram", "messenger", "audience_network"] as const) {
        const v = p[plat];
        if (v) expect(RAW[plat]).toContain(v);
      }
    }
  });
});
