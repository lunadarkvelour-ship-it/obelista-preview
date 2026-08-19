import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/lib/store";
import type { GroupMember } from "@/lib/types";

/* Группы кабинетов: дубль и разлив ссылки по соцу.
 *
 * Обе операции опасны молча. Дубль, сделанный по ссылке на тот же массив,
 * выглядит правильно ровно до первой правки в копии — а потом оказывается, что
 * менялся оригинал, и залив ушёл не туда. Разлив, не проверяющий соц, ставит
 * чужую ссылку на чужие кабинеты: трафик поедет в чужую статистику, и заметить
 * это можно будет только по нулям в отчёте через сутки.
 */

const m = (profile: string, act: string): GroupMember => ({ profile, act });

function собратьГруппу(members: GroupMember[]): string {
  useStore.getState().setCabSelection(members);
  const id = useStore.getState().createGroupFromSelection("Алжир");
  if (!id) throw new Error("группа не создалась");
  return id;
}

beforeEach(() => {
  useStore.setState({ cabGroups: [], cabSelection: [], activeGroup: null });
});

describe("дубль группы", () => {
  it("копия уносит состав, форму и переопределения по кабинетам", () => {
    const id = собратьГруппу([m("k1a", "act_1"), m("k1a", "act_2")]);
    useStore.getState().setMemberField(id, m("k1a", "act_1"), "link", "https://t.me/один");
    useStore.getState().setGroupField(id, "creoUrl", "sub=X");

    useStore.getState().duplicateCabGroup(id);
    const [src, copy] = useStore.getState().cabGroups;

    expect(copy.members).toHaveLength(2);
    expect(copy.members[0].link).toBe("https://t.me/один");
    expect(copy.form.creoUrl).toBe("sub=X");
    expect(copy.id).not.toBe(src.id);
  });

  it("правка в копии не трогает оригинал", () => {
    /* Тот самый молчаливый провал: члены скопированы ссылкой, всё выглядит
       верно, а залив оригинала уходит с чужой ссылкой. */
    const id = собратьГруппу([m("k1a", "act_1")]);
    useStore.getState().duplicateCabGroup(id);
    const copyId = useStore.getState().cabGroups[1].id;

    useStore.getState().setMemberField(copyId, m("k1a", "act_1"), "tail", "sub=копия");

    expect(useStore.getState().cabGroups[0].members[0].tail).toBeFalsy();
    expect(useStore.getState().cabGroups[1].members[0].tail).toBe("sub=копия");
  });

  it("копии нумеруются подряд, а не называются одинаково", () => {
    const id = собратьГруппу([m("k1a", "act_1")]);
    useStore.getState().duplicateCabGroup(id);
    useStore.getState().duplicateCabGroup(id);
    expect(useStore.getState().cabGroups.map((g) => g.name)).toEqual([
      "Алжир", "Алжир copy1", "Алжир copy2",
    ]);
  });

  it("копия копии продолжает нумерацию, а не удваивает суффикс", () => {
    const id = собратьГруппу([m("k1a", "act_1")]);
    useStore.getState().duplicateCabGroup(id);
    const copy1 = useStore.getState().cabGroups[1].id;
    useStore.getState().duplicateCabGroup(copy1);
    expect(useStore.getState().cabGroups.map((g) => g.name)).toEqual([
      "Алжир", "Алжир copy1", "Алжир copy2",
    ]);
  });

  it("удалил copy1, сделал новую — она copy2, а не занятое имя", () => {
    /* Иначе два разных набора кабинетов в разное время окажутся под одним
       именем, а группу выбирают именно по имени. */
    const id = собратьГруппу([m("k1a", "act_1")]);
    useStore.getState().duplicateCabGroup(id);
    useStore.getState().duplicateCabGroup(id);
    useStore.getState().deleteCabGroup(useStore.getState().cabGroups[1].id);
    useStore.getState().duplicateCabGroup(id);
    const имена = useStore.getState().cabGroups.map((g) => g.name);
    expect(new Set(имена).size).toBe(имена.length);
    expect(имена).toContain("Алжир copy3");
  });
});

describe("разлив ссылки по соцу", () => {
  it("ставит ссылку и хвост всем кабинетам ТОГО ЖЕ соца", () => {
    const id = собратьГруппу([m("k1a", "act_1"), m("k1a", "act_2"), m("k1a", "act_3")]);
    useStore.getState().setMemberField(id, m("k1a", "act_1"), "link", "https://t.me/офер");
    useStore.getState().setMemberField(id, m("k1a", "act_1"), "tail", "sub=abc");

    useStore.getState().applyMemberLinkToProfile(id, useStore.getState().cabGroups[0].members[0]);

    for (const мем of useStore.getState().cabGroups[0].members) {
      expect(мем.link).toBe("https://t.me/офер");
      expect(мем.tail).toBe("sub=abc");
    }
  });

  it("кабинеты ЧУЖОГО соца не трогает", () => {
    /* Главное обещание кнопки. Ссылка и хвост — это трекер и его метки, у
       каждого профиля свои: разлив на всю группу отправил бы трафик в чужую
       статистику. */
    const id = собратьГруппу([m("k1a", "act_1"), m("k1b", "act_9")]);
    useStore.getState().setMemberField(id, m("k1a", "act_1"), "link", "https://t.me/офер");
    useStore.getState().applyMemberLinkToProfile(id, useStore.getState().cabGroups[0].members[0]);

    const чужой = useStore.getState().cabGroups[0].members.find((x) => x.profile === "k1b")!;
    expect(чужой.link).toBeFalsy();
  });

  it("пустая ссылка тоже разливается — это сброс, а не «ничего не делать»", () => {
    /* Иначе кнопкой нельзя снять переопределения разом, а именно это и нужно,
       когда связка возвращается к общей ссылке. */
    const id = собратьГруппу([m("k1a", "act_1"), m("k1a", "act_2")]);
    useStore.getState().setMemberField(id, m("k1a", "act_2"), "link", "https://t.me/старое");
    useStore.getState().applyMemberLinkToProfile(id, useStore.getState().cabGroups[0].members[0]);
    expect(useStore.getState().cabGroups[0].members[1].link).toBe("");
  });

  it("другие группы не задеты", () => {
    const a = собратьГруппу([m("k1a", "act_1")]);
    useStore.getState().setCabSelection([m("k1a", "act_5")]);
    useStore.getState().createGroupFromSelection("Египет");
    useStore.getState().setMemberField(a, m("k1a", "act_1"), "link", "https://t.me/офер");
    useStore.getState().applyMemberLinkToProfile(a, useStore.getState().cabGroups[0].members[0]);

    const другая = useStore.getState().cabGroups.find((g) => g.name === "Египет")!;
    expect(другая.members[0].link).toBeFalsy();
  });
});
