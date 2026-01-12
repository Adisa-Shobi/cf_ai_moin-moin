import { env } from "cloudflare:workers";
import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import { validator } from "hono/validator";
import z from "zod";
import { Chat } from "./chat";

const app = new Hono<{ Bindings: Env }>();

const newSessionSchema = z.object({
  session_id: z.string().optional(),
});

app.post(
  "/api/new-session",
  validator("form", (value, c) => {
    const parsed = newSessionSchema.safeParse(value);
    if (!parsed.success) {
      return c.text("Invalid!", 401);
    }
    return parsed.data;
  }),
  async (c) => {
    let sessionId = c.req.valid("form").session_id;
    if (!sessionId || !c.env.Chat.getByName(sessionId))
      sessionId = c.env.Chat.newUniqueId().toString();

    const urlObj = new URL(c.req.url);

    const protocol = urlObj.protocol === "https:" ? "wss" : "ws";

    const websocketUrl = `${protocol}://${urlObj.host}/agents/chat/${sessionId}`;

    return c.json({
      sessionId: sessionId,
      url: websocketUrl,
    });
  },
);

app.use("*", async (c) => {
  const honoReq = c.req;

  const request: Request = honoReq.raw;

  const res = await routeAgentRequest(request, env);

  return res || new Response("Not found", { status: 404 });
});

export { Chat };
export default app;
