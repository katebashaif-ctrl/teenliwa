import React, { createContext, useContext, useState, useEffect } from "react";
import type {
	Product,
	Order,
	StoreSettings,
	CartItem,
	ProductCategory,
	MetaCampaign,
	MarketingLead,
	MetaMarketingApiConfig,
	LeadStatus,
	McpServersConfig,
} from "../types/store";
import {
	INITIAL_SETTINGS,
	INITIAL_META_CONFIG,
	DEFAULT_MCP_CONFIG,
} from "../data/initialData";
import { getAdminRequestHeaders } from "../utils/adminAuth";
import { t } from "../frontend/locales/i18n";

interface ToastNotification {
	id: string;
	title: string;
	message: string;
	type: "success" | "info" | "warning";
}

export type CookieConsentStatus = "accepted" | "rejected" | "custom" | null;

export type CMSTabType =
	| "overview"
	| "ai_agent"
	| "products"
	| "orders"
	| "marketing"
	| "ziina"
	| "r2"
	| "settings"
	| "mcp"
	| "campaigns"
	| "meta";

interface StoreContextType {
	// Catalog
	products: Product[];
	addProduct: (product: Omit<Product, "id">) => void;
	updateProduct: (id: string, updates: Partial<Product>) => Promise<void> | void;
	deleteProduct: (id: string) => void;
	toggleProductStock: (id: string) => void;

	// Orders
	orders: Order[];
	addOrder: (orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "status">) => Promise<Order>;
	updateOrderStatus: (orderId: string, status: Order["status"]) => Promise<void>;
	updateOrderPaymentDetails: (orderId: string, details: Partial<Order>) => void;
	deleteOrder: (orderId: string) => Promise<void>;
	fetchOrdersFromDatabase: () => Promise<boolean>;
	isOrdersLoading: boolean;
	ordersStorageType: string;

	// Cart
	cart: CartItem[];
	addToCart: (product: Product, quantity?: number, packaging?: string) => void;
	updateCartQty: (productId: string, quantity: number) => void;
	removeFromCart: (productId: string) => void;
	clearCart: () => void;
	cartTotal: number;
	cartItemsCount: number;
	isCartOpen: boolean;
	setIsCartOpen: (open: boolean) => void;

	// Settings
	settings: StoreSettings;
	updateSettings: (newSettings: Partial<StoreSettings>) => void;
	resetToSampleData: () => void;

	// Cloudflare R2 Sync
	isR2Synced: boolean;
	syncCatalogToR2: (prods?: Product[], sets?: StoreSettings) => Promise<boolean>;
	fetchCatalogFromR2: () => Promise<boolean>;

	// UI Navigation
	currentView: "store" | "cms";
	setCurrentView: (view: "store" | "cms") => void;
	cmsTab: CMSTabType;
	setCmsTab: (tab: CMSTabType) => void;
	selectedProduct: Product | null;
	setSelectedProduct: (product: Product | null) => void;

	// Filters
	activeCategory: ProductCategory | "all";
	setActiveCategory: (cat: ProductCategory | "all") => void;
	searchQuery: string;
	setSearchQuery: (query: string) => void;

	// Checkout & Success
	lastOrder: Order | null;
	setLastOrder: (order: Order | null) => void;

	// Admin Authentication (admin / admin)
	isAdminAuthenticated: boolean;
	adminLogin: (username: string, pass: string) => Promise<boolean>;
	adminLogout: () => void;
	isAdminLoginModalOpen: boolean;
	setIsAdminLoginModalOpen: (open: boolean) => void;
	openCmsProtected: () => void;

	// Cookie Consent & Privacy Policy
	cookieConsent: CookieConsentStatus;
	setCookieConsent: (val: "accepted" | "rejected" | "custom") => void;
	isPrivacyModalOpen: boolean;
	setIsPrivacyModalOpen: (open: boolean) => void;
	privacyModalTab: "privacy" | "terms" | "cookies";
	setPrivacyModalTab: (tab: "privacy" | "terms" | "cookies") => void;
	openPrivacyPolicy: (tab?: "privacy" | "terms" | "cookies") => void;

	// Meta Marketing API Campaigns
	metaCampaigns: MetaCampaign[];
	addMetaCampaign: (
		campaign: Omit<
			MetaCampaign,
			"id" | "spentAED" | "impressions" | "clicks" | "leadsCount" | "conversions" | "createdAt"
		>,
	) => MetaCampaign;
	toggleCampaignStatus: (id: string) => void;
	updateCampaignBudget: (id: string, budget: number) => void;
	deleteCampaign: (id: string) => void;

	// AI Marketing Leads Pipeline
	marketingLeads: MarketingLead[];
	addMarketingLead: (lead: Omit<MarketingLead, "id" | "createdAt">) => MarketingLead;
	updateLeadStatus: (id: string, status: LeadStatus) => void;
	updateLeadScore: (id: string, score: "high" | "medium" | "low", summary?: string) => void;
	deleteLead: (id: string) => void;

	// Meta API Config
	metaConfig: MetaMarketingApiConfig;
	updateMetaConfig: (config: Partial<MetaMarketingApiConfig>) => void;

	// Custom MCP Server Config ({ mcpServers: { 'meta-mcp': { transport, url, headers } } })
	mcpConfig: McpServersConfig;
	updateMcpConfig: (config: McpServersConfig) => void;
	resetMcpConfig: () => void;

	// Meta / Facebook Ads Event Tracking
	trackMetaEvent: (eventName: string, params?: Record<string, unknown>) => void;

	// Toasts
	toasts: ToastNotification[];
	showToast: (title: string, message: string, type?: ToastNotification["type"]) => void;
	removeToast: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEYS = {
	PRODUCTS: "teen_liwa_products_v2",
	ORDERS: "teen_liwa_orders_v2",
	SETTINGS: "teen_liwa_settings_v2",
	CART: "teen_liwa_cart_v2",
	ADMIN_AUTH: "teen_liwa_admin_auth_v2",
	COOKIE_CONSENT: "teen_liwa_cookie_consent_v2",
	META_CAMPAIGNS: "teen_liwa_meta_campaigns_v2",
	LEADS: "teen_liwa_leads_v2",
	META_CONFIG: "teen_liwa_meta_config_v2",
	MCP_CONFIG: "teen_liwa_mcp_config_v2",
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [products, setProducts] = useState<Product[]>([]);
	const [orders, setOrders] = useState<Order[]>([]);
	const [settings, setSettings] = useState<StoreSettings>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
				if (saved) {
					const parsed = JSON.parse(saved);
					delete parsed.ziinaApiKey;
					return { ...INITIAL_SETTINGS, ...parsed, ziinaApiKey: "" };
				}
			} catch (e) {}
		}
		return INITIAL_SETTINGS;
	});
	const [mcpConfig, setMcpConfig] = useState<McpServersConfig>(DEFAULT_MCP_CONFIG);
	const [cart, setCart] = useState<CartItem[]>([]);
	const [currentView, setCurrentView] = useState<"store" | "cms">("store");
	const [cmsTab, setCmsTab] = useState<CMSTabType>("overview");
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [activeCategory, setActiveCategory] = useState<ProductCategory | "all">("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [isCartOpen, setIsCartOpen] = useState(false);
	const [lastOrder, setLastOrder] = useState<Order | null>(null);
	const [toasts, setToasts] = useState<ToastNotification[]>([]);
	const [isClient, setIsClient] = useState(false);

	const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
	const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);

	// Cookie Consent & Legal Modals - synchronously checks localStorage & cookies
	const [cookieConsent, setCookieConsentState] = useState<CookieConsentStatus>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved =
					localStorage.getItem(STORAGE_KEYS.COOKIE_CONSENT) ||
					localStorage.getItem("teen_liwa_cookie_consent");
				if (saved === "accepted" || saved === "rejected" || saved === "custom") {
					return saved as CookieConsentStatus;
				}
				if (document.cookie.includes("teen_liwa_cookie_consent=accepted")) return "accepted";
				if (document.cookie.includes("teen_liwa_cookie_consent=rejected")) return "rejected";
				if (document.cookie.includes("teen_liwa_cookie_consent=custom")) return "custom";
			} catch (e) {}
		}
		return null;
	});
	const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
	const [privacyModalTab, setPrivacyModalTab] = useState<"privacy" | "terms" | "cookies">("privacy");

	// Meta Marketing API Campaigns & Leads
	const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
	const [marketingLeads, setMarketingLeads] = useState<MarketingLead[]>([]);
	const [metaConfig, setMetaConfig] = useState<MetaMarketingApiConfig>(INITIAL_META_CONFIG);

	// Cloudflare R2 Sync & Orders Database state
	const [isR2Synced, setIsR2Synced] = useState<boolean>(false);
	const [isOrdersLoading, setIsOrdersLoading] = useState<boolean>(false);
	const [ordersStorageType, setOrdersStorageType] = useState<string>("database");

	// Fetch all orders from persistent Database (Cloudflare D1 SQL & R2 cloud store)
	const fetchOrdersFromDatabase = async (): Promise<boolean> => {
		setIsOrdersLoading(true);
		try {
			const res = await fetch("/api/orders", {
				headers: getAdminRequestHeaders(),
			});
			if (res.status === 401 || res.status === 403) {
				setIsOrdersLoading(false);
				return false;
			}
			const json = (await res.json()) as any;
			if (json.success && Array.isArray(json.orders)) {
				setOrders(json.orders);
				if (json.storageType) {
					setOrdersStorageType(json.storageType);
				}
				if (isClient) {
					try {
					} catch (e) {}
				}
				setIsOrdersLoading(false);
				return true;
			}
		} catch (err) {
			console.warn("Could not load orders from /api/orders:", err);
		}
		setIsOrdersLoading(false);
		return false;
	};

	const refreshProductsFromServer = async (): Promise<boolean> => {
		try {
			const res = await fetch("/api/products", {
				headers: getAdminRequestHeaders(),
			});
			if (!res.ok) return false;
			const json = (await res.json()) as any;
			if (json.success && Array.isArray(json.products)) {
				const nextProducts = json.products as Product[];
				setProducts(nextProducts);
				if (isClient) {
					try {
						localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(nextProducts));
					} catch (e) {}
				}
				return true;
			}
		} catch (err) {
			console.warn("Could not refresh products from /api/products:", err);
		}
		return false;
	};

	// D1 v2 is the only catalogue/settings source of truth; R2 is reserved for image objects.
	const fetchCatalogFromR2 = async (): Promise<boolean> => false;
	const syncCatalogToR2 = async (_prodsToSync?: Product[], _setsToSync?: StoreSettings): Promise<boolean> => false;


	// Load from localStorage on client mount, then load live from R2
	useEffect(() => {
		setIsClient(true);
		try {
			const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
			if (savedSettings) { const parsedSettings = JSON.parse(savedSettings); delete parsedSettings.ziinaApiKey; setSettings({ ...INITIAL_SETTINGS, ...parsedSettings, ziinaApiKey: "" }); }

			const savedCart = localStorage.getItem(STORAGE_KEYS.CART);
			if (savedCart) setCart(JSON.parse(savedCart));


			const savedConsent = localStorage.getItem(STORAGE_KEYS.COOKIE_CONSENT);
			if (savedConsent) setCookieConsentState(savedConsent as CookieConsentStatus);




			const savedMcp = localStorage.getItem(STORAGE_KEYS.MCP_CONFIG);
			if (savedMcp) {
				try {
					setMcpConfig(JSON.parse(savedMcp));
				} catch (e) {}
			}
		} catch (e) {
			console.error("Error reading localStorage:", e);
		}

		fetch("/api/admin/session", { credentials: "same-origin" })
			.then((res) => res.ok ? res.json() : { authenticated: false })
			.then((data) => {
				const authenticated = data.authenticated === true;
				setIsAdminAuthenticated(authenticated);
				if (authenticated) {
					fetchOrdersFromDatabase();
					fetch("/api/meta/campaigns", { credentials: "same-origin" })
						.then((response) => response.ok ? response.json() : null)
						.then((result) => {
							if (result?.success) {
								setMetaCampaigns(Array.isArray(result.campaigns) ? result.campaigns : []);
								if (result.config) setMetaConfig({ ...INITIAL_META_CONFIG, ...result.config, accessToken: "" });
							}
						})
						.catch((error) => console.warn("Meta CMS data could not be loaded:", error));
				}
			})
			.catch(() => setIsAdminAuthenticated(false));

		// D1 v2 is authoritative. An empty database intentionally produces an empty storefront.
		refreshProductsFromServer();
		fetch("/api/settings", { credentials: "same-origin" })
			.then((res) => res.ok ? res.json() : null)
			.then((data) => {
				if (data?.success && data.settings) {
					setSettings((prev) => ({ ...prev, ...data.settings, ziinaApiKey: "" }));
				}
			})
			.catch((error) => console.warn("Could not load store settings from D1:", error));
	}, []);

	// Sync to localStorage

	useEffect(() => {
		if (!isClient) return;
		try {
		} catch (e) {}
	}, [orders, isClient]);

	useEffect(() => {
		if (!isClient) return;
		try {
			const safeSettings = { ...settings } as any; delete safeSettings.ziinaApiKey; localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(safeSettings));
		} catch (e) {}
	}, [settings, isClient]);

	useEffect(() => {
		if (!isClient) return;
		try {
			localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
		} catch (e) {}
	}, [cart, isClient]);




	useEffect(() => {
		if (!isClient) return;
		try {
			localStorage.setItem(STORAGE_KEYS.MCP_CONFIG, JSON.stringify(mcpConfig));
		} catch (e) {}
	}, [mcpConfig, isClient]);

	const updateMcpConfig = (newConfig: McpServersConfig) => {
		setMcpConfig(newConfig);
		if (isClient) {
			try {
				localStorage.setItem(STORAGE_KEYS.MCP_CONFIG, JSON.stringify(newConfig));
			} catch (e) {}
		}
		showToast(t("toasts.mcpUpdated"), t("toasts.mcpUpdatedMsg"));
	};

	const resetMcpConfig = () => {
		setMcpConfig(DEFAULT_MCP_CONFIG);
		if (isClient) {
			try {
				localStorage.setItem(STORAGE_KEYS.MCP_CONFIG, JSON.stringify(DEFAULT_MCP_CONFIG));
			} catch (e) {}
		}
		showToast(t("toasts.mcpReset"), t("toasts.mcpResetMsg"));
	};

	// Toast helper
	const showToast = (title: string, message: string, type: ToastNotification["type"] = "success") => {
		const id = Math.random().toString(36).substring(2, 9);
		setToasts((prev) => [...prev, { id, title, message, type }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 4000);
	};

	const removeToast = (id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	};

	// Credentials are verified only by the server; the session cookie is HttpOnly.
	const adminLogin = async (username: string, pass: string): Promise<boolean> => {
		try {
			const response = await fetch("/api/admin/session", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password: pass }),
			});
			const data = await response.json() as any;
			if (!response.ok || !data.success) return false;
			setIsAdminAuthenticated(true);
			setIsAdminLoginModalOpen(false);
			setCurrentView("cms");
			showToast(t("toasts.welcomeAdmin"), t("toasts.welcomeAdminMsg"));
			await fetchOrdersFromDatabase();
			await refreshProductsFromServer();
			return true;
		} catch { return false; }
	};

	const adminLogout = async () => {
		try { await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" }); } catch {}
		setIsAdminAuthenticated(false);
		setOrders([]);
		setCurrentView("store");
		showToast(t("toasts.logout"), t("toasts.logoutMsg"), "info");
	};
	const openCmsProtected = () => {
		if (isAdminAuthenticated) {
			setCurrentView("cms");
		} else {
			setIsAdminLoginModalOpen(true);
		}
	};

	// Cookie Consent & Legal
	const setCookieConsent = (val: "accepted" | "rejected" | "custom") => {
		setCookieConsentState(val);
		if (typeof window !== "undefined") {
			try {
				localStorage.setItem(STORAGE_KEYS.COOKIE_CONSENT, val);
				localStorage.setItem("teen_liwa_cookie_consent", val);
				const isSecure = window.location.protocol === "https:";
				const secureFlag = isSecure ? "; Secure" : "";
				document.cookie = `teen_liwa_cookie_consent=${val}; path=/; max-age=31536000; SameSite=Lax${secureFlag}`;
			} catch (e) {}
		}
		if (val === "accepted") {
			showToast(t("toasts.cookieSaved"), t("toasts.cookieSavedMsg"));
		}
	};

	const openPrivacyPolicy = (tab: "privacy" | "terms" | "cookies" = "privacy") => {
		setPrivacyModalTab(tab);
		setIsPrivacyModalOpen(true);
	};

	// Meta / Facebook Pixel Tracking
	const trackMetaEvent = (eventName: string, params?: Record<string, unknown>) => {
		if (typeof window !== "undefined" && (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq) {
			try {
				(window as unknown as { fbq: (...args: unknown[]) => void }).fbq("track", eventName, params);
			} catch (err) {
				console.warn("Meta Pixel track error:", err);
			}
		}
	};

	// Product mutations with synchronous Cloudflare R2 storage
	const uploadProductImage = async (image: string, imageName: string): Promise<string> => {
		if (!image.startsWith("data:image/")) return image;
		const response = await fetch("/api/r2", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json", ...getAdminRequestHeaders() },
			body: JSON.stringify({ intent: "upload_base64", imageBase64: image, imageName }),
		});
		const data = await response.json() as any;
		if (!response.ok || !data.success || !data.url) throw new Error(data.error || "Product image upload failed");
		return data.url;
	};

	const addProduct = async (productData: Omit<Product, "id">) => {
		try {
			const image = await uploadProductImage(productData.image || "", productData.nameEn || productData.name || "product");
			const product: Omit<Product, "id"> = {
				...productData,
				image,
				inStock: productData.inStock !== false,
				trackInventory: productData.trackInventory ?? productData.stockQuantity !== undefined,
			};
			const response = await fetch("/api/products", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json", ...getAdminRequestHeaders() },
				body: JSON.stringify({ intent: "create_product", product }),
			});
			const data = await response.json() as any;
			if (!response.ok || !data.success) throw new Error(data.error || "Product could not be saved");
			await refreshProductsFromServer();
			showToast(t("toasts.productAdded"), t("toasts.productAddedMsg"));
		} catch (error) {
			await refreshProductsFromServer();
			showToast("تعذر حفظ المنتج", error instanceof Error ? error.message : "حاول مرة أخرى", "warning");
			throw error;
		}
	};

	const updateProduct = async (id: string, updates: Partial<Product>) => {
		try {
			const normalizedUpdates: Partial<Product> = { ...updates };
			if (normalizedUpdates.image) {
				normalizedUpdates.image = await uploadProductImage(
					normalizedUpdates.image,
					normalizedUpdates.nameEn || normalizedUpdates.name || id,
				);
			}
			if (updates.inStock !== undefined && updates.disabled === undefined) {
				normalizedUpdates.disabled = updates.inStock ? 0 : 1;
				normalizedUpdates.disabledTxt = updates.inStock ? "متوفر" : "قريباً";
			} else if (updates.disabled !== undefined && updates.inStock === undefined) {
				normalizedUpdates.inStock = updates.disabled === 0;
				normalizedUpdates.disabledTxt = updates.disabled === 0 ? "متوفر" : "قريباً";
			}
			const response = await fetch("/api/products", {
				method: "PATCH",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json", ...getAdminRequestHeaders() },
				body: JSON.stringify({ intent: "update_product", id, updates: normalizedUpdates }),
			});
			const data = await response.json() as any;
			if (!response.ok || !data.success) throw new Error(data.error || "Product changes could not be saved");
			await refreshProductsFromServer();
			showToast(t("toasts.productUpdated"), t("toasts.productUpdatedMsg"));
		} catch (error) {
			await refreshProductsFromServer();
			showToast("تعذر تحديث المنتج", error instanceof Error ? error.message : "حاول مرة أخرى", "warning");
			throw error;
		}
	};

	const deleteProduct = async (id: string) => {
		try {
			const response = await fetch("/api/products", {
				method: "DELETE",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json", ...getAdminRequestHeaders() },
				body: JSON.stringify({ intent: "delete_product", id }),
			});
			const data = await response.json() as any;
			if (!response.ok || !data.success) throw new Error(data.error || "Product could not be archived");
			await refreshProductsFromServer();
			showToast(t("toasts.productDeleted"), t("toasts.productDeletedMsg"), "info");
		} catch (error) {
			await refreshProductsFromServer();
			showToast("تعذر حذف المنتج", error instanceof Error ? error.message : "حاول مرة أخرى", "warning");
			throw error;
		}
	};

	const toggleProductStock = async (id: string) => {
		const target = products.find((product) => product.id === id);
		if (!target) return;
		try {
			const nextInStock = !target.inStock;
			const nextStockQty = nextInStock
				? (target.stockQuantity && target.stockQuantity > 0 ? target.stockQuantity : 25)
				: 0;
			const response = await fetch("/api/products", {
				method: "PATCH",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json", ...getAdminRequestHeaders() },
				body: JSON.stringify({
					intent: "update_product",
					id,
					updates: {
						inStock: nextInStock,
						disabled: nextInStock ? 0 : 1,
						disabledTxt: nextInStock ? "متوفر" : "قريباً",
						stockQuantity: nextStockQty,
						trackInventory: true,
					},
				}),
			});
			const data = await response.json() as any;
			if (!response.ok || !data.success) throw new Error(data.error || "Stock status could not be saved");
			await refreshProductsFromServer();
			showToast(
				nextInStock ? "تم تفعيل توفر المنتج" : "تم تعطيل المنتج",
				`${target.name}: ${nextInStock ? "متوفر للطلب" : "غير متوفر حالياً"}`,
			);
		} catch (error) {
			await refreshProductsFromServer();
			showToast("تعذر تحديث المخزون", error instanceof Error ? error.message : "حاول مرة أخرى", "warning");
		}
	};

	// Cart operations
	const addToCart = (
		product: Product,
		quantity: number = 1,
		packaging?: string,
	) => {
		setCart((prev) => {
			const existingIndex = prev.findIndex(
				(item) => item.product.id === product.id,
			);
			if (existingIndex > -1) {
				const updated = [...prev];
				updated[existingIndex].quantity += quantity;
				return updated;
			}
			return [...prev, { product, quantity, packagingOption: packaging }];
		});

		// Track Meta Pixel AddToCart event
		trackMetaEvent("AddToCart", {
			content_name: product.name,
			content_category: product.category,
			content_ids: [product.id],
			content_type: "product",
			value: product.price * quantity,
			currency: "AED",
		});

		showToast(t("toasts.addedToCart"), t("toasts.addedToCartMsg"));
	};

	const updateCartQty = (productId: string, quantity: number) => {
		if (quantity <= 0) {
			removeFromCart(productId);
			return;
		}
		setCart((prev) =>
			prev.map((item) =>
				item.product.id === productId ? { ...item, quantity } : item,
			),
		);
	};

	const removeFromCart = (productId: string) => {
		setCart((prev) => prev.filter((item) => item.product.id !== productId));
	};

	const clearCart = () => {
		setCart([]);
	};

	const cartTotal = cart.reduce(
		(sum, item) => sum + item.product.price * item.quantity,
		0,
	);
	const cartItemsCount = cart.reduce((count, item) => count + item.quantity, 0);

	// Order operations with persistent database storage (Cloudflare D1 & R2)
	const addOrder = async (
		orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "status">,
	): Promise<Order> => {
		const tempId = `pending-${Date.now().toString(36)}`;
		const optimisticOrder: Order = {
			...orderData,
			id: tempId,
			orderNumber: "Pending",
			status: "pending",
			createdAt: new Date().toISOString(),
		};
		setOrders((prev) => [optimisticOrder, ...prev]);

		try {
			const res = await fetch("/api/orders", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					intent: "create_order",
					customerName: orderData.customerName,
					customerPhone: orderData.customerPhone,
					customerEmirate: orderData.customerEmirate,
					customerAddress: orderData.customerAddress,
					notes: orderData.notes,
					giftNote: orderData.giftNote,
					paymentMethod: orderData.paymentMethod,
					items: orderData.items.map((item) => ({
						productId: item.productId,
						quantity: item.quantity,
						packagingOption: item.packagingOption,
					})),
				}),
			});
			const json = await res.json() as any;
			if (!res.ok || !json.success || !json.order) {
				throw new Error(json.error || "The order could not be saved. Please try again.");
			}
			const rawOrder = json.order.order || json.order;
			const savedOrder: Order = { ...rawOrder, items: rawOrder.items || [] };
			setOrders((prev) => [savedOrder, ...prev.filter((order) => order.id !== tempId)]);
			if (orderData.paymentMethod !== "ziina") {
				clearCart();
				setLastOrder(savedOrder);
			}
			showToast(t("toasts.orderSaved"), `${t("orderSuccess.orderNumber")}: ${savedOrder.orderNumber}`);
			return savedOrder;
		} catch (error) {
			setOrders((prev) => prev.filter((order) => order.id !== tempId));
			throw error instanceof Error ? error : new Error("Order could not be saved");
		}
	};

	const updateOrderStatus = async (orderId: string, status: Order["status"]) => {
		try {
			const response = await fetch("/api/orders", {
				method: "PATCH",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json", ...getAdminRequestHeaders() },
				body: JSON.stringify({ intent: "update_status", orderId, status }),
			});
			const data = await response.json() as any;
			if (!response.ok || !data.success) throw new Error(data.error || "Order status could not be saved");
			setOrders((prev) => prev.map((order) => order.id === orderId ? { ...order, status } : order));
			showToast(t("toasts.orderUpdated"), `${orderId}: ${status}`);
		} catch (error) {
			showToast("تعذر تحديث الطلب", error instanceof Error ? error.message : "حاول مرة أخرى", "warning");
			await fetchOrdersFromDatabase();
		}
	};

	const updateOrderPaymentDetails = (
		orderId: string,
		details: Partial<Order>,
	) => {
		setOrders((prev) => {
			const updated = prev.map((o) => {
				if (
					o.id === orderId ||
					o.orderNumber === orderId ||
					(o.ziinaPaymentIntentId && o.ziinaPaymentIntentId === orderId)
				) {
					return { ...o, ...details };
				}
				return o;
			});
			if (typeof window !== "undefined") {
				try {
				} catch {}
			}
			return updated;
		});

		// Persist update to database
		fetch("/api/orders", {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...getAdminRequestHeaders(),
			},
			body: JSON.stringify({
				intent: "update_payment",
				orderId,
				paymentStatus: details.paymentStatus || "pending",
				ziinaPaymentIntentId: details.ziinaPaymentIntentId,
				ziinaRedirectUrl: details.ziinaRedirectUrl,
				transactionId: details.transactionId,
				cardBrand: details.cardBrand,
				cardLastFour: details.cardLastFour,
				orderStatus: details.status,
			}),
		}).catch((e) => console.warn("Failed to sync order payment details:", e));
	};

	const deleteOrder = async (orderId: string) => {
		try {
			const response = await fetch("/api/orders", {
				method: "DELETE",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json", ...getAdminRequestHeaders() },
				body: JSON.stringify({ intent: "delete_order", orderId }),
			});
			const data = await response.json() as any;
			if (!response.ok || !data.success) throw new Error(data.error || "Order could not be archived");
			setOrders((prev) => prev.filter((order) => order.id !== orderId));
			showToast(t("toasts.orderDeleted"), t("toasts.orderDeletedMsg"), "info");
		} catch (error) {
			showToast("تعذر أرشفة الطلب", error instanceof Error ? error.message : "حاول مرة أخرى", "warning");
			await fetchOrdersFromDatabase();
		}
	};

	// Meta Campaign Operations
	const addMetaCampaign = (
		campaignData: Omit<
			MetaCampaign,
			"id" | "spentAED" | "impressions" | "clicks" | "leadsCount" | "conversions" | "createdAt"
		>,
	): MetaCampaign => {
		const newCampaign: MetaCampaign = {
			...campaignData,
			id: `camp-meta-${Date.now().toString(36)}`,
			spentAED: 0,
			impressions: 0,
			clicks: 0,
			leadsCount: 0,
			conversions: 0,
			createdAt: new Date().toISOString(),
		};

		setMetaCampaigns((prev) => [newCampaign, ...prev]);
		showToast(t("toasts.campaignAdded"), `${newCampaign.name}`);
		return newCampaign;
	};

	const toggleCampaignStatus = (id: string) => {
		setMetaCampaigns((prev) =>
			prev.map((c) =>
				c.id === id
					? {
							...c,
							status: c.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
						}
					: c,
			),
		);
		const target = metaCampaigns.find((c) => c.id === id);
		showToast(
			t("toasts.campaignStatus"),
			`${target?.status === "ACTIVE" ? "PAUSED" : "ACTIVE"}`
		);
	};

	const updateCampaignBudget = (id: string, budget: number) => {
		setMetaCampaigns((prev) =>
			prev.map((c) => (c.id === id ? { ...c, dailyBudget: budget } : c)),
		);
		showToast(t("toasts.budgetUpdated"), `${budget} AED`);
	};

	const deleteCampaign = (id: string) => {
		setMetaCampaigns((prev) => prev.filter((c) => c.id !== id));
		showToast(t("toasts.campaignDeleted"), t("toasts.campaignDeletedMsg"), "info");
	};

	// Marketing Leads Operations
	const addMarketingLead = (leadData: Omit<MarketingLead, "id" | "createdAt">): MarketingLead => {
		const newLead: MarketingLead = {
			...leadData,
			id: `lead-${Date.now().toString(36)}`,
			createdAt: new Date().toISOString(),
		};

		setMarketingLeads((prev) => [newLead, ...prev]);
		showToast(t("toasts.leadAdded"), `${newLead.customerName}`);
		return newLead;
	};

	const updateLeadStatus = (id: string, status: LeadStatus) => {
		setMarketingLeads((prev) =>
			prev.map((l) => (l.id === id ? { ...l, leadStatus: status } : l)),
		);
		showToast(t("toasts.leadStatusUpdated"), `${status}`);
	};

	const updateLeadScore = (id: string, score: "high" | "medium" | "low", summary?: string) => {
		setMarketingLeads((prev) =>
			prev.map((l) => (l.id === id ? { ...l, aiScore: score, aiSummary: summary || l.aiSummary } : l)),
		);
		showToast(t("toasts.leadScoreUpdated"), t("toasts.leadScoreUpdatedMsg"));
	};

	const deleteLead = (id: string) => {
		setMarketingLeads((prev) => prev.filter((l) => l.id !== id));
		showToast(t("toasts.leadDeleted"), t("toasts.leadDeletedMsg"), "info");
	};

	// Meta Config
	const updateMetaConfig = (newConfig: Partial<MetaMarketingApiConfig>) => {
		const safeConfig = { ...newConfig } as Partial<MetaMarketingApiConfig>;
		const suppliedToken = Boolean(String(safeConfig.accessToken || "").trim());
		delete (safeConfig as any).accessToken;
		setMetaConfig((prev) => ({ ...prev, ...safeConfig, accessToken: "" }));
		if (suppliedToken) showToast("Meta API credentials", "The access token is not saved in the browser. Configure META_ACCESS_TOKEN as a Cloudflare Worker secret.", "warning");
		else showToast(t("toasts.metaSettings"), t("toasts.metaSettingsMsg"));
	};

	// Settings & Reset
	const updateSettings = (newSettings: Partial<StoreSettings>) => {
		const safeNewSettings = { ...newSettings } as Partial<StoreSettings>;
		delete (safeNewSettings as any).ziinaApiKey;
		setSettings((prev) => {
			const updated = { ...prev, ...safeNewSettings, ziinaApiKey: "" };
			if (typeof window !== "undefined") {
				try {
					const persisted = { ...updated } as any;
					delete persisted.ziinaApiKey;
					localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(persisted));
				} catch {}
			}
			return updated;
		});
		fetch("/api/settings", {
			method: "PUT",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json", ...getAdminRequestHeaders() },
			body: JSON.stringify({ settings: safeNewSettings }),
		})
			.then(async (res) => {
				const data = await res.json().catch(() => ({}));
				if (!res.ok || !data.success) {
					showToast("Settings not saved", data.error || "Could not save settings to the database", "warning");
					return;
				}
				showToast(t("toasts.settingsSaved"), t("toasts.settingsSavedMsg"));
			})
			.catch(() => showToast("Settings not saved", "Could not reach the settings API", "warning"));
	};
	const resetToSampleData = () => {
		showToast("Sample reset disabled", "Production catalogue and orders are stored in D1 and cannot be overwritten with demo data.", "warning");
	};
	return (
		<StoreContext.Provider
			value={{
				products,
				addProduct,
				updateProduct,
				deleteProduct,
				toggleProductStock,
				orders,
				addOrder,
				updateOrderStatus,
				updateOrderPaymentDetails,
				deleteOrder,
				fetchOrdersFromDatabase,
				isOrdersLoading,
				ordersStorageType,
				cart,
				addToCart,
				updateCartQty,
				removeFromCart,
				clearCart,
				cartTotal,
				cartItemsCount,
				isCartOpen,
				setIsCartOpen,
				settings,
				updateSettings,
				resetToSampleData,
				isR2Synced,
				syncCatalogToR2,
				fetchCatalogFromR2,
				currentView,
				setCurrentView,
				cmsTab,
				setCmsTab,
				selectedProduct,
				setSelectedProduct,
				activeCategory,
				setActiveCategory,
				searchQuery,
				setSearchQuery,
				lastOrder,
				setLastOrder,
				isAdminAuthenticated,
				adminLogin,
				adminLogout,
				isAdminLoginModalOpen,
				setIsAdminLoginModalOpen,
				openCmsProtected,
				cookieConsent,
				setCookieConsent,
				isPrivacyModalOpen,
				setIsPrivacyModalOpen,
				privacyModalTab,
				setPrivacyModalTab,
				openPrivacyPolicy,
				metaCampaigns,
				addMetaCampaign,
				toggleCampaignStatus,
				updateCampaignBudget,
				deleteCampaign,
				marketingLeads,
				addMarketingLead,
				updateLeadStatus,
				updateLeadScore,
				deleteLead,
				metaConfig,
				updateMetaConfig,
				mcpConfig,
				updateMcpConfig,
				resetMcpConfig,
				trackMetaEvent,
				toasts,
				showToast,
				removeToast,
			}}
		>
			{children}
		</StoreContext.Provider>
	);
};

export const useStore = () => {
	const context = useContext(StoreContext);
	if (!context) {
		throw new Error("useStore must be used within a StoreProvider");
	}
	return context;
};
