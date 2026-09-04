import { supabase } from "@/lib/supabaseClient";

export async function guardarSuscripcionPush(subscription) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const json = subscription.toJSON();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        usuario_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth_key: json.keys.auth,
      },
      { onConflict: "endpoint" }
    );
  if (error) throw error;
}

export async function borrarSuscripcionPush(endpoint) {
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw error;
}
