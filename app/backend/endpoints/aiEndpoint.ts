import { verifyAdminAuth } from "../../utils/adminAuth";
import { getD1Database } from "../../db/d1";
import type { ActionFunctionArgs } from "react-router";
import { GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import {
  getProductsFromDb,
  updateProductInDb,
} from "../../db/productsDb";
import {
  getOrdersFromDb,
  updateOrderStatusInDb,
} from "../../db/ordersDb";
import { INITIAL_META_CAMPAIGNS, INITIAL_SETTINGS } from "../../data/initialData";
import type { MetaCampaign, StoreSettings, Product } from "../../types/store";
import aiStrings from "../../frontend/locales/aiStrings.json";

let localCampaigns: MetaCampaign[] = [...INITIAL_META_CAMPAIGNS];
let localSettings: StoreSettings = { ...INITIAL_SETTINGS };

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const listProductsTool: FunctionDeclaration = {
  name: "list_products",
  description: "Retrieve store product catalog with pricing, stock status and quantities",
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: "Filter by category: rutab, fig, truffle, nuts, dates or all",
      },
    },
  },
};

const updateProductPriceTool: FunctionDeclaration = {
  name: "update_product_price",
  description: "Update product price in AED in the database",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productId: { type: Type.STRING, description: "Product identifier e.g. sku-0001" },
      newPrice: { type: Type.NUMBER, description: "New price in AED" },
    },
    required: ["productId", "newPrice"],
  },
};

const toggleProductStockTool: FunctionDeclaration = {
  name: "toggle_product_stock",
  description: "Toggle product stock availability",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productId: { type: Type.STRING, description: "Product identifier" },
      inStock: { type: Type.BOOLEAN, description: "True if in stock, false otherwise" },
    },
    required: ["productId", "inStock"],
  },
};

const listOrdersTool: FunctionDeclaration = {
  name: "list_orders",
  description: "Retrieve customer orders and statuses in AED",
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        description: "Filter by status: pending, processing, shipped, delivered, cancelled or all",
      },
    },
  },
};

const updateOrderStatusTool: FunctionDeclaration = {
  name: "update_order_status",
  description: "Update order status in database",
  parameters: {
    type: Type.OBJECT,
    properties: {
      orderId: { type: Type.STRING, description: "Order ID e.g. ord-1001" },
      status: {
        type: Type.STRING,
        description: "New status: pending, processing, shipped, delivered, cancelled",
      },
    },
    required: ["orderId", "status"],
  },
};

const listAdCampaignsTool: FunctionDeclaration = {
  name: "list_ad_campaigns",
  description: "List Meta ad campaigns and spend metrics",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const createAdCampaignTool: FunctionDeclaration = {
  name: "create_ad_campaign",
  description: "Create and launch new ad campaign on Meta Ads",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Campaign name" },
      objective: {
        type: Type.STRING,
        description: "Campaign objective: OUTCOME_SALES or OUTCOME_LEADS or OUTCOME_TRAFFIC",
      },
      dailyBudget: { type: Type.NUMBER, description: "Daily budget in AED" },
      headline: { type: Type.STRING, description: "Ad headline" },
      primaryText: { type: Type.STRING, description: "Ad primary text" },
      targetEmirates: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Target Emirates list",
      },
      productCategory: { type: Type.STRING, description: "Product category" },
    },
    required: ["name", "dailyBudget", "headline", "primaryText"],
  },
};

const toggleCampaignStatusTool: FunctionDeclaration = {
  name: "toggle_campaign_status",
  description: "Toggle campaign status between ACTIVE and PAUSED",
  parameters: {
    type: Type.OBJECT,
    properties: {
      campaignId: { type: Type.STRING, description: "Campaign ID" },
      status: { type: Type.STRING, description: "ACTIVE or PAUSED" },
    },
    required: ["campaignId", "status"],
  },
};

const updateCampaignBudgetTool: FunctionDeclaration = {
  name: "update_campaign_budget",
  description: "Update daily budget of an ad campaign",
  parameters: {
    type: Type.OBJECT,
    properties: {
      campaignId: { type: Type.STRING, description: "Campaign ID" },
      newDailyBudget: { type: Type.NUMBER, description: "New daily budget in AED" },
    },
    required: ["campaignId", "newDailyBudget"],
  },
};

const updateStoreSettingsTool: FunctionDeclaration = {
  name: "update_store_settings",
  description: "Update store settings like banner text and free delivery threshold",
  parameters: {
    type: Type.OBJECT,
    properties: {
      bannerNotice: { type: Type.STRING, description: "Top announcement bar notice" },
      freeDeliveryThreshold: { type: Type.NUMBER, description: "Free delivery threshold in AED" },
      storeTagline: { type: Type.STRING, description: "Store tagline" },
    },
  },
};

const getStoreMetricsTool: FunctionDeclaration = {
  name: "get_store_metrics",
  description: "Get financial and operational metrics summary",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export async function handleAiAgentAction({ request, context }: ActionFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success:false, error:"Unauthorized" }, { status:401 });
  const d1 = getD1Database(context);

  try {
    const body = (await request.json()) as {
      message: string;
      history?: Array<{ role: "user" | "model"; text: string }>;
      clientContext?: {
        products?: Product[];
        campaigns?: MetaCampaign[];
        settings?: StoreSettings[];
      };
    };

    const userMessage = body.message?.trim();
    if (!userMessage) {
      return Response.json({ success: false, error: aiStrings.agent.missingMessage }, { status: 400 });
    }

    const executeTool = async (name: string, args: any): Promise<any> => {
      if (name === "list_products") {
        const { products } = await getProductsFromDb(d1);
        let filtered = products;
        if (args.category && args.category !== "all") {
          filtered = filtered.filter((p) => p.category === args.category);
        }
        return {
          count: filtered.length,
          products: filtered.map((p) => ({
            id: p.id,
            name: p.name,
            price: `${p.price} AED`,
            category: p.category,
            inStock: p.inStock,
            stockQuantity: p.stockQuantity,
            origin: p.origin,
          })),
        };
      }

      if (name === "update_product_price") {
        const { products } = await getProductsFromDb(d1);
        const target = products.find(
          (p) => p.id === args.productId || p.name.includes(args.productId),
        );
        if (!target) {
          return { success: false, error: `${aiStrings.agent.productNotFound}: ${args.productId}` };
        }
        await updateProductInDb(target.id, { price: Number(args.newPrice) }, d1);
        return {
          success: true,
          productName: target.name,
          oldPrice: target.price,
          newPrice: args.newPrice,
          message: `${aiStrings.agent.priceUpdated} (${target.name}: ${args.newPrice} AED)`,
        };
      }

      if (name === "toggle_product_stock") {
        const { products } = await getProductsFromDb(d1);
        const target = products.find(
          (p) => p.id === args.productId || p.name.includes(args.productId),
        );
        if (!target) {
          return { success: false, error: `${aiStrings.agent.productNotFound}: ${args.productId}` };
        }
        await updateProductInDb(target.id, { inStock: Boolean(args.inStock) }, d1);
        return {
          success: true,
          productName: target.name,
          inStock: Boolean(args.inStock),
          message: `${aiStrings.agent.stockUpdated} (${target.name}: ${args.inStock ? aiStrings.agent.available : aiStrings.agent.unavailable})`,
        };
      }

      if (name === "list_orders") {
        const { orders } = await getOrdersFromDb(d1);
        let filtered = orders;
        if (args.status && args.status !== "all") {
          filtered = filtered.filter((o) => o.status === args.status);
        }
        return {
          totalOrders: filtered.length,
          orders: filtered.slice(0, 10).map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            customerEmirate: o.customerEmirate,
            total: `${o.total} AED`,
            paymentMethod: o.paymentMethod,
            paymentStatus: o.paymentStatus || "pending",
            status: o.status,
            itemsSummary: o.items.map((i) => `${i.quantity}x ${i.name}`).join(", "),
          })),
        };
      }

      if (name === "update_order_status") {
        const success = await updateOrderStatusInDb(args.orderId, args.status, d1);
        return {
          success,
          orderId: args.orderId,
          newStatus: args.status,
          message: `${aiStrings.agent.orderStatusUpdated}: ${args.orderId} -> ${args.status}`,
        };
      }

      if (name === "list_ad_campaigns") {
        return {
          count: localCampaigns.length,
          campaigns: localCampaigns.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            dailyBudget: `${c.dailyBudget} AED`,
            spentAED: `${c.spentAED} AED`,
            impressions: c.impressions,
            clicks: c.clicks,
            conversions: c.conversions,
            headline: c.headline,
          })),
        };
      }

      if (name === "create_ad_campaign") {
        const newCampaign: MetaCampaign = {
          id: `camp-meta-${Date.now().toString(36)}`,
          name: args.name,
          objective: args.objective || "OUTCOME_SALES",
          status: "ACTIVE",
          dailyBudget: Number(args.dailyBudget) || 100,
          spentAED: 0,
          impressions: 0,
          clicks: 0,
          leadsCount: 0,
          conversions: 0,
          targetEmirates: args.targetEmirates || ["Abu Dhabi", "Dubai", "Sharjah", "Al Ain"],
          targetInterests: ["Hospitality", "Gourmet Dates", "Emirati Heritage"],
          productCategory: args.productCategory || "all",
          headline: args.headline,
          primaryText: args.primaryText,
          callToAction: "SHOP_NOW",
          imageUrl: "/images/redfig.jpg",
          createdAt: new Date().toISOString(),
        };
        localCampaigns = [newCampaign, ...localCampaigns];
        return {
          success: true,
          campaign: newCampaign,
          message: `${aiStrings.agent.campaignLaunched} (${newCampaign.name} - ${newCampaign.dailyBudget} AED)`,
        };
      }

      if (name === "toggle_campaign_status") {
        const idx = localCampaigns.findIndex((c) => c.id === args.campaignId || c.name.includes(args.campaignId));
        if (idx > -1) {
          localCampaigns[idx].status = args.status;
          return {
            success: true,
            campaignName: localCampaigns[idx].name,
            status: args.status,
            message: `${aiStrings.agent.campaignStatusUpdated}: ${localCampaigns[idx].name} -> ${args.status}`,
          };
        }
        return { success: false, error: aiStrings.agent.campaignNotFound };
      }

      if (name === "update_campaign_budget") {
        const idx = localCampaigns.findIndex((c) => c.id === args.campaignId || c.name.includes(args.campaignId));
        if (idx > -1) {
          localCampaigns[idx].dailyBudget = Number(args.newDailyBudget);
          return {
            success: true,
            campaignName: localCampaigns[idx].name,
            newBudget: args.newDailyBudget,
            message: `${aiStrings.agent.campaignBudgetUpdated}: ${localCampaigns[idx].name} -> ${args.newDailyBudget} AED`,
          };
        }
        return { success: false, error: aiStrings.agent.campaignNotFound };
      }

      if (name === "update_store_settings") {
        if (args.bannerNotice) localSettings.bannerNotice = args.bannerNotice;
        if (args.freeDeliveryThreshold) localSettings.freeDeliveryThreshold = Number(args.freeDeliveryThreshold);
        if (args.storeTagline) localSettings.storeTagline = args.storeTagline;
        return {
          success: true,
          settings: localSettings,
          message: aiStrings.agent.settingsUpdated,
        };
      }

      if (name === "get_store_metrics") {
        const { orders } = await getOrdersFromDb(d1);
        const { products } = await getProductsFromDb(d1);
        const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
        const paidOrders = orders.filter((o) => o.paymentStatus === "paid" || o.status === "delivered");
        const ziinaOrders = orders.filter((o) => o.paymentMethod === "ziina");
        return {
          totalProducts: products.length,
          totalOrders: orders.length,
          totalSalesAED: totalSales,
          paidOrdersCount: paidOrders.length,
          ziinaOrdersCount: ziinaOrders.length,
          activeCampaigns: localCampaigns.filter((c) => c.status === "ACTIVE").length,
        };
      }

      return { success: false, error: `${aiStrings.agent.unknownTool}: ${name}` };
    };

    if (process.env.GEMINI_API_KEY) {
      try {
        const systemInstruction = aiStrings.agent.systemInstruction;
        const tools = [
          listProductsTool,
          updateProductPriceTool,
          toggleProductStockTool,
          listOrdersTool,
          updateOrderStatusTool,
          listAdCampaignsTool,
          createAdCampaignTool,
          toggleCampaignStatusTool,
          updateCampaignBudgetTool,
          updateStoreSettingsTool,
          getStoreMetricsTool,
        ];

        const firstResponse = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: userMessage,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: tools }],
          },
        });

        const functionCalls = firstResponse.functionCalls;
        const executedActions: Array<{ tool: string; args: any; result: any }> = [];

        if (functionCalls && functionCalls.length > 0) {
          for (const call of functionCalls) {
            const res = await executeTool(call.name, call.args);
            executedActions.push({ tool: call.name, args: call.args, result: res });
          }

          const followUpResponse = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [
              { role: "user", parts: [{ text: userMessage }] },
              {
                role: "model",
                parts: [
                  {
                    text: `${aiStrings.agent.toolsSuccess}: ${JSON.stringify(executedActions)}`,
                  },
                ],
              },
              {
                role: "user",
                parts: [
                  {
                    text: aiStrings.agent.aiReplyFollowup,
                  },
                ],
              },
            ],
            config: { systemInstruction },
          });

          return Response.json({
            success: true,
            reply: followUpResponse.text || aiStrings.agent.executionSuccess,
            executedActions,
            modelUsed: "gemini-3.8-flash",
          });
        }

        if (firstResponse.text) {
          return Response.json({
            success: true,
            reply: firstResponse.text,
            executedActions: [],
            modelUsed: "gemini-3.8-flash",
          });
        }
      } catch (geminiErr) {
        console.warn("Gemini call error:", geminiErr);
      }
    }

    // Smart Fallback
    const lower = userMessage.toLowerCase();
    const executedActions: Array<{ tool: string; args: any; result: any }> = [];
    let reply = aiStrings.agent.fallbackDefault;

    if (lower.includes("meta") || lower.includes("camp") || lower.includes("ad")) {
      const toolRes = await executeTool("list_ad_campaigns", {});
      executedActions.push({ tool: "list_ad_campaigns", args: {}, result: toolRes });
      reply = aiStrings.agent.fallbackCampaignsList;
    } else if (lower.includes("order") || lower.includes("status")) {
      const toolRes = await executeTool("list_orders", {});
      executedActions.push({ tool: "list_orders", args: {}, result: toolRes });
      reply = aiStrings.agent.fallbackOrders;
    } else if (lower.includes("ziina") || lower.includes("pay")) {
      const metrics = await executeTool("get_store_metrics", {});
      executedActions.push({ tool: "get_store_metrics", args: {}, result: metrics });
      reply = aiStrings.agent.fallbackZiina;
    } else {
      const toolRes = await executeTool("list_products", {});
      executedActions.push({ tool: "list_products", args: {}, result: toolRes });
      reply = aiStrings.agent.fallbackCatalog;
    }

    return Response.json({
      success: true,
      reply,
      executedActions,
      modelUsed: "smart-mcp-agent",
    });
  } catch (error) {
    console.error("AI MCP Agent error:", error);
    return Response.json(
      {
        success: false,
        error: aiStrings.agent.errorProcessing,
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}

export async function handleAiMarketingAction({ request, context }: ActionFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success:false, error:"Unauthorized" }, { status:401 });
  try {
    const body = (await request.json()) as {
      action: "generate_ad_copy" | "analyze_lead" | "generate_whatsapp_reply" | "suggest_strategy";
      productName?: string;
      productCategory?: string;
      objective?: string;
      season?: string;
      leadData?: {
        customerName: string;
        phone: string;
        emirate: string;
        interestedProduct: string;
        quantityEstimated: string;
        notes?: string;
      };
    };

    if (body.action === "generate_ad_copy") {
      let resultText = "";
      if (process.env.GEMINI_API_KEY) {
        try {
          const prompt = `${aiStrings.marketing.adCopyPrompt}\nProduct: ${body.productName || "Teen Liwa Figs & Dates"}\nCategory: ${body.productCategory || "general"}\nObjective: ${body.objective || "sales"}`;
          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            },
          });
          resultText = response.text || "";
        } catch (err) {
          console.warn("Gemini API call failed, using fallback:", err);
        }
      }

      if (resultText) {
        try {
          const parsed = JSON.parse(resultText);
          return Response.json({ success: true, data: parsed });
        } catch {}
      }

      return Response.json({ success: true, data: aiStrings.marketing.fallbackAdCopies });
    }

    if (body.action === "analyze_lead" || body.action === "generate_whatsapp_reply") {
      const lead = body.leadData;
      if (!lead) {
        return Response.json({ success: false, error: "Missing leadData" }, { status: 400 });
      }

      let resultText = "";
      if (process.env.GEMINI_API_KEY) {
        try {
          const prompt = `${aiStrings.marketing.leadPrompt}\nName: ${lead.customerName}\nEmirate: ${lead.emirate}\nProduct: ${lead.interestedProduct}\nQty: ${lead.quantityEstimated}`;
          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" },
          });
          resultText = response.text || "";
        } catch (err) {
          console.warn("Gemini lead analysis fallback:", err);
        }
      }

      if (resultText) {
        try {
          const parsed = JSON.parse(resultText);
          return Response.json({ success: true, data: parsed });
        } catch {}
      }

      const fallbackAnalysis = {
        aiScore: "high",
        scoreReason: `${lead.interestedProduct} - ${lead.emirate}`,
        recommendedAction: "Send WhatsApp message with chilled delivery confirmation.",
        whatsappReply: `${aiStrings.marketing.whatsappReplyGreeting}\n\n${aiStrings.marketing.whatsappReplyBody}\n\n${aiStrings.marketing.whatsappReplyClosing}`,
      };

      return Response.json({ success: true, data: fallbackAnalysis });
    }

    return Response.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "AI marketing action failed",
      },
      { status: 500 },
    );
  }
}
