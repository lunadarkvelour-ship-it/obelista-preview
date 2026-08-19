/**
 * Выделенное в дереве → готовые вызовы MCP-тула `manage`.
 *
 * Формат продиктован самим тулом (`server.py:417-432`), а не удобством:
 *
 *  - `profile_name` — ОДНА строка на вызов. Значит N соцев = N вызовов, и
 *    группировка по соцам это не оформление, а требование.
 *  - `object_ids` — плоский массив, микс уровней легален: Graph сам понимает,
 *    кампания это, адсет или объявление (`server.py:1031`).
 *  - Дедуп по предкам обязателен: Мета гасит каскадом, и слать вместе с
 *    кампанией её объявления значит утроить список и получить мусор в ответе.
 *  - `profile_name` — строго profile_id, никогда имя команды. `find_profile`
 *    (`core/config.py:94-108`) при частичном совпадении вернёт ПЕРВЫЙ профиль
 *    команды, молча и не тот: на `keine` это был бы k1ecjt33, который трогать
 *    нельзя вовсе.
 *
 * Рядом с вызовами едет `дерево` — не для исполнения, а чтобы модель понимала,
 * что именно тушит, и могла отчитаться словами. И `не_потушить`: про
 * пропущенное юзер обязан узнать в панели, а не из отказа Меты.
 */
import type { Node } from "./analytics-tree";

export interface ManageCall {
  profile_name: string;
  object_ids: string[];
}

export interface Unreachable {
  act_id: string;
  причина: string;
  объектов: number;
}

export interface ManagePayload {
  версия: 1;
  действие?: "pause" | "activate";
  период: { since: string; until: string };
  /** «объектов», а не «объявлений»: в выделение попадают и кампании, и адсеты,
   *  и целые кабинеты. */
  итого: {
    объектов: number; кабов: number; соцев: number; спенд: number; ftd: number;
  };
  вызовы: ManageCall[];
  не_потушить: Unreachable[];
  дерево: Array<Record<string, unknown>>;
}

/** Отметки собираются обходом ДЕРЕВА, а не текущего плоского списка: узел в
 *  свёрнутой ветке отмечен ровно так же, как видимый, и молча терять его
 *  нельзя. Старый BulkBar собирал их по `byId` от `flat` — и отметки свёрнутых
 *  веток тихо выпадали из подсчёта, оставаясь в `selected`. */
export function collectSelected(roots: Node[], selected: Set<string>): Node[] {
  const out: Node[] = [];
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (selected.has(n.id)) out.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(roots);
  return out;
}

function contains(parent: Node, id: string): boolean {
  for (const c of parent.children || []) {
    if (c.id === id || contains(c, id)) return true;
  }
  return false;
}

/** id объекта, который `manage` умеет ВЫКЛЮЧИТЬ. Это кампания, адсет или
 *  объявление — то, у чего есть `fb_id`.
 *
 *  Кабинет сюда не входит, хотя act_id у него есть. `manage` делает
 *  `POST /{id} {status: PAUSED}` (`server.py:1035`), а рекламный кабинет так не
 *  выключается — Мета ответит ошибкой на каждый act_. Пока кабинет считался
 *  объектом, он ещё и заслонял собой всё, что под ним: выделил каб — в вызов
 *  уезжал один act_id вместо кампаний, которые реально надо потушить.
 *
 *  Крео тоже не объект: это наша сущность, склеенная атрибуцией поверх чужих
 *  объявлений. */
function objectId(n: Node): string | null {
  return n.fb_id ?? null;
}

/** Потомок отмеченного предка выбрасывается: Мета гасит каскадом, а лишние id
 *  в ответе тула превращаются в шум, по которому не понять, что реально упало.
 *
 *  Заслонять может только узел, у которого ЕСТЬ свой объект в Мете. Крео — не
 *  объект: это наша сущность, склеенная атрибуцией поверх чужих объявлений.
 *  Если считать его предком наравне с остальными, отметка целого крео (а это
 *  четыре сотни узлов) схлопнулась бы к одному крео, у которого нет id, — и в
 *  `manage` уехал бы пустой список. Проверено: до этой правки так и было. */
export function dedupeByAncestor(nodes: Node[]): Node[] {
  return nodes.filter(
    (n) => !nodes.some((o) => o !== n && objectId(o) && contains(o, n.id)),
  );
}

function sum(nodes: Node[], key: "spend" | "ftd"): number {
  return nodes.reduce((s, n) => s + (n[key] ?? 0), 0);
}

export function buildManagePayload(
  nodes: Node[],
  opts: { action?: "pause" | "activate"; since: string; until: string },
): ManagePayload {
  const kept = dedupeByAncestor(nodes).filter((n) => objectId(n));

  const bySoc = new Map<string, string[]>();
  const blocked = new Map<string, Unreachable>();
  const reachable: Node[] = [];

  for (const n of kept) {
    const id = objectId(n)!;
    const owner = n.owner ?? null;
    const act = n.act_id ?? "?";

    if (!owner) {
      const cur = blocked.get(act);
      blocked.set(act, {
        act_id: act, причина: "соц не подключён", объектов: (cur?.объектов ?? 0) + 1,
      });
      continue;
    }

    reachable.push(n);
    const arr = bySoc.get(owner);
    if (arr) arr.push(id);
    else bySoc.set(owner, [id]);
  }

  return {
    версия: 1,
    ...(opts.action ? { действие: opts.action } : {}),
    период: { since: opts.since, until: opts.until },
    итого: {
      объектов: reachable.length,
      кабов: new Set(reachable.map((n) => n.act_id)).size,
      соцев: bySoc.size,
      спенд: +sum(reachable, "spend").toFixed(2),
      ftd: sum(reachable, "ftd"),
    },
    // Порядок фиксирован по имени соца: иначе слепок контрактного теста прыгал
    // бы между прогонами, и в диффе было бы не видно, что реально изменилось.
    вызовы: [...bySoc.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([profile_name, object_ids]) => ({ profile_name, object_ids })),
    не_потушить: [...blocked.values()].sort((a, b) => a.act_id.localeCompare(b.act_id)),
    дерево: kept.map(shallow),
  };
}

/** Узел для чтения человеком и моделью: имя, статус, деньги — без детей глубже
 *  одного уровня, иначе payload раздувается на сотни килобайт и перестаёт
 *  влезать в окно. */
function shallow(n: Node): Record<string, unknown> {
  return {
    уровень: n.kind,
    id: objectId(n),
    имя: n.label,
    каб: n.act_id ?? null,
    соц: n.owner ?? null,
    статус: n.status ?? null,
    // Округляем: суммы копеек дают хвосты вида 95.24000000000001, и модель,
    // читающая payload, начинает переспрашивать про точность цифр.
    спенд: n.spend == null ? null : +n.spend.toFixed(2),
    ftd: n.ftd,
    объявлений: n.ads,
  };
}

const PREAMBLE = `Ниже готовые вызовы MCP-тула manage из панели Obelista.

Выполни каждый элемент "вызовы" ОТДЕЛЬНЫМ вызовом manage: profile_name и
object_ids брать как есть. Ничего не пересобирай и не досочиняй — id уже
сверены с базой, а profile_name это profile_id, не имя команды.

Блок "дерево" — только для понимания, что именно трогаем, исполнять его не
надо. Блок "не_потушить" — то, что панель сделать не может: скажи про него
словами и не пытайся обойти.`;

export function payloadText(p: ManagePayload): string {
  return PREAMBLE + "\n\n" + JSON.stringify(p, null, 2);
}
