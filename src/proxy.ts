import { NextRequest, NextResponse } from "next/server";
import { getIronSession, nextProxyCookies } from "iron-session";
import type { SessionData } from "@/lib/session";

const publicRoutes = ["/", "/login"];

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(nextProxyCookies(request, response), {
    cookieName: "idm_session",
    password: process.env.SESSION_SECRET as string,
  });

  if (!isPublicRoute && !session.userId) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  if (path === "/login" && session.userId) {
    return NextResponse.redirect(new URL("/projects", request.nextUrl));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|svg|ico)$).*)"],
};
