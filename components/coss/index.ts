/** coss ui — слой для НОВОГО кода.
 *
 *  ЧТО ЗДЕСЬ. Импорты coss-нативных компонентов, копии из реестра. По
 *  контракту они отличаются от шима в `components/ui/*`:
 *    - варианты coss: default/destructive/destructive-outline/ghost/outline/
 *      secondary/link; старый шим знал success/subtle, мапящиеся на default
 *      и outline соответственно;
 *    - кнопка coss понимает `loading`; шим — нет (loading пробрасывали сами);
 *    - слот RAC-стиля (`slot="close"`) заменён на coss `data-slot` —
 *      компонент сам вешает нужный; ручной `slot` уже не нужен.
 *
 *  КОГДА СЮДА ИДТИ. Новый код. Существующие 388 файлов импортируют старый
 *  шим и НЕ ТРОГАЮТСЯ: миграция конкретного потребителя — отдельная
 *  инициатива с собственным PR, иначе это разовая правка ~25–30 файлов
 *  с риском зашить coss-API в места, где живёт RAC-API (useRender vs
 *  data-slot, onPress vs onClick).
 *
 *  КОГДА ШИМ УЙДЁТ. Когда все 25 файлов, импортирующих
 *  `react-aria-components` напрямую, переписаны — `components/ui/*` и
 *  `components/rac/*` можно удалить, и coss-слой либо остаётся как есть,
 *  либо его файлы переезжают в `components/ui/`.
 */
export { Button, buttonVariants, type ButtonProps } from "./Button";
export { Spinner } from "./Spinner";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardPanel,
  CardContent,
  CardAction,
  CardFooter,
} from "./Card";
export { Input, type InputProps } from "./Input";
export { Label } from "./Label";
export { Textarea, type TextareaProps } from "./Textarea";
export { Checkbox, CheckboxPrimitive } from "./Checkbox";
export { Switch, SwitchPrimitive } from "./Switch";
export { Badge, badgeVariants, type BadgeProps } from "./Badge";
export { Skeleton } from "./Skeleton";
export { Separator } from "./Separator";
