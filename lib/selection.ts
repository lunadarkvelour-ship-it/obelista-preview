/**
 * Каскадное выделение строк дерева аналитики.
 *
 * Множество отмеченного (`Set<string>` из id узлов) держится в одном
 * инварианте: ветка лежит в множестве тогда и только тогда, когда в нём лежат
 * все её дети. Инвариант не косметический — он нужен экспорту в `manage`:
 * отмеченная ветка уезжает туда ОДНИМ fb_id и тушится каскадом вместе со всем
 * содержимым. Если оставить отмеченным предка, у которого юзер снял одного
 * ребёнка, `manage` погасит и этого ребёнка тоже — то есть больше, чем просили.
 *
 * Все функции чистые и возвращают новый Set: множество живёт в сторе, а стор
 * сравнивает ссылки, чтобы понять, надо ли перерисовывать таблицу.
 */
import type { Node } from "./analytics-tree";

export type NodeState = "on" | "off" | "part";

/** Ветка ли это. Пустой массив детей считаем листом: иначе такой узел был бы
 *  одновременно «все дети отмечены» и «все дети сняты». */
function hasKids(n: Node): boolean {
  return !!n.children && n.children.length > 0;
}

/** Путь от корня до узла включительно — нужен, чтобы после правки пройти
 *  предков снизу вверх. Возвращает null, если id в дереве нет. */
function findPath(roots: Node[], id: string): Node[] | null {
  for (const root of roots) {
    if (root.id === id) return [root];
    if (root.children) {
      const sub = findPath(root.children, id);
      if (sub) return [root, ...sub];
    }
  }
  return null;
}

/** Ставит/снимает узел и всё поддерево под ним. */
function applyDown(n: Node, on: boolean, acc: Set<string>): void {
  if (on) acc.add(n.id);
  else acc.delete(n.id);
  for (const kid of n.children ?? []) applyDown(kid, on, acc);
}

/**
 * Отметить (`on: true`) или снять (`on: false`) узел `id`: каскад вниз на всё
 * поддерево плюс пересчёт предков вверх по инварианту «предок отмечен, только
 * если отмечены все его дети».
 *
 * Пересчитываем только предков задетого узла, а не всё дерево: соседние ветки
 * трогать нельзя — юзер их не касался.
 */
export function cascadeSelect(
  roots: Node[],
  id: string,
  on: boolean,
  cur: Set<string>,
): Set<string> {
  const next = new Set(cur);
  const path = findPath(roots, id);
  if (!path) return next;

  applyDown(path[path.length - 1], on, next);

  // Снизу вверх: состояние предка зависит от уже пересчитанного уровня ниже.
  for (let i = path.length - 2; i >= 0; i--) {
    const anc = path[i];
    const kids = anc.children ?? [];
    if (kids.length > 0 && kids.every((k) => next.has(k.id))) next.add(anc.id);
    else next.delete(anc.id);
  }
  return next;
}

/**
 * Состояние галки узла. Промежуточное `part` существует ради честности
 * картинки: без него ветка с одним снятым объявлением рисовалась бы пустой
 * галкой, юзер отметил бы её целиком «чтобы наверняка» и потушил бы лишнее.
 *
 * У ветки состояние выводится из детей, а не из наличия её id в множестве:
 * при соблюдённом инварианте это одно и то же, но выводить надёжнее — на
 * множестве, собранном мимо каскада (Shift-диапазон), картинка всё равно
 * останется верной.
 */
export function nodeState(n: Node, sel: Set<string>): NodeState {
  if (!hasKids(n)) return sel.has(n.id) ? "on" : "off";

  let on = 0;
  let off = 0;
  for (const kid of n.children!) {
    const st = nodeState(kid, sel);
    if (st === "part") return "part";
    if (st === "on") on++;
    else off++;
  }
  if (off === 0) return "on";
  if (on === 0) return "off";
  return "part";
}

/**
 * Shift-клик: добавить в отметку все строки от `from` до `to` включительно.
 *
 * Порядок берём из `flatIds` — это ВИДИМЫЙ порядок строк с учётом свёрнутых
 * веток. Считать диапазон по дереву нельзя: юзер выделяет «отсюда досюда на
 * экране», и в диапазон не должно попасть то, что сейчас скрыто под свёрнутым
 * родителем. Направление клика не важно — границы нормализуем.
 */
export function rangeSelect(
  flatIds: string[],
  from: string,
  to: string,
  cur: Set<string>,
): Set<string> {
  const next = new Set(cur);
  const a = flatIds.indexOf(from);
  const b = flatIds.indexOf(to);
  // Строка могла уехать из видимых (свернули ветку, сменился фильтр) — тогда
  // диапазона нет, и молча ничего не выделяем, вместо выделения «до конца».
  if (a < 0 || b < 0) return next;

  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(flatIds[i]);
  return next;
}
