import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { timingSafeEqual } from "node:crypto";

type SeedUser = { email: string; password: string; name: string };

export const Route = createFileRoute("/api/seed-accounts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const supplied = url.searchParams.get("key") ?? "";
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
            users.some((u) => !u.email || !u.password || !u.name)) throw new Error("Invalid seed");
        } catch {
          return new Response("Invalid seed configuration", { status: 500 });
        }
        for (const user of users) {
          const email = user.email.trim().toLowerCase();
          const existing = await auth.api.signInEmail({ body: { email, password: user.password } });
          if (existing.error) {
            const created = await auth.api.signUpEmail({
              body: { email, password: user.password, name: user.name },
            });
            if (created.error) return new Response("Account provisioning failed", { status: 500 });
          }
        }
        return new Response("Accounts provisioned", { status: 200 });
      },
    },
  },
});
