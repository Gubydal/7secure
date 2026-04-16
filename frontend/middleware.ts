import { NextRequest, NextResponse } from "next/server";

const sectionHosts: Record<string, string> = {
  articles: "/articles",
  practices: "/practices",
  guides: "/practices",
  tools: "/tools"
};

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const [subdomain] = host.split(".");
  const basePath = sectionHosts[subdomain];

  if (!basePath) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  if (url.pathname === "/") {
    url.pathname = basePath;
  } else if (!url.pathname.startsWith(basePath)) {
    url.pathname = `${basePath}${url.pathname}`;
  }

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"]
};
