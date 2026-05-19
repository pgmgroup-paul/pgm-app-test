export async function logActivity(params: {
  supabase: any;
  userId: string;
  userName: string;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  message: string;
  metadata?: Record<string, any> | null;
}): Promise<void> {
  try {
    const {
      supabase,
      userId,
      userName,
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
      console.error("Failed to log activity", insertError);
    }
  } catch (err) {
    // Logging must never throw
    console.error("Unexpected error while logging activity", err);
  }
}
