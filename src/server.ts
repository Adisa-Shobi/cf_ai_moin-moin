import { env } from "cloudflare:workers";
import { routeAgentRequest } from "agents";
import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>()

app.use("*", async (c) => {

  const honoReq = c.req;

  const request: Request = honoReq.raw;

  const res = await routeAgentRequest(request, env);

  return ( res ||
      new Response("Not found", { status: 404 })
    );
})



export { Chat } from './chat';
export default app;
