import { SignOutButton } from "@clerk/nextjs";
import Photos from '@/components/Photos';

export default async function DashboardPage() {

  return (
    <div>
      <SignOutButton>
        <button className=" cursor-pointer px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700">
          Sign Out
        </button>
      </SignOutButton>
      <main className="p-10">
      <h1 className="text-2xl font-bold mb-4">Photo pronto Demo</h1>
      <Photos />
    </main>
    </div>
  );
}
