"use client";

import { useFormScope } from "@/components/studio/form-scope";
import { SectionCard, Row, Grow, Hint } from "@/components/studio/fields";
import { SelectField } from "@/components/studio/control";
import { Input } from "@/components/coss";
import { resolveSnapshotMember } from "@/lib/groups";
import { useStore } from "@/lib/store";

export function PageOffer() {
  const { form, set, scope, goStep } = useFormScope();
  const snapshot = useStore((s) => s.snapshot);
  const group = useStore((s) => s.cabGroups.find((g) => g.id === s.activeGroup) || null);
  const setGroupPage = useStore((s) => s.setGroupPage);
  const profiles = group ? [...new Set(group.members.map((m) => m.profile))] : [];
  const snapshotGroup = !!group?.members.length
    && group.members.every((member) => member.source === "snapshot");

  const pageOptions = (profile: string) => {
    const exact = group?.members
      .filter((m) => m.profile === profile)
      .every((m) => resolveSnapshotMember(m, snapshot).status === "exact");
    if (!exact) return null;
    return snapshot?.profiles?.[profile]?.pages || [];
  };

  return (
    <SectionCard index="07" id="page" title="Page and offer">
      {scope === "group" && group && snapshotGroup ? (
        profiles.map((profile) => {
          const pages = pageOptions(profile);
          return (
            <Row key={profile} label={`Page · ${profile}`}>
              <Grow>
                {pages ? (
                  <SelectField
                    label={`Page for profile ${profile}`}
                    value={group.pageByProfile?.[profile] || form.page}
                    onChange={(value) => setGroupPage(group.id, profile, value)}
                    options={[
                      { value: "auto", label: "auto — first available Page" },
                      { value: "rotate", label: "rotate — cycle available Pages" },
                      ...pages.map((page) => ({
                        value: page.id,
                        label: `${page.name || page.id}${page.published === false ? " · unpublished" : ""}${page.instagram ? ` · @${page.instagram}` : ""}`,
                        text: `${page.id} ${page.name || ""} ${page.instagram || ""}`,
                      })),
                    ]}
                  />
                ) : (
                  <span className="text-2xs italic text-muted-foreground">
                    exact provider and snapshot revision no longer match — reselect the ad accounts
                  </span>
                )}
              </Grow>
              <Hint className="flex-[0_0_auto]">
                {pages ? `${pages.length} from this profile` : "selection blocked"}
              </Hint>
            </Row>
          );
        })
      ) : (
        <Row label="Page">
          <Grow>
            <Input value={form.page} onChange={(e) => set("page", e.target.value)} />
          </Grow>
          <Hint className="flex-[0_0_auto]">auto / rotate / id</Hint>
        </Row>
      )}
      <Row label="Link">
        <Grow>
          <Input value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://land.com" />
        </Grow>
      </Row>
      {/* Ссылка одна на связку, но кабы чужого агентства ведут на свой лендинг —
          и переопределяются там же, где их пиксель. */}
      {scope === "group" && (
        <Hint>
          an individual ad account can have its own —{" "}
          <button
            onClick={() => goStep?.("cabs")}
            className="underline decoration-border underline-offset-4 transition-colors duration-150 hover:text-foreground hover:decoration-foreground"
          >
            Ad accounts step
          </button>
        </Hint>
      )}
    </SectionCard>
  );
}
