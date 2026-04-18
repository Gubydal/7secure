"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./SiteFooter";

export function GlobalFooter() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return <SiteFooter roundedTop={isHome} />;
}
