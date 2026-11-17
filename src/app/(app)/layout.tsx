import { NavMenu } from "@/components/NavMenu";
import { getFarm, requireUser } from "@/lib/data";
import { signOut } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const farm = await getFarm(supabase);

  return (
    <div className="min-h-screen">
      <NavMenu farmName={farm.name} email={user.email} signOut={signOut} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
