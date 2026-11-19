import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { timingSafeEqual } from "node:crypto";

type SeedUser = { email: string; password: string; name: string };

export const Route = createFileRoute("/api/seed-accounts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const encoded = new URL(request.url).searchParams.get("key") ?? "";
        const supplied = Buffer.from(encoded, "base64").toString("utf8");
        const expected = process.env.APP_AUTH_SEED_TOKEN ?? "";
        if (!expected || supplied.length !== expected.length ||
          !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
          return new Response("Not found", { status: 404 });
        }

        const raw = process.env.APP_AUTH_SEED_USERS;
        if (!raw) return new Response("Seed is unavailable", { status: 410 });

        let users: SeedUser[];
        try {
          users = JSON.parse(raw) as SeedUser[];
          if (!Array.isArray(users) || users.length !== 2 ||
            users.some((u) => !u.email || !u.password || !u.name)) {
            throw new Error("Invalid seed");
          }
        } catch {
          return new Response("Invalid seed configuration", { status: 500 });
        }

        const created: string[] = [];
        for (const user of users) {
          try {
            await auth.api.signUpEmail({
              body: {
                email: user.email.trim().toLowerCase(),
                password: user.password,
                name: user.name,
              },
            });
            created.push(user.email);
          } catch {
            // Never reveal whether an account already exists or expose auth details.
            return new Response("Account provisioning failed. Check server logs.", { status: 409 });
          }
        }

        return Response.json({ ok: true, created });
      },
    },
  },
});
