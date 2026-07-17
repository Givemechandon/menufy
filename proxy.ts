import { NextRequest, NextResponse } from "next/server";

function requireAuthentication() {
  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: {
      "WWW-Authenticate":
        'Basic realm="MenuFy privado", charset="UTF-8"',
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Authorization",
    },
  });
}

function protectionNotConfigured() {
  return new NextResponse(
    "Proteção do site não configurada.",
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}

function allowPrivateRequest() {
  const response = NextResponse.next();

  response.headers.set(
    "Cache-Control",
    "private, no-store, max-age=0",
  );

  response.headers.append("Vary", "Authorization");

  return response;
}

export function proxy(request: NextRequest) {
  const expectedUsername = process.env.SITE_USERNAME;
  const expectedPassword = process.env.SITE_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return protectionNotConfigured();
  }

  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Basic ")) {
    return requireAuthentication();
  }

  try {
    const credentials = atob(authorization.slice(6));
    const separatorIndex = credentials.indexOf(":");

    if (separatorIndex === -1) {
      return requireAuthentication();
    }

    const username = credentials.slice(
      0,
      separatorIndex,
    );

    const password = credentials.slice(
      separatorIndex + 1,
    );

    if (
      username === expectedUsername &&
      password === expectedPassword
    ) {
      return allowPrivateRequest();
    }
  } catch {
    return requireAuthentication();
  }

  return requireAuthentication();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};