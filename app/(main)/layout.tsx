import { BottomNav } from "@/components/layout/BottomNav";
import { MobileShell } from "@/components/layout/MobileShell";

/**
 * Chrome for every screen that is *not* driving mode. `/session/[id]` sits
 * outside this group so it never inherits the bottom nav.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MobileShell withBottomNav>{children}</MobileShell>
      <BottomNav />
    </>
  );
}
