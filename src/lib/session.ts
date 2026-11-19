import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";

export type SessionData = {
  userId?: string;
  role?: "ADMIN" | "USER";
};

const sessionOptions: SessionOptions = {
  cookieName: "idm_session",
  password: process.env.SESSION_SECRET as string,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }
  return { userId: session.userId, role: session.role };
});
