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
	INITIAL_PRODUCTS,
	INITIAL_ORDERS,
	INITIAL_SETTINGS,
	INITIAL_META_CAMPAIGNS,
	INITIAL_LEADS,
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
	const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
	const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
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
	const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>(INITIAL_META_CAMPAIGNS);
	const [marketingLeads, setMarketingLeads] = useState<MarketingLead[]>(INITIAL_LEADS);
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
						localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(json.orders));
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

	const getClientR2SecretKey = (): string => {
		try {
			if (typeof window !== "undefined") {
				const saved = localStorage.getItem("liwa_r2_config");
				if (saved) return JSON.parse(saved).secretAccessKey || "";
			}
		} catch {}
		return "";
	};

	// Fetch catalog synchronously from Cloudflare R2 or local persistent storage
	const fetchCatalogFromR2 = async (): Promise<boolean> => {
		try {
			const secretKey = getClientR2SecretKey();
			const headers: HeadersInit = secretKey ? { "x-r2-secret-key": secretKey } : {};
			const res = await fetch("/api/r2?intent=get_catalog", { headers });
			const json = (await res.json()) as any;
			if (json.success && json.data && Array.isArray(json.data.products) && json.data.products.length > 0) {
				const remoteProducts = json.data.products as Product[];

				// Smart merge with INITIAL_PRODUCTS so authentic products are never wiped out
				setProducts((prev) => {
					const baseList = prev && prev.length >= INITIAL_PRODUCTS.length ? prev : [...INITIAL_PRODUCTS];
					const remoteMap = new Map<string, Product>();
					remoteProducts.forEach((rp) => remoteMap.set(rp.id, rp));

					const merged = baseList.map((p) => {
						if (remoteMap.has(p.id)) {
							const rp = remoteMap.get(p.id)!;
							remoteMap.delete(p.id);
							return { ...p, ...rp };
						}
						return p;
					});
					// Append any new products created in R2
					for (const newProduct of remoteMap.values()) {
						merged.unshift(newProduct);
					}
					return merged;
				});

				if (json.data.settings) {
					setSettings((prev) => {
						const remote = json.data.settings;
						const merged = { ...prev, ...remote, ziinaApiKey: "" };
						return merged;
					});
				}
				if (json.fromR2) {
					setIsR2Synced(true);
				}
				return true;
			}
		} catch (err) {
			console.warn("Could not fetch catalog from R2 on mount:", err);
		}
		return false;
	};

	// Synchronize products & settings directly to Cloudflare R2
	const syncCatalogToR2 = async (prodsToSync?: Product[], setsToSync?: StoreSettings): Promise<boolean> => {
		try {
			const secretKey = getClientR2SecretKey();
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			if (secretKey) headers["x-r2-secret-key"] = secretKey;

			const targetProducts = prodsToSync || products;
			const targetSettings = setsToSync || settings;

			const res = await fetch("/api/r2", {
				method: "POST",
				headers,
				body: JSON.stringify({
					intent: "sync_catalog",
					data: {
						products: targetProducts,
						settings: targetSettings,
						lastUpdated: new Date().toISOString(),
						storeName: "Teen Liwa",
					},
				}),
			});
			const json = (await res.json()) as any;
			if (json.success && json.r2Synced) {
				setIsR2Synced(true);
				return true;
			}
			if (json.localSynced) {
				return true;
			}
		} catch (err) {
			console.warn("Failed to sync catalog to Cloudflare R2:", err);
		}
		return false;
	};


	// Load from localStorage on client mount, then load live from R2
	useEffect(() => {
		setIsClient(true);
		try {
			const savedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
			if (savedProducts) {
				const parsed = JSON.parse(savedProducts);
				if (Array.isArray(parsed) && parsed.length >= INITIAL_PRODUCTS.length) {
					setProducts(parsed);
				} else if (Array.isArray(parsed) && parsed.length > 0) {
					// Merge with initial products to never lose catalog items
					const map = new Map<string, Product>();
					parsed.forEach((p: Product) => map.set(p.id, p));
					const merged = INITIAL_PRODUCTS.map((p) => (map.has(p.id) ? { ...p, ...map.get(p.id)! } : p));
					for (const [id, p] of map.entries()) {
						if (!merged.some((m) => m.id === id)) merged.unshift(p);
					}
					setProducts(merged);
				}
			}

			const savedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
			if (savedOrders) setOrders(JSON.parse(savedOrders));

			const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
			if (savedSettings) { const parsedSettings = JSON.parse(savedSettings); delete parsedSettings.ziinaApiKey; setSettings({ ...INITIAL_SETTINGS, ...parsedSettings, ziinaApiKey: "" }); }

			const savedCart = localStorage.getItem(STORAGE_KEYS.CART);
			if (savedCart) setCart(JSON.parse(savedCart));


			const savedConsent = localStorage.getItem(STORAGE_KEYS.COOKIE_CONSENT);
			if (savedConsent) setCookieConsentState(savedConsent as CookieConsentStatus);

			const savedCampaigns = localStorage.getItem(STORAGE_KEYS.META_CAMPAIGNS);
			if (savedCampaigns) setMetaCampaigns(JSON.parse(savedCampaigns));

			const savedLeads = localStorage.getItem(STORAGE_KEYS.LEADS);
			if (savedLeads) setMarketingLeads(JSON.parse(savedLeads));

			const savedConfig = localStorage.getItem(STORAGE_KEYS.META_CONFIG);
			if (savedConfig) setMetaConfig(JSON.parse(savedConfig));

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
				if (authenticated) fetchOrdersFromDatabase();
			})
			.catch(() => setIsAdminAuthenticated(false));

		// Prefer the server-backed product list over static R2 merge.
		refreshProductsFromServer();
		fetchCatalogFromR2();
	}, []);

	// Sync to localStorage
	useEffect(() => {
		if (!isClient) return;
		try {
			localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
		} catch (e) {}
	}, [products, isClient]);

	useEffect(() => {
		if (!isClient) return;
		try {
			localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
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
			localStorage.setItem(STORAGE_KEYS.META_CAMPAIGNS, JSON.stringify(metaCampaigns));
		} catch (e) {}
	}, [metaCampaigns, isClient]);

	useEffect(() => {
		if (!isClient) return;
		try {
			localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(marketingLeads));
		} catch (e) {}
	}, [marketingLeads, isClient]);

	useEffect(() => {
		if (!isClient) return;
		try {
			localStorage.setItem(STORAGE_KEYS.META_CONFIG, JSON.stringify(metaConfig));
		} catch (e) {}
	}, [metaConfig, isClient]);

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
	const addProduct = async (productData: Omit<Product, "id">) => {
		const newId = `prod-${Date.now().toString(36)}`;
		let finalImage = productData.image;

		// Ensure that if the image was base64, it's uploaded to Cloudflare R2
		if (finalImage && finalImage.startsWith("data:image/")) {
			try {
				const uploadRes = await fetch("/api/r2", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						intent: "upload_base64",
						imageBase64: finalImage,
						imageName: productData.nameEn || productData.name || "product",
					}),
				});
				const uploadData = (await uploadRes.json()) as any;
				if (uploadData.success && uploadData.url) {
					finalImage = uploadData.url;
				}
			} catch (err) {
				console.warn("Could not upload product image to R2:", err);
			}
		}

		const inStock = productData.inStock !== false;
		const newProduct: Product = {
			...productData,
			image: finalImage,
			id: newId,
			inStock,
			disabled: inStock ? 0 : 1,
			disabledTxt: inStock ? (productData.disabledTxt || "متوفر") : (productData.disabledTxt || "قريباً"),
		};
		const updated = [newProduct, ...products];
		setProducts(updated);
		if (isClient) {
			try {
				localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
			} catch {}
		}
		showToast(t("toasts.productAdded"), t("toasts.productAddedMsg"));

		// Sync directly to Cloudflare R2 (non-blocking)
		syncCatalogToR2(updated);

		// Synchronize to backend /api/products and re-sync from server state
		try {
			const res = await fetch("/api/products", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...getAdminRequestHeaders(),
				},
				body: JSON.stringify({
					intent: "create_product",
					product: newProduct,
				}),
			});
			const json = (await res.json()) as any;
			if (json.success) {
				await refreshProductsFromServer();
			}
		} catch (e) {
			console.warn("Backend create product sync error:", e);
		}
	};

	const updateProduct = async (id: string, updates: Partial<Product>) => {
		const normalizedUpdates: Partial<Product> = { ...updates };

		// If updated image is base64, store permanently in Cloudflare R2
		if (normalizedUpdates.image && normalizedUpdates.image.startsWith("data:image/")) {
			try {
				const uploadRes = await fetch("/api/r2", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						intent: "upload_base64",
						imageBase64: normalizedUpdates.image,
						imageName: normalizedUpdates.nameEn || normalizedUpdates.name || id,
					}),
				});
				const uploadData = (await uploadRes.json()) as any;
				if (uploadData.success && uploadData.url) {
					normalizedUpdates.image = uploadData.url;
				}
			} catch (err) {
				console.warn("Could not upload updated product image to R2:", err);
			}
		}

		// Keep inStock, disabled, and disabledTxt in perfect sync
		if (updates.inStock !== undefined && updates.disabled === undefined) {
			normalizedUpdates.disabled = updates.inStock ? 0 : 1;
			if (updates.inStock && (!updates.disabledTxt || updates.disabledTxt === "قريباً")) {
				normalizedUpdates.disabledTxt = "متوفر";
			} else if (!updates.inStock && (!updates.disabledTxt || updates.disabledTxt === "متوفر")) {
				normalizedUpdates.disabledTxt = "قريباً";
			}
		} else if (updates.disabled !== undefined && updates.inStock === undefined) {
			normalizedUpdates.inStock = updates.disabled === 0;
			if (updates.disabled === 0 && (!updates.disabledTxt || updates.disabledTxt === "قريباً")) {
				normalizedUpdates.disabledTxt = "متوفر";
			} else if (updates.disabled === 1 && (!updates.disabledTxt || updates.disabledTxt === "متوفر")) {
				normalizedUpdates.disabledTxt = "قريباً";
			}
		}

		const updated = products.map((p) => (p.id === id ? { ...p, ...normalizedUpdates } : p));
		setProducts(updated);
		if (isClient) {
			try {
				localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
			} catch {}
		}
		showToast(t("toasts.productUpdated"), t("toasts.productUpdatedMsg"));
		syncCatalogToR2(updated);

		// Synchronize to backend /api/products and refresh from persisted server state
		try {
			const res = await fetch("/api/products", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					...getAdminRequestHeaders(),
				},
				body: JSON.stringify({
					intent: "update_product",
					id,
					updates: normalizedUpdates,
				}),
			});
			const json = (await res.json()) as any;
			if (json.success) {
				await refreshProductsFromServer();
			}
		} catch (e) {
			console.warn("Backend update product sync error:", e);
		}
	};

	const deleteProduct = async (id: string) => {
		const updated = products.filter((p) => p.id !== id);
		setProducts(updated);
		if (isClient) {
			try {
				localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
			} catch {}
		}
		showToast(t("toasts.productDeleted"), t("toasts.productDeletedMsg"), "info");
		syncCatalogToR2(updated);

		try {
			const res = await fetch("/api/products", {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					...getAdminRequestHeaders(),
				},
				body: JSON.stringify({
					intent: "delete_product",
					id,
				}),
			});
			const json = (await res.json()) as any;
			if (json.success) {
				await refreshProductsFromServer();
			}
		} catch (e) {
			console.warn("Backend delete product sync error:", e);
		}
	};

	const toggleProductStock = async (id: string) => {
		const target = products.find((p) => p.id === id);
		if (!target) return;

		const nextInStock = !target.inStock;
		const nextDisabled = nextInStock ? 0 : 1;
		const nextDisabledTxt = nextInStock ? "متوفر" : "قريباً";
		const nextStockQty = nextInStock ? (target.stockQuantity && target.stockQuantity > 0 ? target.stockQuantity : 25) : 0;

		const updated = products.map((p) =>
			p.id === id
				? {
						...p,
						inStock: nextInStock,
						disabled: nextDisabled,
						disabledTxt: nextDisabledTxt,
						stockQuantity: nextStockQty,
					  }
				: p
		);

		setProducts(updated);
		if (isClient) {
			try {
				localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
			} catch {}
		}
		showToast(
			nextInStock ? "تم تفعيل توفر المنتج" : "تم تعطيل المنتج (قريباً)",
			`${target.name}: ${nextInStock ? "متوفر للطلب الفوري الآن" : "غير متوفر حالياً"}`
		);
		syncCatalogToR2(updated);

		try {
			const res = await fetch("/api/products", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					...getAdminRequestHeaders(),
				},
				body: JSON.stringify({
					intent: "update_product",
					id,
					updates: {
						inStock: nextInStock,
						disabled: nextDisabled,
						disabledTxt: nextDisabledTxt,
						stockQuantity: nextStockQty,
					},
				}),
			});
			const json = (await res.json()) as any;
			if (json.success) {
				await refreshProductsFromServer();
			}
		} catch (e) {
			console.warn("Backend products toggle sync error:", e);
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
		const tempId = `ord-${Date.now().toString(36)}`;
		const orderNum = `AED-${Math.floor(1000 + Math.random() * 9000)}`;
		const optimisticOrder: Order = {
			...orderData,
			id: tempId,
			orderNumber: orderNum,
			status: "pending",
			createdAt: new Date().toISOString(),
		};

		// 1. Update UI immediately with optimistic record
		setOrders((prev) => [optimisticOrder, ...prev]);
		if (orderData.paymentMethod !== "ziina") {
			clearCart();
			setLastOrder(optimisticOrder);
		}

		// 2. Persist order to database (Cloudflare D1 SQL & R2 bucket)
		try {
			const res = await fetch("/api/orders", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					intent: "create_order",
					id: tempId,
					orderNumber: orderNum,
					...orderData,
				}),
			});
			const json = (await res.json()) as any;
			if (json.success && json.order) {
				const rawOrder = json.order.order ? json.order.order : json.order;
				const savedOrder: Order = {
					...optimisticOrder,
					...rawOrder,
					id: rawOrder.id || optimisticOrder.id,
					orderNumber: rawOrder.orderNumber || optimisticOrder.orderNumber,
				};
				setOrders((prev) => prev.map((o) => (o.id === tempId ? savedOrder : o)));
				if (orderData.paymentMethod !== "ziina") {
					setLastOrder(savedOrder);
				}
				showToast(
					t("toasts.orderSaved"),
					`${t("orderSuccess.orderNumber")}: ${savedOrder.orderNumber}`
				);

				trackMetaEvent("Purchase", {
					content_ids: savedOrder.items.map((i) => i.productId),
					content_type: "product",
					value: savedOrder.total,
					currency: "AED",
					num_items: savedOrder.items.reduce((s, i) => s + i.quantity, 0),
				});

				return savedOrder;
			}
		} catch (err) {
			console.error("Failed to save order to database:", err);
			showToast(
				t("toasts.orderSaved"),
				t("toasts.orderSavedMsg"),
				"warning"
			);
		}

		// Fallback tracking
		trackMetaEvent("Purchase", {
			content_ids: optimisticOrder.items.map((i) => i.productId),
			content_type: "product",
			value: optimisticOrder.total,
			currency: "AED",
			num_items: optimisticOrder.items.reduce((s, i) => s + i.quantity, 0),
		});

		showToast(t("toasts.orderReceived"), `${t("orderSuccess.orderNumber")}: ${orderNum}`);
		return optimisticOrder;
	};

	const updateOrderStatus = async (orderId: string, status: Order["status"]) => {
		setOrders((prev) =>
			prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
		);
		showToast(t("toasts.orderUpdated"), `${orderId}: ${status}`);

		try {
			await fetch("/api/orders", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					...getAdminRequestHeaders(),
				},
				body: JSON.stringify({ intent: "update_status", orderId, status }),
			});
		} catch (err) {
			console.warn("Failed to update order status on server:", err);
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
					localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
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
		setOrders((prev) => prev.filter((o) => o.id !== orderId));
		showToast(t("toasts.orderDeleted"), t("toasts.orderDeletedMsg"), "info");

		try {
			await fetch("/api/orders", {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					...getAdminRequestHeaders(),
				},
				body: JSON.stringify({ intent: "delete_order", orderId }),
			});
		} catch (err) {
			console.warn("Failed to delete order on server:", err);
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
		setMetaConfig((prev) => ({ ...prev, ...newConfig }));
		showToast(t("toasts.metaSettings"), t("toasts.metaSettingsMsg"));
	};

	// Settings & Reset
	const updateSettings = (newSettings: Partial<StoreSettings>) => {
		setSettings((prev) => {
			const safeNewSettings = { ...newSettings } as Partial<StoreSettings>;
			delete (safeNewSettings as any).ziinaApiKey;
			const updated = { ...prev, ...safeNewSettings, ziinaApiKey: "" };
			if (typeof window !== "undefined") {
				try {
					const persisted = { ...updated } as any;
					delete persisted.ziinaApiKey;
					localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(persisted));
					localStorage.removeItem("teen_liwa_ziina_token");
					localStorage.removeItem("teen_liwa_ziina_test_mode");
				} catch (e) {}
			}
			// Persist catalog settings through the configured server-side storage binding.
			syncCatalogToR2(products, updated);
			return updated;
		});
		showToast(t("toasts.settingsSaved"), t("toasts.settingsSavedMsg"));
	};

	const resetToSampleData = () => {
		setProducts(INITIAL_PRODUCTS);
		setOrders(INITIAL_ORDERS);
		setSettings(INITIAL_SETTINGS);
		setMetaCampaigns(INITIAL_META_CAMPAIGNS);
		setMarketingLeads(INITIAL_LEADS);
		setMetaConfig(INITIAL_META_CONFIG);
		setCart([]);
		if (isClient) {
			localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
			localStorage.removeItem(STORAGE_KEYS.ORDERS);
			localStorage.removeItem(STORAGE_KEYS.SETTINGS);
			localStorage.removeItem(STORAGE_KEYS.CART);
			localStorage.removeItem(STORAGE_KEYS.META_CAMPAIGNS);
			localStorage.removeItem(STORAGE_KEYS.LEADS);
			localStorage.removeItem(STORAGE_KEYS.META_CONFIG);
		}
		showToast(t("toasts.dataReset"), t("toasts.dataResetMsg"));
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
