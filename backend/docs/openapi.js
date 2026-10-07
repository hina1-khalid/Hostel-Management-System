// Builds the OpenAPI (Swagger) document straight from the real Express routers, so it can never go out of date.
// Roles come from the authorize(...) middleware on each route; "protected" from protect.
const toOpenApiPath = (p) => p.replace(/:([A-Za-z_]+)/g, "{$1}");
const human = (s) => s.replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());

const summarize = (method, mount, sub) => {
  const segs = sub.split("/").filter(Boolean);
  const words = segs.filter((s) => !s.startsWith(":"));
  const endsWithId = segs.length && segs[segs.length - 1].startsWith(":");
  const noun = human(mount);
  if (!segs.length) return method === "get" ? `List ${noun.toLowerCase()}` : method === "post" ? `Create (${noun.toLowerCase()})` : `${method.toUpperCase()} ${noun}`;
  if (endsWithId && words.length === 0) return ({ get: "Get one", put: "Update", delete: "Delete" }[method] || method.toUpperCase()) + ` (${noun.toLowerCase()})`;
  return `${human(words.join(" "))} (${noun.toLowerCase()})`;
};

const buildOpenApi = (mounts) => {
  const paths = {};
  const tags = new Set();
  for (const [mount, router] of mounts) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const { route } = layer;
      const fullPath = toOpenApiPath(`/api/${mount}${route.path === "/" ? "" : route.path}`);
      const handlers = route.stack.map((l) => l.handle);
      const roles = handlers.find((h) => h.roles)?.roles;
      const isProtected = handlers.some((h) => h.isProtect);
      const params = [...route.path.matchAll(/:([A-Za-z_]+)/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string" } }));
      for (const method of Object.keys(route.methods)) {
        tags.add(mount);
        const op = {
          tags: [mount],
          summary: summarize(method, mount, route.path),
          description: roles ? `**Allowed roles:** ${roles.join(", ")}` : isProtected ? "**Allowed roles:** any signed-in user" : "**Public** (no sign-in needed)",
          parameters: params,
          responses: { 200: { description: "Success" }, 400: { description: "Validation error: { message }" }, ...(isProtected ? { 401: { description: "Missing or invalid token" } } : {}), ...(roles ? { 403: { description: "Role not allowed" } } : {}), 404: { description: "Not found" } },
          "x-roles": roles || (isProtected ? ["any"] : ["public"]),
        };
        if (isProtected) op.security = [{ bearerAuth: [] }];
        if (["post", "put", "patch"].includes(method)) op.requestBody = { required: false, content: { "application/json": { schema: { type: "object", additionalProperties: true } } } };
        (paths[fullPath] ||= {})[method] = op;
      }
    }
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "Smart Hostel Management System API",
      version: "2.0.0",
      description: "REST API for the hostel management platform. Sign in with `POST /api/auth/login`, copy the `token`, press **Authorize** and paste it. Errors are returned as `{ \"message\": \"...\" }`. This document is generated from the live routes.",
    },
    servers: [{ url: "/" }],
    tags: [...tags].sort().map((name) => ({ name })),
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
    paths,
  };
};

module.exports = { buildOpenApi };
