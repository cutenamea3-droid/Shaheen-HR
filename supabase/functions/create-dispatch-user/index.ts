import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return respond({ error: "Sign in as a Dispatch administrator." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    console.error("Dispatch account-provisioning environment is incomplete.");
    return respond({ error: "Account creation is not configured on the server." }, 500);
  }

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return respond({ error: "Sign in as a Dispatch administrator." }, 401);

  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerAccount, error: accountError } = await adminClient
    .from("dispatch_portal_accounts")
    .select("role, active")
    .eq("user_id", callerData.user.id)
    .maybeSingle();
  if (accountError) {
    console.error("Could not verify the Dispatch provisioning caller.", accountError);
    return respond({ error: "Could not verify Dispatch administrator access." }, 500);
  }
  if (!callerAccount || callerAccount.role !== "admin" || !callerAccount.active) {
    return respond({ error: "Dispatch administrator access is required." }, 403);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return respond({ error: "A valid JSON request is required." }, 400);
  }

  if (!input || typeof input !== "object") return respond({ error: "Account details are required." }, 400);
  const { email, displayName, password, role } = input as Record<string, unknown>;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return respond({ error: "Enter a valid email address." }, 400);
  }
  if (typeof displayName !== "string" || !displayName.trim() || displayName.trim().length > 80) {
    return respond({ error: "Display name must contain 1 to 80 characters." }, 400);
  }
  if (typeof password !== "string" || password.length < 8) {
    return respond({ error: "Password must be at least 8 characters." }, 400);
  }
  const nextRole = role === "admin" ? "admin" : "dispatcher";

  const normalizedEmail = email.trim().toLowerCase();

  // Refuse to attach Dispatch to an existing Driver Compliance seat (isolation).
  const { data: driverSeat } = await adminClient
    .from("driver_portal_accounts")
    .select("user_id, email")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (driverSeat) {
    return respond(
      {
        error:
          "That email already has Driver Compliance access. Invite a dedicated dispatcher login instead — do not share Compliance seats with Dispatch.",
      },
      409,
    );
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName.trim(), module: "dispatch" },
  });
  if (createError || !created.user) {
    return respond({ error: createError?.message ?? "Could not create the account." }, 400);
  }

  const { error: profileError } = await adminClient.from("dispatch_portal_accounts").insert({
    user_id: created.user.id,
    email: normalizedEmail,
    display_name: displayName.trim(),
    role: nextRole,
    active: true,
  });
  if (profileError) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(created.user.id);
    if (cleanupError) console.error("Could not clean up an unprovisioned Dispatch Auth user.", cleanupError);
    console.error("Could not create the Dispatch account profile.", profileError);
    return respond({ error: "Could not finish creating the Dispatch account." }, 500);
  }

  return respond({ userId: created.user.id, role: nextRole }, 201);
});
