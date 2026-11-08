import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("cms", "routes/cms.tsx"),
  route("admin", "routes/admin.tsx"),
  route("api/admin/session", "routes/api.admin.session.ts"),
  route("api/settings", "routes/api.settings.ts"),
  route("api/marketing/leads", "routes/api.marketing.leads.ts"),
  route("api/r2", "routes/api.r2.ts"),
  route("api/catalog/meta", "routes/api.catalog.meta.ts"),
  route("api/meta/campaigns", "routes/api.meta.campaigns.ts"),
  route("api/ai/marketing", "routes/api.ai.marketing.ts"),
  route("api/ai/agent", "routes/api.ai.agent.ts"),
  route("api/meta/mcp", "routes/api.meta.mcp.ts"),
  route("api/orders", "routes/api.orders.ts"),
  route("api/products", "routes/api.products.ts"),
  route("api/ziina/create-intent", "routes/api.ziina.create-intent.ts"),
  route("api/ziina/verify", "routes/api.ziina.verify.ts"),
  route("api/ziina/webhook", "routes/api.ziina.webhook.ts"),
  route("payment/callback", "routes/payment.callback.tsx"),
  route("api/meta/webhook", "routes/api.meta.webhook.ts"),
  route("*", "routes/catchall.tsx"),
] satisfies RouteConfig;
