export async function logActivityClient(params: {
  supabase: any;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  message: string;
  metadata?: Record<string, any> | null;
}): Promise<void> {
  try {
    const { supabase } = params;

    if (!supabase || !supabase.auth || typeof supabase.auth.getUser !== "function") {
      return;
    }

    // Use Supabase auth only to obtain the authenticated user
    const { data, error } = await supabase.auth.getUser();

    if (error || !data || !data.user) {
      // No authenticated user; do not log
      return;
    }

    const authUser = data.user;
    console.log("CLIENT_ACTIVITY_AUTH_USER", {
      id: authUser.id,
      email: authUser.email,
      metadata: authUser.user_metadata,
    });
    const authUserId = authUser.id as string;
    const authEmail = (authUser.email as string | null) || null;

    // Look up canonical profile in public.profiles using the auth user id
    let profile: { id: string; email: string | null; full_name: string | null; is_active: boolean } | null = null;

    try {
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, is_active")
        .eq("id", authUserId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!profileError && profileRow) {
        profile = profileRow as { id: string; email: string | null; full_name: string | null; is_active: boolean };
      }
    } catch {
      // Profile lookup must never throw; fall back to auth user only
      profile = null;
    }

    // Prefer profile.id when available; otherwise fall back to auth user id
    const userId = (profile && profile.id) || authUserId;

    // Derive userName from canonical sources with required fallbacks
    const profileFullName = (profile && (profile.full_name as string | null)) || null;
    const profileEmail = (profile && (profile.email as string | null)) || null;

    const userName =
      profileFullName ||
      profileEmail ||
      authEmail ||
      "Unknown User";

    const {
      eventType,
      entityType,
      entityId = null,
      entityLabel = null,
      message,
      metadata = {},
    } = params;

    const { error: insertError } = await supabase.from("activities").insert({
      user_id: userId,
      user_name: userName,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      message,
      metadata: metadata ?? {},
    });

    if (insertError) {
      console.error("Failed to log activity (client)", insertError);
    }
  } catch (err) {
    // Logging must never throw
    console.error("Unexpected error while logging activity (client)", err);
  }
}
