import { describe, expect, it } from "vitest";
import { accountRows } from "@/lib/account-rows";
import { fieldEvidence, unifiedAccounts, type CloudAccountRow } from "@/lib/cloud-accounts";
import {
  buildBundle, bundleJson, membershipIssues, newGroup, snapshotMember,
} from "@/lib/groups";
import { useStore } from "@/lib/store";
import type { BuildCtx, Snapshot } from "@/lib/types";

const snapshot: Snapshot = {
  source: "local_antidetect_scan",
  provider: "shardx",
  snapshot_revision: "rev-7",
  generated_at: "2026-08-17T17:00:00Z",
  profiles: {
    p1: {
      label: "Buyer one",
      pages: [{ id: "page-1", name: "One Page", published: true, instagram: "one.ig" }],
      accounts: [{
        id: "act_1", name: "Cab one", status: "ACTIVE", spent: "1.00 USD",
        pixels: [{ id: "px-1", name: "Pixel one", last_fired_time: "2026-08-17T16:00:00Z" }],
      }],
    },
    p2: {
      label: "Buyer two",
      pages: [{ id: "page-2", name: "Two Page", published: false, instagram_id: "ig-2" }],
      accounts: [{ id: "act_2", name: "Cab two", pixels: [{ id: "px-2", name: "Pixel two" }] }],
    },
  },
};

const ctx = (snap: Snapshot): BuildCtx => ({
  tags: {}, profiles: [], catalogAll: {}, lichka: {}, snapshot: snap,
});

describe("snapshot graph keeps one exact provenance chain", () => {
  it("carries provider, revision, profile, account, pixel and Page into the bundle", () => {
    const group = newGroup("g", "Exact", [
      { ...snapshotMember("p1", "act_1", snapshot), pixel: "px-1" },
      { ...snapshotMember("p2", "act_2", snapshot), pixel: "px-2" },
    ]);
    group.pageByProfile = { p1: "page-1", p2: "page-2" };

    const items = buildBundle([group], ctx(snapshot));
    expect(items.map((x) => [x.profile, x.accounts, x.pixel, x.page])).toEqual([
      ["p1", ["act_1"], "px-1", "page-1"],
      ["p2", ["act_2"], "px-2", "page-2"],
    ]);
    expect(items.map((x) => x.spec.page)).toEqual(["page-1", "page-2"]);
    expect(bundleJson(items, snapshot.generated_at || "")).toMatchObject({
      snapshot: {
        source: "local_antidetect_scan",
        provider: "shardx",
        snapshot_revision: "rev-7",
      },
      bundles: [
        { provider: "shardx", provider_profile_id: "p1", snapshot_revision: "rev-7" },
        { provider: "shardx", provider_profile_id: "p2", snapshot_revision: "rev-7" },
      ],
    });
  });

  it("fails closed when the PROVIDER changes instead of rebinding", () => {
    const group = newGroup("g", "Exact", [snapshotMember("p1", "act_1", snapshot)]);
    const чужой = { ...snapshot, provider: "adspower" };
    expect(membershipIssues(group, чужой)).toEqual([
      "snapshot provider mismatch for act_1: group shardx, current adspower",
    ]);
    expect(buildBundle([group], ctx(чужой))).toEqual([]);
  });

  it("fails closed when the ad account is gone from the current snapshot", () => {
    const group = newGroup("g", "Exact", [snapshotMember("p1", "act_1", snapshot)]);
    const без = {
      ...snapshot,
      snapshot_revision: "rev-8",
      profiles: { ...snapshot.profiles, p1: { ...snapshot.profiles!.p1, accounts: [] } },
    };
    expect(membershipIssues(group, без)).toEqual([
      "ad account missing from snapshot revision: act_1",
    ]);
    expect(buildBundle([group], ctx(без))).toEqual([]);
  });

  /* НОВАЯ РЕВИЗИЯ ТОГО ЖЕ ПРОВАЙДЕРА — ЭТО ТОТ ЖЕ ПАРК, А НЕ ЧУЖОЙ.
     Здесь стояло обратное: любая смена ревизии роняла группу закрыто. Но
     ревизия меняется при КАЖДОЙ пересборке снапшота, то есть после первого же
     `refresh_snapshot` все уже собранные группы переставали резолвиться разом
     — пиксели исчезали со всех строк, кабинеты числились «не в снапшоте», а
     кнопка сборки промпта не работала, и починить это было нечем.
     Провайдер и соц связывать не перестали (случаи выше). */
  it("re-binds to a newer revision of the same provider and re-stamps the member", () => {
    const group = newGroup("g", "Exact", [snapshotMember("p1", "act_1", snapshot)]);
    const свежий = { ...snapshot, snapshot_revision: "rev-8", generated_at: "2026-08-18T09:00:00Z" };

    expect(membershipIssues(group, свежий)).toEqual([]);
    const items = buildBundle([group], ctx(свежий));
    expect(items.map((x) => [x.profile, x.accounts])).toEqual([["p1", ["act_1"]]]);

    /* Ревизия в бандле — ТЕКУЩАЯ, а не та, при которой группу собрали: её
       перештамповывает `setSnapshot`. Иначе JSON обещал бы движку парк,
       которого больше нет. */
    useStore.setState({ cabGroups: [group], snapshot });
    useStore.getState().setSnapshot(свежий);
    const [обновлённый] = useStore.getState().cabGroups;
    expect(обновлённый.members[0]).toMatchObject({
      provider: "shardx", snapshot_revision: "rev-8", snapshot_generated_at: "2026-08-18T09:00:00Z",
    });
    expect(bundleJson(buildBundle([обновлённый], ctx(свежий)), "")).toMatchObject({
      snapshot: { provider: "shardx", snapshot_revision: "rev-8" },
    });
  });

  it("a member of ANOTHER provider is never re-stamped onto this park", () => {
    const чужой = newGroup("g", "Alien", [
      { profile: "p1", act: "act_1", source: "snapshot", provider: "adspower",
        provider_profile_id: "p1", snapshot_revision: "old" },
    ]);
    useStore.setState({ cabGroups: [чужой], snapshot: null });
    useStore.getState().setSnapshot(snapshot);
    expect(useStore.getState().cabGroups[0].members[0]).toMatchObject({
      provider: "adspower", snapshot_revision: "old",
    });
  });
});

describe("OAuth enriches fields but never snapshot membership", () => {
  const cloud: CloudAccountRow[] = [
    {
      act_id: "act_1", name: "Cab one from OAuth", status: "ACTIVE", amount_spent: 999,
      status_checked_at: "2026-08-17T17:05:00Z",
      owners: [{ profile_id: "p1", vendor: "shardx", oauth: true, in_antidetect: true }],
    },
    {
      act_id: "act_cloud_only", name: "Must stay out",
      owners: [{ profile_id: "p1", vendor: "shardx", oauth: true, in_antidetect: true }],
    },
  ];

  it("enriches only an exact provider/profile match and records field evidence", () => {
    const rows = unifiedAccounts(accountRows(snapshot), cloud, { membership: "snapshot" });
    expect(rows.map((x) => x.act_id)).toEqual(["act_1", "act_2"]);
    expect(rows[0]).toMatchObject({
      name: "Cab one from OAuth", amount_spent: 999, inSnapshot: true, inCloud: true,
      membership: { source: "snapshot", provider: "shardx", providerProfileId: "p1" },
    });
    expect(fieldEvidence(rows[0], "amount_spent")).toBe("oauth · 2026-08-17T17:05:00Z");
    expect(rows[0].pixels).toEqual(snapshot.profiles?.p1.accounts?.[0].pixels);
  });

  it("keeps snapshot data unchanged when provider identity is absent or wrong", () => {
    const wrong = cloud.map((row) => ({
      ...row,
      owners: row.owners?.map((owner) => ({ ...owner, vendor: "adspower" })),
    }));
    const rows = unifiedAccounts(accountRows(snapshot), wrong, { membership: "snapshot" });
    expect(rows[0]).toMatchObject({ name: "Cab one", amount_spent: 100, inCloud: false });
    expect(fieldEvidence(rows[0], "amount_spent")).toBe("snapshot · 2026-08-17T17:00:00Z");
  });
});
