import Link from "next/link";
import CommunityFeed from "./CommunityFeed";

export default function CommunityPage() {
  return (
    <main className="px-4 pt-6 pb-8">
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-2xl">‹</Link>
        <h1 className="font-bold">仲間のトレーニング</h1>
        <span className="w-6" />
      </header>
      <CommunityFeed />
    </main>
  );
}
