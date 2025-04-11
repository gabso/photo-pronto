import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth();
  const dashboardUrl = new URL("/dashboard", req.url);
  const signInUrl = new URL("/sign-in", req.url);

  // Set redirect URL for successful authentication
  signInUrl.searchParams.set("redirect_url", dashboardUrl.toString());

  // Handle protected routes
  if (!userId && !isPublicRoute(req)) {
    return redirectToSignIn({ returnBackUrl: dashboardUrl.toString() });
  }

  // Redirect authenticated users from auth pages to dashboard
  if (userId && isPublicRoute(req)) {
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
