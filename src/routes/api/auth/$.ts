import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => {
        const path = new URL(request.url).pathname;
        if (path.endsWith("/sign-up/email")) {
          return new Response("Account registration is disabled.", { status: 403 });
        }
        return auth.handler(request);
      },
    },
  },
});
