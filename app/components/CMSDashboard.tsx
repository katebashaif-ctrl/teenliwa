import React, { useState, useEffect } from "react";
import { useStore } from "../context/StoreContext";
import type { Product, Order } from "../types/store";
import { ProductFormModal } from "./ProductFormModal";
import {
	BarChart3,
	Package,
	ShoppingCart,
	Boxes,
	Settings,
	Plus,
	Edit3,
	Trash2,
	Eye,
	Check,
	X,
	ArrowUpRight,
	Search,
	Sparkles,
	Cloud,
	UploadCloud,
	RefreshCw,
	Database,
	CheckCircle2,
	Copy,
	LogOut,
	Share2,
	Download,
	ExternalLink,
	Megaphone,
	Users,
	Bot,
	Navigation,
	Server,
	Image as ImageIcon,
	Upload,
	CreditCard,
	Clock,
} from "lucide-react";
import { CmsRouteInstructionsBanner } from "./cms/CmsRouteInstructionsBanner";
import { StoreAiCopilot } from "./cms/StoreAiCopilot";
import { UnifiedMarketingMcpHub } from "./cms/UnifiedMarketingMcpHub";
import { ZiinaGatewaySettings } from "./cms/ZiinaGatewaySettings";



interface R2Status {
	connected: boolean;
	s3Configured?: boolean;
	bucket: string;
	accountId: string;
	endpoint: string;
	publicUrl?: string;
	remoteObjectsCount: number;
	remoteImages: string[];
	localImages?: string[];
	listError?: string | null;
}

export const CMSDashboard: React.FC = () => {
	const {
		products,
		addProduct,
		updateProduct,
		deleteProduct,
		toggleProductStock,
		orders,
		updateOrderStatus,
		deleteOrder,
		fetchOrdersFromDatabase,
		isOrdersLoading,
		ordersStorageType,
		settings,
		updateSettings,
		
		cmsTab,
		setCmsTab,
		setCurrentView,
		showToast,
		adminLogout,
		metaCampaigns,
		marketingLeads,
	} = useStore();

	// Modal states
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [editingProduct, setEditingProduct] = useState<Product | null>(null);
	const [newProductImageSelection, setNewProductImageSelection] = useState("");
	const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
	const [productFilterCat, setProductFilterCat] = useState<string>("all");
	const [productSearch, setProductSearch] = useState("");

	// Cloudflare R2 State & Credentials Form
	const [r2Status, setR2Status] = useState<R2Status>({
		connected: false,
		s3Configured: false,
		bucket: "bt-liwa",
		accountId: "",
		endpoint: "",
		publicUrl: "",
		remoteObjectsCount: 0,
		remoteImages: [],
	});

	const [isUploadingR2, setIsUploadingR2] = useState(false);

	// Settings Form State
	const [settingsForm, setSettingsForm] = useState(settings);

	// Load R2 data on mount
	const loadR2Status = () => {
		fetch("/api/r2", { credentials: "same-origin" })
			.then((response) => response.json() as Promise<R2Status>)
			.then((data) => setR2Status(data))
			.catch((error) => console.warn("R2 image storage status unavailable:", error));
	};
	useEffect(() => {
		loadR2Status();
	}, []);

	useEffect(() => {
		setSettingsForm(settings);
	}, [settings]);

	// Analytics calculations
	const totalRevenue = orders.reduce((sum, order) =>
		sum + (order.paymentStatus === "paid" || (order.paymentMethod === "cod" && order.status === "delivered") ? order.total : 0), 0);
	const pendingOrdersCount = orders.filter((o) => o.status === "pending" || o.status === "processing").length;
	const lowStockProducts = products.filter((p) => p.trackInventory === true && (p.stockQuantity ?? 0) < 15);

	// Curated & Real Teen Liwa Product Images list for picker
	const imageOptions = [
		{ label: "تين أحمر طازج (مزارع ليوا)", url: "/images/redfig.jpg" },
		{ label: "تين أصفر طازج (مزارع ليوا)", url: "/images/yellowfig.jpg" },
		{ label: "تمر جلاكسي سكري", url: "/images/tmr_sokry.webp" },
		{ label: "فقع علبة 400 جرام", url: "/images/fq3.jpg" },
		{ label: "تمر صقعي (3 كيلو)", url: "/images/tmr_saq3y.webp" },
		{ label: "تمر خلاص (3 كيلو)", url: "/images/tmr_ikhlas.webp" },
		{ label: "تمر شيشي (3 كيلو)", url: "/images/tmr_shishi.webp" },
		{ label: "تمر صفوي (3 كيلو)", url: "/images/tmr_safaye.webp" },
		{ label: "لوز محلي", url: "/images/lowzlocal.jpg" },
		{ label: "لوز الجامبو", url: "/images/lowz.jpg" },
		{ label: "توت طويل فاخر", url: "/images/tot.webp" },
		{ label: "صبار طازج كيلو", url: "/images/sabars.webp" },
		{ label: "كنار كيلو ونص", url: "/images/kanar.webp" },
	];


	// Handle Direct R2 Image Upload (Media Library)
	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsUploadingR2(true);
		const reader = new FileReader();
		reader.onload = async () => {
			const base64 = reader.result as string;
			try {
				const res = await fetch("/api/r2", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						intent: "upload_base64",
						imageBase64: base64,
						imageName: file.name.split(".")[0],
					}),
				});
				const data = (await res.json()) as any;
				if (data.success && data.url) {
					showToast("تم رفع الصورة إلى R2", `تم تخزين صورة "${file.name}" مباشرة في سحابة Cloudflare R2.`);
					setR2Status((prev) => ({
						...prev,
						remoteImages: [data.url, ...(prev.remoteImages || [])],
						remoteObjectsCount: prev.remoteObjectsCount + 1,
					}));
				} else {
					showToast("تنبيه R2", data.error || "تعذر الرفع إلى Cloudflare R2 مباشرة.", "warning");
				}
			} catch (err) {
				showToast("خطأ بالرفع", "تعذر الاتصال بخادم R2.", "warning");
			} finally {
				setIsUploadingR2(false);
			}
		};
		reader.readAsDataURL(file);
	};

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			const temporaryInput = document.createElement("textarea");
			temporaryInput.value = text;
			temporaryInput.setAttribute("readonly", "");
			temporaryInput.style.position = "fixed";
			temporaryInput.style.opacity = "0";
			document.body.appendChild(temporaryInput);
			temporaryInput.select();
			document.execCommand("copy");
			temporaryInput.remove();
		}
	};

	const filteredProducts = products.filter((p) => {
		const matchesCat = productFilterCat === "all" || p.category === productFilterCat;
		const matchesSearch =
			!productSearch ||
			p.name.includes(productSearch) ||
			(p.origin || "").includes(productSearch);
		return matchesCat && matchesSearch;
	});

	return (
		<div className="cms-dashboard-shell bg-[#FAF7F2] min-h-screen pb-8 sm:pb-16 text-right overflow-x-hidden">
			{/* CMS Header Bar */}
			<div className="cms-dashboard-topbar bg-[#2C2014] text-white border-b border-[#574127] sticky top-0 z-30 shadow-sm">
				<div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2 sm:gap-3">
						<span className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-sm">
							CMS
						</span>
						<div className="min-w-0">
							<h1 className="font-serif text-base sm:text-lg font-bold text-amber-100 truncate">
								لوحة تحكم تين ليوا
							</h1>
							<p className="hidden sm:block text-[11px] text-stone-400 truncate">
								إدارة المحاصيل والطلبات والمخزون وسحابة Cloudflare R2
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={() => setCurrentView("store")}
							className="px-3 py-1.5 bg-[#574127] text-amber-200 text-xs font-semibold rounded-lg hover:bg-[#6d5231] transition-colors flex items-center gap-1.5"
						>
							<span>عرض المتجر</span>
							<ArrowUpRight className="w-3.5 h-3.5 text-amber-300" />
						</button>
						<button
							onClick={adminLogout}
							className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-semibold rounded-lg border border-rose-800 transition-colors flex items-center gap-1.5"
							title="تسجيل الخروج من لوحة التحكم"
						>
							<LogOut className="w-3.5 h-3.5 text-rose-400" />
							<span className="hidden sm:inline">خروج المشرف</span>
						</button>
					</div>
				</div>

				{/* CMS Navigation Tabs */}
				<div className="cms-dashboard-tabs max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none border-t border-[#574127]/60">
					<button
						onClick={() => setCmsTab("overview")}
						className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
							cmsTab === "overview"
								? "border-amber-400 text-amber-300 bg-white/5"
								: "border-transparent text-stone-300 hover:text-white"
						}`}
					>
						<BarChart3 className="w-4 h-4" />
						<span>نظرة عامة وإحصائيات</span>
					</button>

					<button
						onClick={() => setCmsTab("products")}
						className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
							cmsTab === "products"
								? "border-amber-400 text-amber-300 bg-white/5"
								: "border-transparent text-stone-300 hover:text-white"
						}`}
					>
						<Package className="w-4 h-4" />
						<span>إدارة المنتجات ({products.length})</span>
					</button>

					<button
						onClick={() => setCmsTab("orders")}
						className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
							cmsTab === "orders"
								? "border-amber-400 text-amber-300 bg-white/5"
								: "border-transparent text-stone-300 hover:text-white"
						}`}
					>
						<ShoppingCart className="w-4 h-4" />
						<span>إدارة الطلبات ({orders.length})</span>
						{pendingOrdersCount > 0 && (
							<span className="w-2 h-2 rounded-full bg-amber-400"></span>
						)}
					</button>

					{/* AI MCP Agent Tab */}
					<button
						onClick={() => setCmsTab("ai_agent")}
						className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
							cmsTab === "ai_agent"
								? "border-amber-400 text-amber-300 bg-white/5"
								: "border-transparent text-stone-300 hover:text-white"
						}`}
					>
						<Bot className="w-4 h-4 text-amber-400" />
						<span>المساعد الذكي (AI Copilot)</span>
						<span className="text-[10px] bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
							<Sparkles className="w-3 h-3 text-stone-950 inline" />
							MCP Agent
						</span>
					</button>

					{/* Unified Marketing & Meta MCP Tab */}
					<button
						onClick={() => setCmsTab("marketing")}
						className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
							cmsTab === "marketing" || cmsTab === "mcp" || cmsTab === "campaigns" || cmsTab === "meta"
								? "border-amber-400 text-amber-300 bg-white/5"
								: "border-transparent text-stone-300 hover:text-white"
						}`}
					>
						<Megaphone className="w-4 h-4 text-amber-400" />
						<span>التسويق و Meta MCP</span>
						<span className="text-[10px] bg-amber-500 text-stone-950 px-2 py-0.5 rounded-full font-bold">
							خادم teenliwa
						</span>
					</button>

					{/* R2 Cloud Tab */}
					<button
						onClick={() => setCmsTab("r2")}
						className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
							cmsTab === "r2"
								? "border-amber-400 text-amber-300 bg-white/5"
								: "border-transparent text-stone-300 hover:text-white"
						}`}
					>
						<Cloud className="w-4 h-4 text-amber-400" />
						<span>سحابة Cloudflare R2</span>
						<span className="w-2 h-2 rounded-full bg-emerald-400"></span>
					</button>

					{/* Ziina Payment Gateway Tab */}
					<button
						onClick={() => setCmsTab("ziina")}
						className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
							cmsTab === "ziina"
								? "border-amber-400 text-amber-300 bg-white/5"
								: "border-transparent text-stone-300 hover:text-white"
						}`}
					>
						<CreditCard className="w-4 h-4 text-amber-300" />
						<span>بوابة دفع Ziina</span>
						<span className="text-[10px] bg-emerald-500 text-stone-950 px-2 py-0.5 rounded-full font-bold">
							Apple Pay
						</span>
					</button>

					<button
						onClick={() => setCmsTab("settings")}
						className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
							cmsTab === "settings"
								? "border-amber-400 text-amber-300 bg-white/5"
								: "border-transparent text-stone-300 hover:text-white"
						}`}
					>
						<Settings className="w-4 h-4" />
						<span>إعدادات المتجر</span>
					</button>
				</div>
			</div>

			{/* Main Content Area */}
			<div className="cms-dashboard-main max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
				{/* Route & Direct URL Instructions Banner */}
				<CmsRouteInstructionsBanner />

				{/* TAB 1: OVERVIEW */}
				{cmsTab === "overview" && (
					<div className="space-y-8">
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<div className="bg-white p-5 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-1">
								<p className="text-xs font-medium text-stone-500">إجمالي المبيعات</p>
								<div className="flex items-baseline gap-1.5">
									<span className="font-serif text-3xl font-bold text-[#2C2014] tabular-nums">
										{totalRevenue}
									</span>
									<span className="text-xs font-bold text-[#8B5A2B]">د.إ AED</span>
								</div>
								<p className="text-[11px] text-emerald-700 font-medium pt-1">
									إجمالي المدفوعات المؤكدة فقط
								</p>
							</div>

							<div className="bg-white p-5 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-1">
								<p className="text-xs font-medium text-stone-500">إجمالي الطلبات</p>
								<div className="flex items-baseline gap-1.5">
									<span className="font-serif text-3xl font-bold text-[#2C2014] tabular-nums">
										{orders.length}
									</span>
									<span className="text-xs font-bold text-stone-400">طلب</span>
								</div>
								<p className="text-[11px] text-amber-800 font-medium pt-1">
									{pendingOrdersCount} طلبات قيد التجهيز الآن
								</p>
							</div>

							<div className="bg-white p-5 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-1">
								<p className="text-xs font-medium text-stone-500">المنتجات النشطة</p>
								<div className="flex items-baseline gap-1.5">
									<span className="font-serif text-3xl font-bold text-[#2C2014] tabular-nums">
										{products.filter((p) => p.inStock).length}
									</span>
									<span className="text-xs font-bold text-stone-400">من أصل {products.length}</span>
								</div>
								<p className="text-[11px] text-stone-500 pt-1">
									تين مزارع، رطب خلاص ليوا، فقع زبيدي
								</p>
							</div>

							<div className="bg-white p-5 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-1">
								<p className="text-xs font-medium text-stone-500">سحابة R2 المتصلة</p>
								<div className="flex items-baseline gap-1.5">
									<span className="font-serif text-2xl font-bold text-emerald-800">
										{r2Status.bucket}
									</span>
								</div>
								<p className="text-[11px] text-emerald-700 font-medium pt-1 flex items-center gap-1">
									<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
									<span>متصل بنجاح ({r2Status.remoteObjectsCount} ملف)</span>
								</p>
							</div>
						</div>

						{/* Quick Action Strip */}
						<div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 bg-[#F5EFE6] border border-[#E8DCCB] rounded-xl">
							<div className="flex items-center gap-2">
								<Sparkles className="w-4 h-4 text-amber-700" />
								<span className="text-xs font-bold text-[#574127]">
									إجراءات سريعة لمدير المتجر:
								</span>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<button
									onClick={() => setCmsTab("ai_agent")}
									className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white text-xs font-bold rounded-lg hover:from-amber-700 hover:to-amber-800 transition-colors flex items-center gap-1.5 shadow-sm"
								>
									<Bot className="w-3.5 h-3.5 text-amber-200" />
									<span>المساعد الذكي (AI Copilot)</span>
								</button>
								<button
									onClick={() => setCmsTab("mcp")}
									className="px-3 py-1.5 bg-[#1877F2] text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
								>
									<Server className="w-3.5 h-3.5 text-white" />
									<span>خادم Meta Ads MCP Server (# Get started)</span>
								</button>
								<button
									onClick={() => setIsAddModalOpen(true)}
									className="px-3 py-1.5 bg-[#2C2014] text-amber-200 text-xs font-bold rounded-lg hover:bg-black transition-colors flex items-center gap-1.5"
								>
									<Plus className="w-3.5 h-3.5" />
									<span>إضافة محصول جديد</span>
								</button>
								<span className="text-[11px] text-stone-500">الكتالوج محفوظ مباشرة في D1 v2</span>
							</div>
						</div>

						{/* Recent Orders Table */}
						<div className="bg-white rounded-2xl border border-[#E8DCCB] p-6 shadow-sm space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="font-serif text-lg font-bold text-[#2C2014]">
									أحدث طلبات الزبائن الواردة
								</h3>
								<button
									onClick={() => setCmsTab("orders")}
									className="text-xs font-semibold text-amber-800 hover:underline"
								>
									عرض كافة الطلبات ({orders.length}) ←
								</button>
							</div>

							<div className="overflow-x-auto">
								<table className="w-full text-right text-xs">
									<thead>
										<tr className="border-b border-stone-200 text-stone-500">
											<th className="py-2.5 px-3 font-semibold">رقم الطلب</th>
											<th className="py-2.5 px-3 font-semibold">العميل</th>
											<th className="py-2.5 px-3 font-semibold">الإمارة</th>
											<th className="py-2.5 px-3 font-semibold">المحاصيل المطلوبة</th>
											<th className="py-2.5 px-3 font-semibold">المبلغ</th>
											<th className="py-2.5 px-3 font-semibold">الحالة</th>
											<th className="py-2.5 px-3 font-semibold">إجراء</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-stone-100">
										{orders.slice(0, 5).map((o) => (
											<tr key={o.id} className="hover:bg-stone-50/60">
												<td className="py-3 px-3 font-bold tabular-nums text-stone-900">
													{o.orderNumber}
												</td>
												<td className="py-3 px-3 font-medium text-stone-800">
													{o.customerName}
												</td>
												<td className="py-3 px-3 text-stone-600">{o.customerEmirate}</td>
												<td className="py-3 px-3 text-stone-600 max-w-xs truncate">
													{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}
												</td>
												<td className="py-3 px-3 font-bold tabular-nums text-[#8B5A2B]">
													{o.total} د.إ
												</td>
												<td className="py-3 px-3">
													<span
														className={`px-2 py-0.5 rounded text-[10px] font-bold ${
															o.status === "delivered"
																? "bg-emerald-100 text-emerald-800"
																: o.status === "shipped"
																	? "bg-blue-100 text-blue-800"
																	: o.status === "processing"
																		? "bg-amber-100 text-amber-800"
																		: "bg-stone-100 text-stone-700"
														}`}
													>
														{o.status === "delivered"
															? "تم التوصيل"
															: o.status === "shipped"
																? "جاري الشحن"
																: o.status === "processing"
																	? "قيد التجهيز"
																	: "قيد المراجعة"}
													</span>
												</td>
												<td className="py-3 px-3">
													<button
														onClick={() => setViewingOrder(o)}
														className="text-amber-800 hover:text-black font-semibold text-xs"
													>
														تفاصيل الفاتورة
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* TAB 2: PRODUCTS MANAGEMENT */}
				{cmsTab === "products" && (
					<div className="space-y-6">
						<div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-950">
							<strong>حالة قاعدة البيانات والمخزون</strong>
							<p className="mt-1">المنتجات والأسعار والمخزون تُدار في D1 v2. تُرفع الصور إلى Cloudflare R2 عبر ربط BUCKET، ولا توجد مزامنة كتالوج منفصلة.</p>
						</div>

						<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E8DCCB]">
							<div className="flex items-center gap-2 flex-1 max-w-md">
								<Search className="w-4 h-4 text-stone-400" />
								<input
									type="text"
									value={productSearch}
									onChange={(e) => setProductSearch(e.target.value)}
									placeholder="ابحث بالاسم أو المزرعة..."
									className="w-full text-xs py-1.5 px-2 focus:outline-none"
								/>
							</div>

							<div className="flex items-center gap-2">
								<select
									value={productFilterCat}
									onChange={(e) => setProductFilterCat(e.target.value)}
									className="text-xs py-1.5 px-3 border border-stone-300 rounded-lg bg-white"
								>
									<option value="all">كافة الأصناف ({products.length})</option>
									<option value="rutab">رطب الإمارات</option>
									<option value="fig">تين المزارع</option>
									<option value="faqa">فقع الصحراء</option>
									<option value="boxes">صناديق الإهداء</option>
								</select>

								<button
									onClick={() => setIsAddModalOpen(true)}
									className="px-4 py-2 bg-[#2C2014] text-amber-200 text-xs font-bold rounded-lg hover:bg-black transition-colors flex items-center gap-1.5 shrink-0"
								>
									<Plus className="w-3.5 h-3.5" />
									<span>إضافة منتج جديد</span>
								</button>
							</div>
						</div>

						{/* Products Table */}
						<div className="bg-white rounded-2xl border border-[#E8DCCB] overflow-hidden shadow-sm">
							<div className="overflow-x-auto">
								<table className="w-full text-right text-xs">
									<thead className="bg-[#FAF7F2] border-b border-stone-200 text-stone-600">
										<tr>
											<th className="py-3 px-4 font-semibold">الصورة والاسم</th>
											<th className="py-3 px-4 font-semibold">القسم</th>
											<th className="py-3 px-4 font-semibold">المصدر / المزرعة</th>
											<th className="py-3 px-4 font-semibold">السعر (د.إ)</th>
											<th className="py-3 px-4 font-semibold">المخزون المتوفر</th>
											<th className="py-3 px-4 font-semibold">الحالة</th>
											<th className="py-3 px-4 font-semibold text-center">إجراءات</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-stone-100">
										{filteredProducts.map((p) => (
											<tr key={p.id} className="hover:bg-stone-50/50">
												<td className="py-3 px-4">
													<div className="flex items-center gap-3">
														<img
															src={p.image}
															alt={p.name}
															referrerPolicy="no-referrer"
															className="w-12 h-12 rounded-lg object-cover bg-stone-100 border border-stone-200 shrink-0"
														/>
														<div>
															<p className="font-bold text-stone-900">{p.name}</p>
															<p className="text-[11px] text-stone-400">{p.unit}</p>
														</div>
													</div>
												</td>
												<td className="py-3 px-4">
													<span className="px-2 py-0.5 rounded bg-[#F5EFE6] text-[#574127] text-[11px] font-medium">
														{p.category === "rutab"
															? "رطب"
															: p.category === "fig"
																? "تين"
																: p.category === "faqa"
																	? "فقع"
																	: "بوكس إهداء"}
													</span>
												</td>
												<td className="py-3 px-4 text-stone-600 truncate max-w-[160px]">
													{p.origin}
												</td>
												<td className="py-3 px-4 font-bold tabular-nums text-[#8B5A2B]">
													{p.price} د.إ
												</td>
												<td className="py-3 px-4">
													<div className="flex items-center gap-1.5">
														<span
															className={`font-bold tabular-nums ${
																p.trackInventory && (p.stockQuantity ?? 0) < 15 ? "text-rose-600" : "text-stone-800"
															}`}
														>
															{p.trackInventory ? (p.stockQuantity ?? 0) : "غير متتبع"}
														</span>
														<div className="flex items-center gap-0.5 mr-2">
															<button
																onClick={() =>
																	updateProduct(p.id, {
																		stockQuantity: Math.max(0, (p.stockQuantity ?? 0) - 1),
																		inStock: (p.stockQuantity ?? 0) - 1 > 0,
																	})
																}
																className="w-5 h-5 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center font-bold text-stone-700"
															>
																-
															</button>
															<button
																onClick={() =>
																	updateProduct(p.id, {
																		stockQuantity: (p.stockQuantity ?? 0) + 5,
													trackInventory: true,
																		inStock: true,
															})
																}
																className="w-5 h-5 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center font-bold text-stone-700"
															>
																+
															</button>
														</div>
													</div>
												</td>
												<td className="py-3 px-4">
													<button
														onClick={() => toggleProductStock(p.id)}
														className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
															p.inStock
																? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
																: "bg-rose-100 text-rose-800 hover:bg-rose-200"
														}`}
													>
														{p.inStock ? "متوفر" : "غير متوفر"}
													</button>
												</td>
												<td className="py-3 px-4 text-center">
													<div className="flex items-center justify-center gap-2">
														<button
															onClick={() => setEditingProduct(p)}
															className="p-1.5 text-stone-600 hover:text-amber-800 hover:bg-stone-100 rounded-lg transition-colors"
															title="تعديل المنتج"
														>
															<Edit3 className="w-4 h-4" />
														</button>
														<button
															onClick={() => {
																deleteProduct(p.id);
																showToast("تم حذف المنتج", `تم حذف ${p.name} بنجاح من المتجر`, "info");
															}}
															className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
															title="حذف المنتج"
														>
															<Trash2 className="w-4 h-4" />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* TAB 3: ORDERS MANAGEMENT */}
				{cmsTab === "orders" && (
					<div className="space-y-6">
						<div className="bg-white p-4 rounded-xl border border-[#E8DCCB] flex flex-wrap justify-between items-center gap-3">
							<div>
								<div className="flex items-center gap-2">
									<h3 className="font-serif text-lg font-bold text-[#2C2014]">
										سجل طلبات العملاء ({orders.length})
									</h3>
									<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800">
										<Database className="w-3 h-3 text-emerald-600" />
										<span>متصل بقاعدة البيانات ({ordersStorageType === "d1_database" ? "Cloudflare D1 SQL" : "Cloudflare R2 Database"})</span>
									</span>
								</div>
								<p className="text-xs text-stone-500 mt-0.5">
									يتم تسجيل وتوثيق كافة طلبات العملاء مباشرة في قاعدة البيانات المركزية ومزامنتها سحابياً
								</p>
							</div>

							<div className="flex items-center gap-3">
								<button
									onClick={() => fetchOrdersFromDatabase()}
									disabled={isOrdersLoading}
									className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#F5EFE6] border border-[#D6BE9F] text-[#574127] rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
									title="تحديث ومزامنة الطلبات من قاعدة البيانات"
								>
									<RefreshCw className={`w-3.5 h-3.5 ${isOrdersLoading ? "animate-spin text-amber-700" : ""}`} />
									<span>{isOrdersLoading ? "جاري جلب الطلبات..." : "مزامنة من قاعدة البيانات"}</span>
								</button>

								<div className="flex items-center gap-2 text-xs bg-[#FAF7F2] px-3 py-1.5 rounded-lg border border-[#E8DCCB]">
									<span className="font-semibold text-stone-600">المبيعات الكلية:</span>
									<span className="font-serif font-bold text-amber-900 tabular-nums">
										{totalRevenue} د.إ
									</span>
								</div>
							</div>
						</div>

						{/* Orders Table */}
						<div className="bg-white rounded-2xl border border-[#E8DCCB] overflow-hidden shadow-sm">
							<div className="overflow-x-auto">
								<table className="w-full text-right text-xs">
									<thead className="bg-[#FAF7F2] border-b border-stone-200 text-stone-600">
										<tr>
											<th className="py-3 px-4 font-semibold">رقم الطلب</th>
											<th className="py-3 px-4 font-semibold">العميل والهاتف</th>
											<th className="py-3 px-4 font-semibold">الإمارة والعنوان</th>
											<th className="py-3 px-4 font-semibold">المنتجات</th>
											<th className="py-3 px-4 font-semibold">المبلغ</th>
											<th className="py-3 px-4 font-semibold">طريقة الدفع</th>
											<th className="py-3 px-4 font-semibold">الحالة الحالية</th>
											<th className="py-3 px-4 font-semibold text-center">إجراءات</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-stone-100">
										{orders.map((o) => (
											<tr key={o.id} className="hover:bg-stone-50/50">
												<td className="py-3 px-4 font-bold tabular-nums text-stone-900">
													{o.orderNumber}
												</td>
												<td className="py-3 px-4">
													<p className="font-bold text-stone-900">{o.customerName}</p>
													<p className="text-[11px] text-stone-500" dir="ltr">
														{o.customerPhone}
													</p>
												</td>
												<td className="py-3 px-4">
													<p className="font-semibold text-stone-800">{o.customerEmirate}</p>
													<p className="text-[11px] text-stone-500 max-w-[180px] truncate">
														{o.customerAddress}
													</p>
												</td>
												<td className="py-3 px-4 max-w-xs truncate text-stone-600">
													{o.items.map((i) => `${i.quantity} × ${i.name}`).join("، ")}
												</td>
												<td className="py-3 px-4 font-bold tabular-nums text-[#8B5A2B]">
													{o.total} د.إ
												</td>
												<td className="py-3 px-4">
													{o.paymentMethod === "ziina" ? (
														<div className="space-y-1">
															<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px]">
																<CreditCard className="w-3 h-3 text-amber-800" />
																<span>Ziina (Apple Pay)</span>
															</span>
															<div>
																<span
																	className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
																		o.paymentStatus === "paid"
																			? "bg-emerald-100 text-emerald-800"
																			: "bg-amber-50 text-amber-800 border border-amber-200"
																	}`}
																>
																	{o.paymentStatus === "paid" ? "مسدد ✓" : "قيد السداد"}
																</span>
															</div>
														</div>
													) : o.paymentMethod === "cod" ? (
														<span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 text-[11px]">
															عند الاستلام
														</span>
													) : o.paymentMethod === "card_on_delivery" ? (
														<span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 text-[11px]">
															بطاقة للتوصيل
														</span>
													) : (
														<span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px]">
															واتساب
														</span>
													)}
												</td>
												<td className="py-3 px-4">
													<select
														value={o.status}
														onChange={(e) =>
															updateOrderStatus(o.id, e.target.value as Order["status"])
														}
														className="text-xs p-1.5 border border-stone-200 rounded-lg bg-white font-medium"
													>
														<option value="pending">قيد المراجعة</option>
														<option value="processing">جاري التجهيز</option>
														<option value="shipped">تم الشحن</option>
														<option value="delivered">تم التوصيل</option>
														<option value="cancelled">ملغي</option>
													</select>
												</td>
												<td className="py-3 px-4 text-center">
													<div className="flex items-center justify-center gap-1.5">
														<button
															onClick={() => setViewingOrder(o)}
															className="p-1.5 text-stone-600 hover:text-amber-800 hover:bg-stone-100 rounded-lg transition-colors"
															title="عرض الفاتورة"
														>
															<Eye className="w-4 h-4" />
														</button>
														<button
															onClick={() => {
																deleteOrder(o.id);
																showToast("تم حذف الطلب", `تم حذف الطلب ${o.orderNumber} بنجاح`, "info");
															}}
															className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
															title="حذف الطلب"
														>
															<Trash2 className="w-4 h-4" />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}



				{/* TAB 5: CLOUDFLARE R2 INTEGRATION */}
				{cmsTab === "r2" && (
					<div className="space-y-6">
						{/* Credentials & Live Status Card */}
						<div className="bg-white p-6 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-4">
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
										<Cloud className="w-5 h-5 text-amber-600" />
									</div>
									<div>
										<h3 className="font-serif text-lg font-bold text-[#2C2014]">
											حالة الاتصال بسحابة Cloudflare R2
										</h3>
										<p className="text-xs text-stone-500">
											تخزين سحابي متوافق مع S3 لموقع تين ليوا وخيرات الدار بدون أي تخزين محلي
										</p>
									</div>
								</div>

								<div className="flex items-center gap-2">
									<span
										className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
											r2Status.connected
												? "bg-emerald-100 text-emerald-800"
												: "bg-amber-100 text-amber-800"
										}`}
									>
										{r2Status.connected ? (
											<>
												<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
												<span>متصل — تخزين الصور</span>
											</>
										) : (
											<>
												<Cloud className="w-3.5 h-3.5 text-amber-600" />
												<span>تحقق من ربط BUCKET في Worker</span>
											</>
										)}
									</span>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
								<div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8DCCB] space-y-1">
									<p className="text-stone-500 font-medium">R2 Bucket binding:</p>
									<p className="font-mono font-bold text-amber-900" dir="ltr">BUCKET → {r2Status.bucket}</p>
								</div>
								<div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8DCCB] space-y-1">
									<p className="text-stone-500 font-medium">ملفات الصور المخزنة:</p>
									<p className="font-bold text-emerald-800 text-base tabular-nums">{r2Status.remoteObjectsCount} ملف</p>
								</div>
								<div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8DCCB] space-y-1">
									<p className="text-stone-500 font-medium">مصدر بيانات المتجر:</p>
									<p className="font-bold text-stone-800 text-[11px]">Cloudflare D1 v2</p>
								</div>
							</div>

							<div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-950 leading-6">
								<strong>مصادر البيانات</strong>
								<p>المنتجات والتصنيفات والطلبات والمدفوعات وإعدادات المتجر محفوظة في D1 v2. تخزن R2 ملفات الصور فقط ولا تُستخدم لمزامنة كتالوج أو بيانات عملاء.</p>
							</div>

							<div className="pt-2 flex flex-wrap items-center gap-3">
								<label className="px-5 py-2.5 bg-emerald-800 text-white text-xs font-bold rounded-lg hover:bg-emerald-900 transition-colors flex items-center gap-2 cursor-pointer shadow">
									<UploadCloud className="w-4 h-4 text-emerald-200" />
									<span>{isUploadingR2 ? "جاري الرفع..." : "رفع صورة جديدة إلى مكتبة الوسائط"}</span>
									<input type="file" accept="image/*" onChange={handleFileUpload} disabled={isUploadingR2} className="hidden" />
								</label>
							</div>
						</div>

						<div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-950 leading-6">
							<strong>إعداد تخزين الصور الآمن</strong>
							<p>تستخدم لوحة CMS ربط Cloudflare R2 باسم BUCKET مباشرة من Worker. لا تحفظ مفاتيح S3 أو أسرار الوصول في D1 أو localStorage أو المتصفح.</p>
							<p dir="ltr" className="font-mono">wrangler.json → r2_buckets → binding: BUCKET</p>
						</div>


						{/* Cloudflare R2 Media Gallery */}
						<div className="bg-white p-6 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<h4 className="font-serif text-lg font-bold text-[#2C2014]">
										معرض وسائط ومحاصيل سحابة R2
									</h4>
									<p className="text-xs text-stone-500">
										صور المنتجات المخزنة في R2 عبر Worker binding فقط
									</p>
								</div>
								<span className="text-xs font-bold text-[#8B5A2B] bg-[#F5EFE6] px-3 py-1 rounded-full">
									{r2Status.remoteImages.length} صور سحابية
								</span>
							</div>

							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
								{(r2Status.remoteImages || []).map((imgUrl, idx) => (
									<div
										key={idx}
										className="group relative rounded-xl overflow-hidden border border-[#E8DCCB] bg-[#FAF7F2] aspect-square flex flex-col"
									>
										<img
											src={imgUrl}
											alt={`R2 Asset ${idx}`}
											referrerPolicy="no-referrer"
											className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
										/>
										<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between items-center text-center">
											<span className="text-[10px] text-stone-200 truncate w-full" dir="ltr">
												{imgUrl.split("/").pop()}
											</span>
											<button
												onClick={() => {
													setNewProductImageSelection(imgUrl);
													setIsAddModalOpen(true);
													showToast("تم اختيار صورة R2", "تم تعيين الصورة للمنتج الجديد.");
												}}
												className="px-2.5 py-1 bg-amber-500 text-stone-900 rounded font-bold text-[10px] hover:bg-amber-400"
											>
												استخدام للمنتج
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				)}

				{/* Legacy Meta Tab Disabled - Handled in UnifiedMarketingMcpHub */}
				{false && (
					<div className="space-y-6">
						{/* Overview Card */}
						<div className="bg-white p-6 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-4">
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
										<Share2 className="w-5 h-5 text-blue-600" />
									</div>
									<div>
										<h3 className="font-serif text-lg font-bold text-[#2C2014]">
											تكامل كتالوج Meta & Facebook Ads
										</h3>
										<p className="text-xs text-stone-500">
											مزامنة محاصيل الرطب والتين والفقع مع Facebook & Instagram Shop
										</p>
									</div>
								</div>

								<div className="flex items-center gap-2">
									<span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold flex items-center gap-1.5">
										<CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
										<span>متوافق مع Meta Commerce Manager</span>
									</span>
								</div>
							</div>

							<p className="text-xs text-stone-600 leading-relaxed">
								يتيح لك هذا القسم ربط منتجات متجر «خيرات الدار» مباشرة مع مدير المعاملات التجارية (Meta Commerce Manager) لتشغيل إعلانات الكتالوج الديناميكية (Advantage+ Catalog Ads)، ومتجر انستغرام (Instagram Shopping)، وإعلانات إعادة الاستهداف على فيسبوك بالعملة الإماراتية (AED).
							</p>

							{/* Feed URLs & Quick Actions */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
								{/* XML Feed */}
								<div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8DCCB] space-y-2.5">
									<div className="flex items-center justify-between">
										<span className="font-bold text-stone-800">
											رابط خلاصة الكتالوج (XML RSS Data Feed):
										</span>
										<span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
											الموصى به من Meta
										</span>
									</div>
									<p className="text-[11px] text-stone-500">
										ضع هذا الرابط في Meta Commerce Manager (Data Feed) لتحديث المنتجات تلقائياً كل ساعة.
									</p>
									<div className="flex items-center gap-2">
										<input
											type="text"
											readOnly
											value={typeof window !== "undefined" ? `${window.location.origin}/api/catalog/meta` : "/api/catalog/meta"}
											className="w-full p-2 text-[11px] font-mono bg-white border border-stone-300 rounded-lg text-stone-700"
											dir="ltr"
										/>
										<button
											onClick={() => {
												const feedUrl = `${window.location.origin}/api/catalog/meta`;
												copyToClipboard(feedUrl);
												showToast("تم النسخ", "تم نسخ رابط خلاصة Meta Catalog XML بنجاح.");
											}}
											className="px-3 py-2 bg-[#2C2014] text-amber-200 rounded-lg text-xs font-bold hover:bg-black shrink-0 flex items-center gap-1"
										>
											<Copy className="w-3.5 h-3.5" />
											<span>نسخ</span>
										</button>
										<a
											href="/api/catalog/meta"
											target="_blank"
											rel="noreferrer"
											className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg shrink-0"
											title="معاينة ملف XML"
										>
											<ExternalLink className="w-3.5 h-3.5" />
										</a>
									</div>
								</div>

								{/* CSV Catalog Download */}
								<div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8DCCB] space-y-2.5">
									<div className="flex items-center justify-between">
										<span className="font-bold text-stone-800">
											ملف الكتالوج المجدول (CSV Spreadsheet):
										</span>
										<span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded font-bold">
											رفع يدوي
										</span>
									</div>
									<p className="text-[11px] text-stone-500">
										يمكنك تنزيل ملف CSV بجميع المنتجات المتوافقة مع مواصفات Facebook Product Catalog ورفعه يدوياً.
									</p>
									<div className="pt-1 flex items-center gap-2">
										<a
											href="/api/catalog/meta?format=csv"
											download="meta_facebook_catalog.csv"
											className="px-4 py-2 bg-blue-800 text-white rounded-lg text-xs font-bold hover:bg-blue-900 transition-colors flex items-center gap-1.5 shadow"
										>
											<Download className="w-3.5 h-3.5" />
											<span>تنزيل ملف الكتالوج (CSV)</span>
										</a>
										<a
											href="/api/catalog/meta?format=json"
											target="_blank"
											rel="noreferrer"
											className="px-3 py-2 bg-white border border-stone-300 text-stone-700 rounded-lg text-xs font-medium hover:bg-stone-100"
										>
											خلاصة JSON API
										</a>
									</div>
								</div>
							</div>

							{/* Meta Pixel Configuration Box */}
							<div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/60 space-y-3 text-xs">
								<h4 className="font-bold text-blue-950 flex items-center gap-2">
									<span>إعدادات بكسل فيسبوك (Meta Pixel Tracker)</span>
								</h4>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div>
										<label className="block text-stone-700 font-semibold mb-1">
											معرّف البكسل (Meta Pixel ID):
										</label>
										<input
											type="text"
											value={settingsForm.metaPixelId}
											onChange={(e) =>
												setSettingsForm({ ...settingsForm, metaPixelId: e.target.value })
											}
											placeholder="مثال: 987654321098765"
											dir="ltr"
											className="w-full p-2 bg-white border border-stone-300 rounded-lg text-right font-mono"
										/>
									</div>
									<div className="flex items-end">
										<button
											onClick={async () => {
												await updateSettings({ metaPixelId: settingsForm.metaPixelId });
											}}
											className="px-5 py-2 bg-[#2C2014] text-amber-200 font-bold rounded-lg hover:bg-black"
										>
											حفظ معرّف البكسل
										</button>
									</div>
								</div>

								<div className="pt-2 border-t border-blue-100 flex flex-wrap gap-3 text-[11px] text-blue-900">
									<span className="flex items-center gap-1">
										<Check className="w-3 h-3 text-emerald-600" />
										<span>PageView (الزيارات)</span>
									</span>
									<span className="flex items-center gap-1">
										<Check className="w-3 h-3 text-emerald-600" />
										<span>ViewContent (استعراض المحصول)</span>
									</span>
									<span className="flex items-center gap-1">
										<Check className="w-3 h-3 text-emerald-600" />
										<span>AddToCart (إضافة للسلة)</span>
									</span>
									<span className="flex items-center gap-1">
										<Check className="w-3 h-3 text-emerald-600" />
										<span>Purchase (إتمام الطلب بالدرهم الإماراتي)</span>
									</span>
								</div>
							</div>
						</div>

						{/* Live Meta Feed Product Table */}
						<div className="bg-white p-6 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<h4 className="font-serif text-lg font-bold text-[#2C2014]">
										معاينة حقول الكتالوج المعتمدة في Meta ({products.length} منتج)
									</h4>
									<p className="text-xs text-stone-500">
										المطابقة التلقائية لمواصفات Facebook Shopping & Instagram Shop
									</p>
								</div>
							</div>

							<div className="overflow-x-auto">
								<table className="w-full text-right text-xs">
									<thead className="bg-[#FAF7F2] border-b border-stone-200 text-stone-600">
										<tr>
											<th className="py-2.5 px-3 font-semibold">id</th>
											<th className="py-2.5 px-3 font-semibold">title</th>
											<th className="py-2.5 px-3 font-semibold">availability</th>
											<th className="py-2.5 px-3 font-semibold">price</th>
											<th className="py-2.5 px-3 font-semibold">brand</th>
											<th className="py-2.5 px-3 font-semibold">google_product_category</th>
											<th className="py-2.5 px-3 font-semibold">image_link</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-stone-100">
										{products.map((p) => (
											<tr key={p.id} className="hover:bg-stone-50/50">
												<td className="py-2.5 px-3 font-mono font-bold text-stone-900" dir="ltr">
													{p.id}
												</td>
												<td className="py-2.5 px-3 font-bold text-stone-800">
													{p.name}
												</td>
												<td className="py-2.5 px-3">
													<span
														className={`px-2 py-0.5 rounded text-[10px] font-bold ${
															p.inStock
																? "bg-emerald-100 text-emerald-800"
																: "bg-rose-100 text-rose-800"
														}`}
													>
														{p.inStock ? "in stock" : "out of stock"}
													</span>
												</td>
												<td className="py-2.5 px-3 font-bold tabular-nums text-amber-900">
													{p.price}.00 AED
												</td>
												<td className="py-2.5 px-3 text-stone-700">خيرات الدار</td>
												<td className="py-2.5 px-3 text-stone-500 text-[11px] truncate max-w-[150px]">
													Food &gt; Fresh Produce
												</td>
												<td className="py-2.5 px-3 text-blue-600 text-[11px] truncate max-w-[120px]" dir="ltr">
													{p.image}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* TAB: UNIFIED MARKETING & META MCP HUB */}
				{(cmsTab === "marketing" || cmsTab === "mcp" || cmsTab === "campaigns" || cmsTab === "meta") && (
					<UnifiedMarketingMcpHub />
				)}

				{/* TAB: AI MCP COPILOT */}
				{cmsTab === "ai_agent" && <StoreAiCopilot />}

				{/* TAB: ZIINA PAYMENT GATEWAY */}
				{cmsTab === "ziina" && <ZiinaGatewaySettings />}

				{/* TAB 6: STORE SETTINGS */}
				{cmsTab === "settings" && (
					<div className="max-w-2xl bg-white p-6 sm:p-8 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-6">
						<div className="border-b border-stone-200 pb-3">
							<h3 className="font-serif text-xl font-bold text-[#2C2014]">
								إعدادات المتجر الإماراتي
							</h3>
							<p className="text-xs text-stone-500">
								تحديث بيانات الاتصال، شريط الإعلانات، وحد التوصيل المجاني
							</p>
						</div>

						<form
							onSubmit={async (e) => {
								e.preventDefault();
								const values = {
									storeName: settingsForm.storeName.trim(),
									storeTagline: settingsForm.storeTagline.trim(),
									whatsappNumber: settingsForm.whatsappNumber.trim(),
									contactPhone: settingsForm.contactPhone.trim(),
									freeDeliveryThreshold: Number(settingsForm.freeDeliveryThreshold),
									standardDeliveryFee: Number(settingsForm.standardDeliveryFee),
									bannerNotice: settingsForm.bannerNotice.trim(),
									bannerActive: Boolean(settingsForm.bannerActive),
									featuredSeason: String(settingsForm.featuredSeason || "").trim(),
									facebookCatalogFeedEnabled: Boolean(settingsForm.facebookCatalogFeedEnabled),
									currency: "AED",
								};
								if (!Number.isFinite(values.freeDeliveryThreshold) || values.freeDeliveryThreshold < 0 ||
									!Number.isFinite(values.standardDeliveryFee) || values.standardDeliveryFee < 0) {
									showToast("تحقق من رسوم التوصيل", "يجب إدخال مبالغ صحيحة غير سالبة بالدرهم الإماراتي.", "warning");
									return;
								}
								await updateSettings(values);
							}}
							className="space-y-5 text-xs"
						>
							<div>
								<label className="block font-semibold text-stone-800 mb-1.5">اسم المتجر *</label>
								<input type="text" required maxLength={120} value={settingsForm.storeName} onChange={(e) => setSettingsForm({ ...settingsForm, storeName: e.target.value })} className="w-full rounded-xl border border-stone-300 bg-white p-3 focus:border-amber-800 focus:outline-none" />
							</div>

							<div>
								<label className="block font-semibold text-stone-800 mb-1.5">الوصف والعنوان الترويجي</label>
								<input type="text" maxLength={240} value={settingsForm.storeTagline} onChange={(e) => setSettingsForm({ ...settingsForm, storeTagline: e.target.value })} className="w-full rounded-xl border border-stone-300 bg-white p-3 focus:border-amber-800 focus:outline-none" />
							</div>

							<div>
								<label className="block font-semibold text-stone-800 mb-1.5">نص شريط الإعلان العلوي</label>
								<textarea value={settingsForm.bannerNotice} onChange={(e) => setSettingsForm({ ...settingsForm, bannerNotice: e.target.value })} rows={2} maxLength={300} className="w-full rounded-xl border border-stone-300 bg-white p-3 focus:border-amber-800 focus:outline-none" />
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
									<input type="checkbox" checked={Boolean(settingsForm.bannerActive)} onChange={(e) => setSettingsForm({ ...settingsForm, bannerActive: e.target.checked })} className="h-4 w-4" />
									<span><strong className="block text-stone-800">إظهار شريط الإعلان</strong><small className="text-stone-500">bannerActive</small></span>
								</label>
								<label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
									<input type="checkbox" checked={Boolean(settingsForm.facebookCatalogFeedEnabled)} onChange={(e) => setSettingsForm({ ...settingsForm, facebookCatalogFeedEnabled: e.target.checked })} className="h-4 w-4" />
									<span><strong className="block text-stone-800">تفعيل إعداد خلاصة Meta</strong><small className="text-stone-500">facebookCatalogFeedEnabled</small></span>
								</label>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<div>
									<label className="block font-semibold text-stone-800 mb-1.5">الموسم المميز</label>
									<input type="text" maxLength={100} value={settingsForm.featuredSeason || ""} onChange={(e) => setSettingsForm({ ...settingsForm, featuredSeason: e.target.value })} placeholder="موسم القيظ" className="w-full rounded-xl border border-stone-300 bg-white p-3 focus:border-amber-800 focus:outline-none" />
								</div>
								<div>
									<label className="block font-semibold text-stone-800 mb-1.5">عملة المتجر</label>
									<input type="text" value="AED — الدرهم الإماراتي" readOnly className="w-full rounded-xl border border-stone-200 bg-stone-100 p-3 font-semibold text-stone-500" />
									<p className="mt-1 text-[10px] text-stone-400">موحّدة مع D1 وعمليات الطلب والدفع.</p>
								</div>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<div>
									<label className="block font-semibold text-stone-800 mb-1.5">رقم الواتساب للطلبات *</label>
									<input type="tel" required maxLength={30} value={settingsForm.whatsappNumber} onChange={(e) => setSettingsForm({ ...settingsForm, whatsappNumber: e.target.value })} dir="ltr" className="w-full rounded-xl border border-stone-300 bg-white p-3 text-left focus:border-amber-800 focus:outline-none" placeholder="+971500000000" />
								</div>
								<div>
									<label className="block font-semibold text-stone-800 mb-1.5">رقم هاتف خدمة العملاء *</label>
									<input type="tel" required maxLength={30} value={settingsForm.contactPhone} onChange={(e) => setSettingsForm({ ...settingsForm, contactPhone: e.target.value })} dir="ltr" className="w-full rounded-xl border border-stone-300 bg-white p-3 text-left focus:border-amber-800 focus:outline-none" placeholder="+971500000000" />
								</div>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<div>
									<label className="block font-semibold text-stone-800 mb-1.5">حد التوصيل المجاني (AED) *</label>
									<input type="number" required min="0" step="0.01" inputMode="decimal" value={settingsForm.freeDeliveryThreshold} onChange={(e) => setSettingsForm({ ...settingsForm, freeDeliveryThreshold: Number(e.target.value) })} className="w-full rounded-xl border border-stone-300 bg-white p-3 tabular-nums focus:border-amber-800 focus:outline-none" />
								</div>
								<div>
									<label className="block font-semibold text-stone-800 mb-1.5">رسوم التوصيل القياسي (AED) *</label>
									<input type="number" required min="0" step="0.01" inputMode="decimal" value={settingsForm.standardDeliveryFee} onChange={(e) => setSettingsForm({ ...settingsForm, standardDeliveryFee: Number(e.target.value) })} className="w-full rounded-xl border border-stone-300 bg-white p-3 tabular-nums focus:border-amber-800 focus:outline-none" />
								</div>
							</div>

							<div className="flex justify-end border-t border-stone-200 pt-4">
								<button type="submit" className="rounded-xl bg-[#2C2014] px-7 py-3 font-bold text-amber-100 shadow hover:bg-black">حفظ إعدادات المتجر في D1</button>
							</div>
						</form>
					</div>
				)}
			</div>

			{(isAddModalOpen || editingProduct) && (
				<ProductFormModal
					product={editingProduct}
					initialImage={newProductImageSelection}
					onClose={() => {
						setIsAddModalOpen(false);
						setEditingProduct(null);
						setNewProductImageSelection("");
					}}
					onSave={async (data) => editingProduct
						? await updateProduct(editingProduct.id, data)
						: await addProduct(data)}
				/>
			)}

			{/* MODAL: VIEW ORDER INVOICE */}
			{viewingOrder && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn text-right">
					<div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#D6BE9F] shadow-2xl space-y-4">
						<div className="flex justify-between items-center pb-2 border-b border-stone-200">
							<div>
								<h3 className="font-serif text-lg font-bold text-[#2C2014]">
									فاتورة الطلب: {viewingOrder.orderNumber}
								</h3>
								<p className="text-[11px] text-stone-500">
									التاريخ: {new Date(viewingOrder.createdAt).toLocaleDateString("ar-AE")}
								</p>
								<div className="flex items-center gap-1.5 mt-1">
									<span className="text-[10px] text-stone-400 font-mono">معرّف السجل: {viewingOrder.id}</span>
									<span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
										<CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
										<span>موثق بقاعدة البيانات</span>
									</span>
								</div>
							</div>
							<button
								onClick={() => setViewingOrder(null)}
								className="text-stone-400 hover:text-black"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8DCCB] text-xs space-y-1.5">
							<p>
								<strong className="text-stone-700">العميل: </strong>
								{viewingOrder.customerName}
							</p>
							<p>
								<strong className="text-stone-700">الهاتف: </strong>
								<span dir="ltr">{viewingOrder.customerPhone}</span>
							</p>
							<p>
								<strong className="text-stone-700">العنوان: </strong>
								{viewingOrder.customerEmirate} - {viewingOrder.customerAddress}
							</p>
							{viewingOrder.notes && (
								<p>
									<strong className="text-stone-700">ملاحظات: </strong>
									{viewingOrder.notes}
								</p>
							)}
							{viewingOrder.giftNote && (
								<p className="text-amber-900 bg-amber-50 p-2 rounded border border-amber-200">
									<strong>عبارة الإهداء: </strong> {viewingOrder.giftNote}
								</p>
							)}
						</div>

						<div className="space-y-1 text-xs">
							<p className="font-bold text-stone-800">الأصناف المطلوبة:</p>
							{viewingOrder.items.map((it, idx) => (
								<div
									key={idx}
									className="flex justify-between p-2 rounded bg-stone-50 border border-stone-100"
								>
									<span>
										{it.quantity} × {it.name} ({it.unit})
									</span>
									<span className="font-bold tabular-nums">
										{it.price * it.quantity} د.إ
									</span>
								</div>
							))}
						</div>

						<div className="pt-2 border-t border-stone-200 flex justify-between items-baseline text-sm">
							<span className="font-bold">المجموع الكلي:</span>
							<span className="font-serif text-xl font-bold text-amber-900 tabular-nums">
								{viewingOrder.total} د.إ
							</span>
						</div>

						<div className="pt-2 flex justify-end">
							<button
								onClick={() => setViewingOrder(null)}
								className="px-5 py-2 bg-[#2C2014] text-amber-200 text-xs font-bold rounded-lg hover:bg-black"
							>
								إغلاق
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Floating AI Copilot Quick Access Button */}
			{cmsTab !== "ai_agent" && (
				<button
					onClick={() => setCmsTab("ai_agent")}
					className="fixed bottom-6 left-6 z-40 bg-gradient-to-r from-[#2C2014] to-[#453220] hover:from-black hover:to-[#2C2014] text-amber-300 px-4 py-3 rounded-2xl shadow-2xl border border-amber-500/40 flex items-center gap-2.5 transition-all transform hover:scale-105 group"
					title="فتح المساعد الذكي لإدارة المتجر والحملات"
				>
					<div className="w-8 h-8 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold shadow-sm">
						<Bot className="w-4 h-4" />
					</div>
					<div className="text-right">
						<div className="text-xs font-bold text-amber-100 flex items-center gap-1.5">
							<span>المساعد الذكي (MCP Copilot)</span>
							<Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
						</div>
						<div className="text-[10px] text-stone-300">تحكم بالمتجر وحملات Meta</div>
					</div>
				</button>
			)}
		</div>
	);
};
