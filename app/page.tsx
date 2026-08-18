import { redirect } from "next/navigation";

/* Корень — кидаем на /creatives (это самая важная страница, как в media_library_2). */
export default function Home() {
  redirect("/creatives");
}
