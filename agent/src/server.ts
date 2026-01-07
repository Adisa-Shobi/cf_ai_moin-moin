import { env } from "cloudflare:workers";
import { routeAgentRequest } from "agents";
import { Hono } from 'hono'
import {Chat} from './chat'

const app = new Hono<{ Bindings: Env }>()

app.post("/api/new-session", async (c) => {

  // const sessionId = crypto.randomUUID();
  // const sessionId = c.env.Chat.newUniqueId().toString()
  const sessionId = "default"
  const urlObj = new URL(c.req.url);

  const protocol = urlObj.protocol === "https:" ? "wss" : "ws";

  const websocketUrl = `${protocol}://${urlObj.host}/agents/chat/${sessionId}`;

  return c.json({
    sessionId: sessionId,
    url: websocketUrl
  });

});

app.use("*", async (c) => {

  const honoReq = c.req;

  const request: Request = honoReq.raw;

  const res = await routeAgentRequest(request, env);

  return ( res ||
      new Response("Not found", { status: 404 })
    );
})



export { Chat };
export default app;
