"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** Клиент один на процесс браузера. `useState` гарантирует, что при Strict
 *  Mode двойного рендера или HMR не заведётся второй инстанс с расщеплённым
 *  кэшем — сам по себе QueryClient уже достаточно дорогой, чтобы плодить
 *  его на каждый ремоунт. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
