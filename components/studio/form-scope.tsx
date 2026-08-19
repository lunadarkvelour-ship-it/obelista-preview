"use client";

import { createContext, useContext } from "react";
import { useStore } from "@/lib/store";
import type { Form } from "@/lib/types";

export interface FormScopeValue {
  form: Form;
  set: <K extends keyof Form>(key: K, value: Form[K]) => void;
  patch: (patch: Partial<Form>) => void;
  /** Чья это форма: панели целиком или одной группы кабинетов.
   *
   *  Нужен ровно там, где поле принадлежит не связке, а кабинету. Такой на
   *  сегодня один — пиксель: в группе он живёт на шаге «Кабинеты», у каждого
   *  каба свой, и второе поле на «Цели» было бы вторым источником правды. */
  scope: "global" | "group";
  /** Перейти на другой шаг конструктора. Есть только у группы: в глобальном
   *  «Сетапе» шагов нет, там секции лежат подряд. */
  goStep?: (id: string) => void;
  /** Соцы, на которых поедет эта форма. Нужны секциям, где значение решается на
   *  каждом соце отдельно (тег агентства), — чтобы показать результат, а не
   *  оставить «авто» на веру. */
  profiles?: string[];
}

const Ctx = createContext<FormScopeValue | null>(null);
export const FormScopeProvider = Ctx.Provider;

/** Откуда секции конструктора берут форму.
 *
 *  Без провайдера — глобальная форма панели, как было всегда. Внутри
 *  провайдера — форма конкретной группы на листе «Аплоад». Смысл в том, что
 *  один и тот же комплект секций обслуживает оба места: сорок одно поле
 *  существует в единственном экземпляре, и «в аплоаде настройки беднее, чем в
 *  лаунче» становится невозможным по построению.
 *
 *  Хуки зовутся безусловно и до ветвления — порядок стабильный при любом
 *  наличии провайдера. */
export function useFormScope(): FormScopeValue {
  const scoped = useContext(Ctx);
  const form = useStore((s) => s.form);
  const set = useStore((s) => s.setField);
  const patch = useStore((s) => s.patchForm);
  return scoped ?? { form, set: set as FormScopeValue["set"], patch, scope: "global" };
}
