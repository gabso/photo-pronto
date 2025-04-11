import { SignOutButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const authObj = await auth();
  const userObj = await currentUser();

  console.log({ authObj });
  console.log({ userObj });

  return (
    <div>
      <SignOutButton>
        <button className=" cursor-pointer px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700">
          Sign Out
        </button>
      </SignOutButton>
      <h1>Dashboard</h1>
    </div>
  );
}
