export type ProductCategory =
	| "rutab"
	| "fig"
	| "faqa"
	| "boxes"
	| "dates"
	| "nuts"
	| "truffle"
	| "fruits";

export interface Product {
	id: string;
	/** Optional unique SKU stored in products.sku. */
	sku?: string;
	name: string;
	nameEn?: string;
	category: ProductCategory;
	price: number;
	originalPrice?: number;
	unit?: string;
	origin?: string;
	harvestDate?: string;
	season?: string;
	image: string;
	description: string;
	desc?: string;
	tag?: string;
	disabled?: number;
	disabledTxt?: string;
	minQty?: number;
	maxQty?: number;
	created_at?: string;
	tastingNotes?: string[];
	storageInstructions?: string;
	inStock: boolean;
	stockQuantity?: number;
	trackInventory?: boolean;
	/** Mirrors products.is_active and products.is_available. */
	isActive?: boolean;
	isAvailable?: boolean;
	sortOrder?: number;
	badge?: string;
	featured?: boolean;
}

export interface CartItem {
	product: Product;
	quantity: number;
	packagingOption?: string;
}

export interface OrderItem {
	productId: string;
	name: string;
	quantity: number;
	price: number;
	unit: string;
	packagingOption?: string;
	trackInventory?: boolean;
}

export interface Order {
	id: string;
	orderNumber: string;
	customerName: string;
	customerPhone: string;
	customerEmirate: string;
	customerAddress: string;
	notes?: string;
	giftNote?: string;
	items: OrderItem[];
	subtotal: number;
	deliveryFee: number;
	discount: number;
	total: number;
	paymentMethod: "cod" | "card_on_delivery" | "whatsapp" | "ziina";
	paymentStatus?: "pending" | "paid" | "failed" | "cancelled";
	ziinaPaymentIntentId?: string;
	ziinaRedirectUrl?: string;
	transactionId?: string;
	cardBrand?: string;
	cardLastFour?: string;
	status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
	createdAt: string;
}

export interface StoreSettings {
	storeName: string;
	storeTagline: string;
	whatsappNumber: string;
	contactPhone: string;
	freeDeliveryThreshold: number;
	standardDeliveryFee: number;
	bannerNotice: string;
	bannerActive: boolean;
	featuredSeason: string;
	metaPixelId: string;
	facebookCatalogFeedEnabled: boolean;
	currency: string;
	ziinaEnabled?: boolean;
	ziinaTestMode?: boolean;
	ziinaApiKey?: string;
	ziinaWebhookSecret?: string;
}

// Meta Marketing API & Campaign Types
export type MetaCampaignObjective =
	| "OUTCOME_SALES"
	| "OUTCOME_LEADS"
	| "OUTCOME_TRAFFIC"
	| "OUTCOME_AWARENESS";

export type MetaCampaignStatus = "ACTIVE" | "PAUSED" | "ARCHIVED" | "IN_REVIEW";

export interface MetaCampaign {
	id: string;
	name: string;
	objective: MetaCampaignObjective;
	status: MetaCampaignStatus;
	dailyBudget: number; // in AED
	spentAED: number;
	impressions: number;
	clicks: number;
	leadsCount: number;
	conversions: number;
	targetEmirates: string[];
	targetInterests: string[];
	productCategory: ProductCategory | "all";
	headline: string;
	primaryText: string;
	callToAction: "SHOP_NOW" | "ORDER_NOW" | "GET_QUOTE" | "WHATSAPP_MESSAGE";
	imageUrl: string;
	leadFormName?: string;
	createdAt: string;
}

// AI Helper & Lead Capture Pipeline Types
export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

export interface MarketingLead {
	id: string;
	customerName: string;
	phone: string;
	emirate: string;
	sourceCampaign: string;
	interestedProduct: string;
	quantityEstimated: string;
	budgetAED?: number;
	leadStatus: LeadStatus;
	notes?: string;
	aiScore?: "high" | "medium" | "low";
	aiSummary?: string;
	createdAt: string;
	totalEstimatedValueAED?: number;
	name?: string;
	city?: string;
	interestedProducts?: string[];
	status?: string;
}

export interface MetaMarketingApiConfig {
	adAccountId: string;
	accessToken: string;
	pixelId: string;
	catalogId: string;
	businessManagerId: string;
	isConnected: boolean;
	apiVersion: string;
}

export interface McpServerItem {
	transport: "http" | "sse" | "stdio" | string;
	url: string;
	headers?: Record<string, string>;
}

export interface McpServersConfig {
	mcpServers: {
		"meta-mcp": McpServerItem;
		[key: string]: McpServerItem;
	};
}
