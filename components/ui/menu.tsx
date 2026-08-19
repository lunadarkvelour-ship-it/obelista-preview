"use client";

/** Меню = coss Menu.Root/Trigger/Portal/Positioner/Popup/Item под RAC-обёрткой.
 *
 *  Наружу — старый RAC-контракт: `<MenuTrigger><trigger /><Menu onAction={...}>
 *  <MenuItem id="x" textValue="...">...</MenuItem></Menu></MenuTrigger>`.
 *
 *  Внутри — coss. Чтобы `onAction` на Menu дозвался до клика по MenuItem,
 *  используем контекст: Menu провайдит обработчик, MenuItem его читает и зовёт
 *  его с собственным `id`. Это RAC-овское «`onAction` живёт на родителе, а не
 *  на каждом пункте», перенесённое на coss, где клик — это `onClick` самого Item.
 */
import * as React from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Popover } from "@/components/ui/popover";
import { Header as RacHeader } from "react-aria-components";
import { cn } from "@/lib/utils";

/** onAction на Menu → onClick на MenuItem: провайдим через контекст. */
const OnActionContext = React.createContext<(key: React.Key) => void>(() => {});

function placementToSide(placement?: string): "top" | "bottom" | "left" | "right" | undefined {
  if (placement === "top" || placement === "bottom" || placement === "left" || placement === "right") {
    return placement;
  }
  return undefined;
}

interface MenuTriggerProps {
  children: React.ReactNode;
  /** RAC: "bottom" | "top" | "left" | "right" | "bottom start" и т.п. */
  placement?: string;
  /** RAC: открыт ли контролируемо. */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Старый RAC-контракт: первый ребёнок — триггер, второй — содержимое меню.
 *  Оборачиваем триггер в coss Menu.Trigger через `render`, чтобы не плодить
 *  лишний <button> поверх RAC-кнопки потребителя. */
export function MenuTrigger({ children, placement, isOpen, onOpenChange }: MenuTriggerProps) {
  const arr = React.Children.toArray(children);
  const trigger = arr[0] as React.ReactElement | undefined;
  const menu = arr[1] as React.ReactElement | undefined;
  if (!trigger || !menu) {
    throw new Error("MenuTrigger требует два ребёнка: <trigger /><menu />");
  }
  const side = placementToSide(placement?.split(" ")[0]);
  return (
    <BaseMenu.Root open={isOpen} onOpenChange={onOpenChange}>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner side={side} sideOffset={4}>
          <BaseMenu.Popup
            className={cn(
              "z-50 min-w-[150px] rounded-lg border border-border bg-popover p-1 text-popover-foreground",
              "shadow-lg/5 outline-none",
              "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
              "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
              "transition-all duration-150",
              "font-sans max-h-[inherit] overflow-auto empty:text-center empty:pb-2",
            )}
          >
            {menu}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

interface MenuProps {
  children: React.ReactNode;
  /** RAC: зовётся с `id` кликнутого MenuItem. */
  onAction?: (key: React.Key) => void;
  className?: string;
  /** RAC: aria-label. */
  "aria-label"?: string;
}

/** Сам попап. В RAC `Menu` — это и есть попап, в coss роль попапа — у Popup.
 *  Здесь Menu = popup + провайдер onAction для MenuItem. */
export function Menu({ children, onAction, className, ...rest }: MenuProps) {
  return (
    <OnActionContext.Provider value={onAction ?? (() => {})}>
      <div role="menu" className={className} aria-label={rest["aria-label"]}>
        {children}
      </div>
    </OnActionContext.Provider>
  );
}

interface MenuItemProps {
  id?: React.Key;
  /** RAC: строка, по которой меню матчит клавиатурный поиск. coss: `label`. */
  textValue?: string;
  children?: React.ReactNode;
  /** RAC: отключённый пункт. */
  isDisabled?: boolean;
  /** RAC: класс на пункте. */
  className?: string;
  onClick?: React.MouseEventHandler;
}

/** Стандартный RAC-стиль пункта меню (из старого rac/Menu): паддинг, hover,
 *  selected-маркер, обрезка текста, фокус-кольцо. Перенесён один-в-один,
 *  чтобы визуал не уплыл после миграции. */
const dropdownItemStyles = [
  "group flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm",
  "outline-none select-none data-[highlighted]:bg-hover data-[highlighted]:text-foreground",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  "font-normal truncate",
].join(" ");

export function MenuItem({
  id,
  textValue,
  children,
  isDisabled,
  className,
  onClick,
}: MenuItemProps) {
  const onAction = React.useContext(OnActionContext);
  return (
    <BaseMenu.Item
      id={id as string}
      label={textValue}
      disabled={isDisabled}
      onClick={(e) => {
        onAction(id ?? "");
        onClick?.(e);
      }}
      className={cn(dropdownItemStyles, className)}
    >
      {children}
    </BaseMenu.Item>
  );
}

export function MenuSeparator({ className }: { className?: string }) {
  return <BaseMenu.Separator className={cn("mx-3 my-1 border-b border-border", className)} />;
}

interface MenuSectionProps {
  title?: string;
  children?: React.ReactNode;
  className?: string;
  items?: unknown;
}

/** RAC: MenuSection с заголовком. В coss эквивалент — Menu.Group + Menu.GroupLabel. */
export function MenuSection({ title, children, className }: MenuSectionProps) {
  return (
    <BaseMenu.Group className={className}>
      {title ? <BaseMenu.GroupLabel className="sticky -top-px z-10 -mx-1 mt-px border-y border-border bg-popover/60 px-4 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-md">
        {title}
      </BaseMenu.GroupLabel> : null}
      {children}
    </BaseMenu.Group>
  );
}

/** RAC SubmenuTrigger: триггер, открывающий подменю. В RulesView не используется,
 *  но экспорт сохранён на случай будущих потребителей. Реализован как coss SubmenuTrigger. */
export function SubmenuTrigger({ children }: { children: React.ReactNode }) {
  const arr = React.Children.toArray(children);
  const trigger = arr[0] as React.ReactElement | undefined;
  const menu = arr[1] as React.ReactElement | undefined;
  if (!trigger || !menu) {
    throw new Error("SubmenuTrigger требует два ребёнка: <trigger /><menu />");
  }
  return (
    <BaseMenu.SubmenuTrigger>
      <BaseMenu.SubmenuTrigger render={trigger as React.ReactElement} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={-2} alignOffset={-4}>
          <BaseMenu.Popup className="z-50 min-w-[150px] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg/5 outline-none">
            {menu}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.SubmenuTrigger>
  );
}

/** Backward-compat: старый MenuPopover — попап-контейнер вокруг меню. В новой
 *  модели не нужен (MenuTrigger сам строит попап), оставлен как тонкая
 *  обёртка для редких случаев ручного монтажа. */
export { Popover as MenuPopover };

/** Backward-compat: старый MenuHeader — заголовок секции. Не путать с
 *  Menu.GroupLabel: это просто блочный заголовок вне группы. В потребителях
 *  не используется; сохранён как алиас RAC Header. */
export { RacHeader as MenuHeader };
