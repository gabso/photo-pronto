import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignOutButton,
} from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex items-center gap-4">
      <SignedOut>
        <SignInButton
          forceRedirectUrl="/dashboard"
          signUpForceRedirectUrl="/dashboard"
        >
          <button className="cursor-pointer px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <SignOutButton>
          <button className="cursor-pointer px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700">
            Sign Out
          </button>
        </SignOutButton>
      </SignedIn>
    </div>
  );
}
