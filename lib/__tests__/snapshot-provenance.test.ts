import { describe, expect, it } from "vitest";
import { shouldApplySnapshot, snapshotIdentity } from "../snapshot";
import type { Snapshot } from "../types";

const canonical = (provider: string, revision: string, generated_at: string) => ({
  source: "local_antidetect_scan",
  provider,
  snapshot_revision: revision,
  generated_at,
  profiles: {},
}) as Snapshot;

describe("snapshot provenance", () => {
  it("identifies a canonical provider-scoped revision", () => {
    expect(snapshotIdentity(canonical("adspower", "r1", "2026-01-01T00:00:00Z")))
      .toEqual({ provider: "adspower", revision: "r1" });
  });

  it("does not let newer OAuth/composite replace Snapshot base", () => {
    const current = canonical("adspower", "r1", "2026-01-01T00:00:00Z");
    const oauth = { generated_at: "2027-01-01T00:00:00Z", profiles: {} } as Snapshot;
    expect(shouldApplySnapshot(current, oauth)).toBe(false);
  });

  it("does not let the other provider replace the active provider", () => {
    const current = canonical("adspower", "r1", "2026-01-01T00:00:00Z");
    const other = canonical("adspower", "r2", "2027-01-01T00:00:00Z");
    expect(shouldApplySnapshot(current, other)).toBe(false);
  });

  it("accepts the next revision from the same provider regardless of clock skew", () => {
    const current = canonical("adspower", "r1", "2026-01-02T00:00:00Z");
    const next = canonical("adspower", "r2", "2026-01-01T00:00:00Z");
    expect(shouldApplySnapshot(current, next)).toBe(true);
  });
});
