import { requireSupabase } from "@/lib/supabase/client";
import type { VoiceTier } from "@/types";

/**
 * The caller's voice tier.
 *
 * No row means `trial`, so granting access is an insert and revoking it is a
 * delete. This read is for showing the right thing in the UI — the decision
 * that actually costs money is made server-side in Phase 4b, because anything
 * the browser reports about itself can be edited.
 */
export async function getVoiceTier(): Promise<VoiceTier> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from("voice_entitlements")
    .select("tier")
    .maybeSingle();

  if (error) throw error;
  return data?.tier ?? "trial";
}
