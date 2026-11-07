import React, { useState } from "react";
import { useStore } from "../context/StoreContext";
import {
	X,
	Trash2,
	Plus,
	Minus,
	ShoppingBag,
	Truck,
	Gift,
	CheckCircle,
	MessageSquare,
	CreditCard,
	ShieldCheck,
	Zap,
	ArrowUpRight,
	Loader2,
	Lock,
} from "lucide-react";
import { t, locale, formatImagePath } from "../frontend/locales/i18n";

export const CartDrawer: React.FC = () => {
	const {
		cart,
		updateCartQty,
		removeFromCart,
		clearCart,
		cartTotal,
		isCartOpen,
		setIsCartOpen,
		settings,
		addOrder,
		setLastOrder,
		showToast,
	} = useStore();

	const emiratesList: string[] = (locale.cart as any).emiratesList || [
		"Abu Dhabi",
		"Dubai",
		"Sharjah",
		"Al Ain",
		"Ajman",
		"Ras Al Khaimah",
		"Fujairah",
		"Umm Al Quwain",
	];

	const [customerName, setCustomerName] = useState("");
	const [customerPhone, setCustomerPhone] = useState("");
	const [customerEmirate, setCustomerEmirate] = useState(emiratesList[0] || "");
	const [customerAddress, setCustomerAddress] = useState("");
	const [deliveryNotes, setDeliveryNotes] = useState("");
	const [hasGiftNote, setHasGiftNote] = useState(false);
	const [giftNoteText, setGiftNoteText] = useState("");
	const [paymentMethod, setPaymentMethod] = useState<"ziina" | "cod" | "card_on_delivery" | "whatsapp">("ziina");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [ziinaRedirecting, setZiinaRedirecting] = useState(false);
	const [redirectProgress, setRedirectProgress] = useState(25);
	const [ziinaModalUrl, setZiinaModalUrl] = useState<string | null>(null);
	const [errors, setErrors] = useState<{ name?: string; phone?: string; address?: string }>({});

	if (!isCartOpen) return null;

	const deliveryFee =
		cartTotal >= settings.freeDeliveryThreshold || cartTotal === 0
			? 0
			: settings.standardDeliveryFee;
	const grandTotal = cartTotal + deliveryFee;
	const remainingForFreeShipping = Math.max(
		0,
		settings.freeDeliveryThreshold - cartTotal,
	);
	const freeShippingPercent = Math.min(
		100,
		Math.round((cartTotal / settings.freeDeliveryThreshold) * 100),
	);

	const validate = () => {
		const newErrors: { name?: string; phone?: string; address?: string } = {};
		if (!customerName.trim()) newErrors.name = t("cart.nameError");
		if (!customerPhone.trim() || customerPhone.trim().length < 8) {
			newErrors.phone = t("cart.phoneError");
		}
		if (!customerAddress.trim()) newErrors.address = t("cart.addressError");
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleCheckout = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;
		if (cart.length === 0) return;

		setIsSubmitting(true);

		const orderItems = cart.map((item) => ({
			productId: item.product.id,
			name: item.product.name,
			quantity: item.quantity,
			price: item.product.price,
			unit: item.product.unit,
		}));

		const newOrder = await addOrder({
			customerName,
			customerPhone,
			customerEmirate,
			customerAddress,
			notes: deliveryNotes,
			giftNote: hasGiftNote ? giftNoteText : undefined,
			items: orderItems,
			subtotal: cartTotal,
			deliveryFee,
			discount: 0,
			total: grandTotal,
			paymentMethod,
			paymentStatus: paymentMethod === "ziina" ? "pending" : "pending",
		});

		// 1. If Ziina Payment Gateway selected: initiate Ziina Payment Intent and redirect
		if (paymentMethod === "ziina") {
			setZiinaRedirecting(true);
			setRedirectProgress(30);
			const timer1 = setTimeout(() => setRedirectProgress(65), 350);
			const timer2 = setTimeout(() => setRedirectProgress(90), 850);
			try {
				const finalOrderId = newOrder.id || (newOrder as any).order?.id;
				if (!finalOrderId) throw new Error("Saved order ID is missing");

				const ziinaRes = await fetch("/api/ziina/create-intent", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						orderId: finalOrderId,
						orderNumber: finalOrderNumber,
						amount: grandTotal,
						currency: "AED",
						customerName,
						customerPhone,
					}),
				});

				const ziinaData = (await ziinaRes.json()) as any;
				if (ziinaData.success && ziinaData.redirect_url) {
					clearTimeout(timer1);
					clearTimeout(timer2);
					setRedirectProgress(100);
					let targetUrl: string = ziinaData.redirect_url;

					// Strip any hardcoded localhost:3000 to keep user on their current domain
					if (targetUrl.includes("localhost:3000")) {
						try {
							const u = new URL(targetUrl);
							targetUrl = `${u.pathname}${u.search}`;
						} catch {
							throw new Error("Ziina returned an invalid redirect URL");
						}
					}


					// Internal relative URL (if provided by the configured gateway):
					if (targetUrl.startsWith("/")) {
						setIsCartOpen(false);
						window.location.href = targetUrl;
						return;
					}

					// For external gateway URL (pay.ziina.com / api-v2.ziina.com):
					// Set the direct link modal in case popup or iframe navigation is restricted by browser
					setZiinaModalUrl(targetUrl);
					setZiinaRedirecting(false);

					// Attempt immediate browser navigation or popup
					try {
						if (typeof window !== "undefined" && window.top && window.top !== window.self) {
							window.top.location.href = targetUrl;
							return;
						}
					} catch {}

					try {
						const popup = window.open(targetUrl, "_blank");
						if (popup) {
							setIsCartOpen(false);
							return;
						}
					} catch {}

					window.location.href = targetUrl;
					return;
				} else {
					clearTimeout(timer1);
					clearTimeout(timer2);
					showToast(
						t("paymentCallback.failedTitle"),
						ziinaData.error || t("paymentCallback.failedDesc"),
						"warning",
					);
					setZiinaRedirecting(false);
					setIsSubmitting(false);
					return;
				}
			} catch (ziinaErr) {
				clearTimeout(timer1);
				clearTimeout(timer2);
				console.error("Ziina payment init error:", ziinaErr);
				showToast(
					t("paymentCallback.failedTitle"),
					t("paymentCallback.failedDesc"),
					"warning",
				);
				setZiinaRedirecting(false);
				setIsSubmitting(false);
				return;
			}
		}

		// For Cash on Delivery, Card on Delivery, or WhatsApp:
		clearCart();
		setLastOrder(newOrder);
		setIsSubmitting(false);
		setIsCartOpen(false);

		// 2. If WhatsApp chosen, prepare whatsapp link
		if (paymentMethod === "whatsapp") {
			const itemsSummary = cart
				.map((i) => `• ${i.quantity} × ${i.product.name} (${i.product.price * i.quantity} AED)`)
				.join("%0A");
			const waText = `Order: ${newOrder.orderNumber}%0AName: ${customerName}%0APhone: ${customerPhone}%0AEmirate: ${customerEmirate}%0AAddress: ${customerAddress}%0A%0AItems:%0A${itemsSummary}%0A%0ATotal: ${grandTotal} AED`;
			try {
				window.open(
					`https://wa.me/${(settings.whatsappNumber || "971504020220").replace(/[^0-9]/g, "")}?text=${waText}`,
					"_blank",
				);
			} catch {
				// Fallback handled in OrderSuccessModal
			}
		}
	};

	return (
		<div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fadeIn">
			<div className="absolute inset-0" onClick={() => setIsCartOpen(false)} />

			<div className="fixed inset-y-0 right-0 max-w-full flex pl-10 text-right">
				<div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-[#D6BE9F]">
					{/* Header */}
					<div className="p-4 sm:p-5 border-b border-stone-200 bg-[#FAF7F2] flex items-center justify-between">
						<div className="flex items-center gap-2">
							<ShoppingBag className="w-5 h-5 text-amber-800" />
							<h3 className="font-serif text-lg font-bold text-[#2C2014]">
								{t("cart.title")}
							</h3>
							<span className="text-xs bg-[#E8DCCB] text-[#574127] font-semibold px-2 py-0.5 rounded-full tabular-nums">
								{t("cart.itemsCount", { count: cart.length })}
							</span>
						</div>
						<button
							onClick={() => setIsCartOpen(false)}
							className="p-1.5 rounded-lg text-stone-500 hover:text-black hover:bg-stone-200/60 transition-colors"
							aria-label="close"
						>
							<X className="w-5 h-5" />
						</button>
					</div>

					{/* Free Shipping Progress */}
					<div className="px-5 py-3 bg-[#F5EFE6] border-b border-[#E8DCCB] text-xs">
						{remainingForFreeShipping > 0 ? (
							<div className="space-y-1.5">
								<p className="text-[#574127] font-medium flex items-center gap-1.5">
									<Truck className="w-4 h-4 text-amber-700 shrink-0" />
									<span>
										{t("cart.addMoreForFreeShipping", { amount: remainingForFreeShipping })}
									</span>
								</p>
								<div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
									<div
										className="bg-amber-700 h-full transition-all duration-300"
										style={{ width: `${freeShippingPercent}%` }}
									/>
								</div>
							</div>
						) : (
							<p className="text-emerald-800 font-bold flex items-center gap-1.5">
								<CheckCircle className="w-4 h-4 text-emerald-600" />
								<span>{t("cart.freeShippingQualified")}</span>
							</p>
						)}
					</div>

					{/* Cart Items List */}
					<div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
						{cart.length === 0 ? (
							<div className="py-16 text-center space-y-3">
								<div className="w-16 h-16 rounded-full bg-[#F5EFE6] text-amber-800 flex items-center justify-center mx-auto">
									<ShoppingBag className="w-8 h-8 opacity-60" />
								</div>
								<p className="font-serif text-lg font-bold text-stone-800">
									{t("cart.emptyTitle")}
								</p>
								<p className="text-xs text-stone-500 max-w-xs mx-auto">
									{t("cart.emptyDesc")}
								</p>
								<button
									onClick={() => setIsCartOpen(false)}
									className="mt-3 px-5 py-2.5 bg-[#2C2014] text-amber-200 text-xs font-semibold rounded-lg hover:bg-black transition-colors"
								>
									{t("cart.startShopping")}
								</button>
							</div>
						) : (
							<>
								<div className="space-y-3">
									{cart.map((item) => (
										<div
											key={item.product.id}
											className="flex gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200/80 items-center justify-between"
										>
											<img
												src={formatImagePath(item.product.image)}
												alt={item.product.name}
												referrerPolicy="no-referrer"
												className="w-16 h-16 rounded-lg object-cover bg-stone-200 shrink-0"
											/>

											<div className="flex-1 min-w-0 pr-1">
												<h4 className="text-xs font-bold text-stone-900 truncate">
													{item.product.name}
												</h4>
												<p className="text-[11px] text-stone-500">
													{item.product.unit || t("products.freshCut")}
												</p>
												<p className="text-xs font-bold text-[#8B5A2B] mt-1 tabular-nums">
													{item.product.price * item.quantity} {t("products.currency")}
												</p>
											</div>

											{/* Stepper */}
											<div className="flex flex-col items-end gap-1.5 shrink-0">
												<button
													onClick={() => removeFromCart(item.product.id)}
													className="text-stone-400 hover:text-rose-600 transition-colors p-0.5"
													title={t("admin.delete")}
												>
													<Trash2 className="w-3.5 h-3.5" />
												</button>

												<div className="flex items-center border border-stone-300 rounded bg-white">
													<button
														onClick={() =>
															updateCartQty(item.product.id, item.quantity - 1)
														}
														className="px-1.5 py-0.5 text-stone-600 hover:bg-stone-100"
													>
														<Minus className="w-3 h-3" />
													</button>
													<span className="px-2 text-xs font-bold tabular-nums">
														{item.quantity}
													</span>
													<button
														onClick={() =>
															updateCartQty(item.product.id, item.quantity + 1)
														}
														className="px-1.5 py-0.5 text-stone-600 hover:bg-stone-100"
													>
														<Plus className="w-3 h-3" />
													</button>
												</div>
											</div>
										</div>
									))}
								</div>

								{/* Gift Card Addon */}
								<div className="pt-2 border-t border-stone-100">
									<label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700 font-medium">
										<input
											type="checkbox"
											checked={hasGiftNote}
											onChange={(e) => setHasGiftNote(e.target.checked)}
											className="rounded text-amber-800 focus:ring-amber-800"
										/>
										<Gift className="w-3.5 h-3.5 text-amber-700" />
										<span>{t("cart.giftNote")}</span>
									</label>
									{hasGiftNote && (
										<textarea
											value={giftNoteText}
											onChange={(e) => setGiftNoteText(e.target.value)}
											placeholder={t("cart.giftNotePlaceholder")}
											rows={2}
											className="w-full mt-2 p-2 text-xs border border-amber-300 rounded-lg bg-amber-50/40 focus:outline-none focus:ring-1 focus:ring-amber-800"
										/>
									)}
								</div>

								{/* Customer Info Form */}
								<form id="checkout-form" onSubmit={handleCheckout} className="pt-3 border-t border-stone-200 space-y-3">
									<h4 className="text-xs font-bold text-stone-900">
										{t("cart.customerInfo")}
									</h4>

									<div>
										<label className="block text-[11px] font-medium text-stone-600 mb-1">
											{t("cart.fullName")} *
										</label>
										<input
											type="text"
											value={customerName}
											onChange={(e) => setCustomerName(e.target.value)}
											placeholder={t("cart.fullName")}
											className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-amber-800"
										/>
										{errors.name && (
											<p className="text-[10px] text-rose-600 mt-0.5">{errors.name}</p>
										)}
									</div>

									<div className="grid grid-cols-2 gap-2">
										<div>
											<label className="block text-[11px] font-medium text-stone-600 mb-1">
												{t("cart.phoneNumber")} *
											</label>
											<input
												type="tel"
												value={customerPhone}
												onChange={(e) => setCustomerPhone(e.target.value)}
												placeholder="+971 50 000 0000"
												dir="ltr"
												className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-amber-800 text-right"
											/>
											{errors.phone && (
												<p className="text-[10px] text-rose-600 mt-0.5">{errors.phone}</p>
											)}
										</div>

										<div>
											<label className="block text-[11px] font-medium text-stone-600 mb-1">
												{t("cart.emirate")} *
											</label>
											<select
												value={customerEmirate}
												onChange={(e) => setCustomerEmirate(e.target.value)}
												className="w-full px-2 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-amber-800 bg-white"
											>
												{emiratesList.map((em) => (
													<option key={em} value={em}>
														{em}
													</option>
												))}
											</select>
										</div>
									</div>

									<div>
										<label className="block text-[11px] font-medium text-stone-600 mb-1">
											{t("cart.address")} *
										</label>
										<input
											type="text"
											value={customerAddress}
											onChange={(e) => setCustomerAddress(e.target.value)}
											placeholder={t("cart.address")}
											className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-amber-800"
										/>
										{errors.address && (
											<p className="text-[10px] text-rose-600 mt-0.5">{errors.address}</p>
										)}
									</div>

									<div>
										<label className="block text-[11px] font-medium text-stone-600 mb-1">
											{t("cart.notes")}
										</label>
										<input
											type="text"
											value={deliveryNotes}
											onChange={(e) => setDeliveryNotes(e.target.value)}
											placeholder={t("cart.notes")}
											className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-amber-800"
										/>
									</div>

									{/* Payment Method Selector */}
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<label className="block text-[11px] font-bold text-stone-700">
												{t("cart.paymentMethod")}
											</label>
											<span className="text-[10px] text-amber-800 font-medium flex items-center gap-1">
												<ShieldCheck className="w-3 h-3 text-emerald-600" />
												<span>{t("cart.instantAndSecure")}</span>
											</span>
										</div>

										{/* Primary Ziina Payment Option */}
										<button
											type="button"
											onClick={() => setPaymentMethod("ziina")}
											className={`w-full p-3 rounded-xl border text-right transition-all flex items-center justify-between gap-3 ${
												paymentMethod === "ziina"
													? "border-amber-800 bg-[#F5EFE6] shadow-sm ring-1 ring-amber-800"
													: "border-stone-200 bg-white hover:bg-stone-50"
											}`}
										>
											<div className="flex items-center gap-2.5">
												<div
													className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
														paymentMethod === "ziina"
															? "bg-[#2C2014] text-amber-300"
															: "bg-stone-100 text-stone-600"
													}`}
												>
													<CreditCard className="w-4 h-4" />
												</div>
												<div>
													<div className="flex items-center gap-1.5 font-bold text-xs text-[#2C2014]">
														<span>{t("cart.payZiina")}</span>
														<span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-800 font-semibold">
															{t("cart.instantAndSecure")}
														</span>
													</div>
													<p className="text-[10px] text-stone-500 mt-0.5">
														{t("cart.payZiinaSub")}
													</p>
												</div>
											</div>
											<div
												className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
													paymentMethod === "ziina"
														? "border-amber-800 bg-amber-800"
														: "border-stone-300"
												}`}
											>
												{paymentMethod === "ziina" && (
													<div className="w-1.5 h-1.5 rounded-full bg-white" />
												)}
											</div>
										</button>

										{/* Secondary Payment Methods Grid */}
										<div className="grid grid-cols-3 gap-1.5 text-center">
											<button
												type="button"
												onClick={() => setPaymentMethod("cod")}
												className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
													paymentMethod === "cod"
														? "border-[#2C2014] bg-[#F5EFE6] text-[#2C2014]"
														: "border-stone-200 text-stone-600 hover:bg-stone-50"
												}`}
											>
												{t("cart.payCod")}
											</button>
											<button
												type="button"
												onClick={() => setPaymentMethod("card_on_delivery")}
												className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
													paymentMethod === "card_on_delivery"
														? "border-[#2C2014] bg-[#F5EFE6] text-[#2C2014]"
														: "border-stone-200 text-stone-600 hover:bg-stone-50"
												}`}
											>
												{t("cart.payCardOnDelivery")}
											</button>
											<button
												type="button"
												onClick={() => setPaymentMethod("whatsapp")}
												className={`p-2 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
													paymentMethod === "whatsapp"
														? "border-emerald-800 bg-emerald-50 text-emerald-900"
														: "border-stone-200 text-stone-600 hover:bg-stone-50"
												}`}
											>
												<MessageSquare className="w-3 h-3 text-emerald-600" />
												<span>{t("cart.payWhatsapp")}</span>
											</button>
										</div>

										{paymentMethod === "ziina" && (
											<div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[10px] text-amber-950 flex items-center gap-2">
												<ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
												<span>{t("cart.securePaymentNote")}</span>
											</div>
										)}
									</div>
								</form>
							</>
						)}
					</div>

					{/* Footer Summary & Place Order Button */}
					{cart.length > 0 && (
						<div className="p-4 sm:p-5 border-t border-stone-200 bg-[#FAF7F2] space-y-3">
							<div className="space-y-1.5 text-xs text-stone-600">
								<div className="flex justify-between">
									<span>{t("cart.subtotal")}:</span>
									<span className="font-semibold text-stone-900 tabular-nums">
										{cartTotal} {t("products.currency")}
									</span>
								</div>
								<div className="flex justify-between">
									<span>{t("cart.deliveryFee")}:</span>
									<span className="font-semibold tabular-nums">
										{deliveryFee === 0 ? (
											<span className="text-emerald-700">{t("cart.freeDelivery")}</span>
										) : (
											`${deliveryFee} ${t("products.currency")}`
										)}
									</span>
								</div>
								<div className="flex justify-between text-base font-bold text-[#2C2014] pt-2 border-t border-stone-200">
									<span>{t("cart.total")}:</span>
									<span className="font-serif text-xl tabular-nums">
										{grandTotal} {t("products.currency")}
									</span>
								</div>
							</div>

							<button
								type="submit"
								form="checkout-form"
								disabled={isSubmitting || ziinaRedirecting}
								className={`w-full py-3.5 px-4 text-sm font-bold rounded-xl transition-all shadow flex items-center justify-center gap-2 ${
									paymentMethod === "ziina"
										? "bg-amber-900 hover:bg-amber-950 text-amber-100 active:scale-[0.99]"
										: "bg-[#2C2014] hover:bg-black text-amber-200 active:scale-[0.99]"
								} disabled:opacity-85 disabled:cursor-wait`}
							>
								{ziinaRedirecting ? (
									<div className="flex items-center justify-center gap-2">
										<Loader2 className="w-4 h-4 animate-spin text-amber-300" />
										<span>جاري الاتصال وتجهيز الدفع...</span>
									</div>
								) : isSubmitting ? (
									<div className="flex items-center justify-center gap-2">
										<Loader2 className="w-4 h-4 animate-spin text-amber-300" />
										<span>{t("cart.processingPayment")}</span>
									</div>
								) : paymentMethod === "ziina" ? (
									<>
										<Zap className="w-4 h-4 text-amber-400" />
										<span>{t("cart.payZiina")} ({grandTotal} {t("products.currency")})</span>
									</>
								) : paymentMethod === "whatsapp" ? (
									<>
										<MessageSquare className="w-4 h-4 text-emerald-400" />
										<span>{t("cart.payWhatsapp")} ({grandTotal} {t("products.currency")})</span>
									</>
								) : (
									<>
										<CheckCircle className="w-4 h-4 text-amber-400" />
										<span>{t("cart.orderNow")} ({grandTotal} {t("products.currency")})</span>
									</>
								)}
							</button>

							<p className="text-[10px] text-stone-400 text-center">
								{paymentMethod === "ziina"
									? t("cart.securePaymentNote")
									: t("cart.codNote")}
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Dedicated Payment Redirect Spinner & Progress Indicator Overlay */}
			{ziinaRedirecting && (
				<div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 text-right animate-fadeIn">
					<div className="bg-[#FAF7F2] rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-amber-900/20 shadow-2xl space-y-6 text-center animate-scaleUp">
						{/* Animated Dual-Ring Spinner with Icon */}
						<div className="relative w-20 h-20 mx-auto flex items-center justify-center">
							<div className="absolute inset-0 rounded-full border-4 border-amber-500/20"></div>
							<div className="absolute inset-0 rounded-full border-4 border-amber-800 border-t-transparent animate-spin"></div>
							<div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-800 flex items-center justify-center shadow-inner">
								<CreditCard className="w-6 h-6 text-amber-800 animate-pulse" />
							</div>
						</div>

						<div className="space-y-2">
							<h3 className="font-serif text-lg font-bold text-[#2C2014]">
								جاري تجهيز بوابة الدفع (Ziina)
							</h3>
							<p className="text-xs text-stone-600 leading-relaxed">
								يرجى الانتظار لحظات، يتم الآن تشفير جلسة السداد وتجهيز الدفع عبر البطاقة البنكية أو Apple Pay...
							</p>
						</div>

						{/* Progress Bar with Percentage */}
						<div className="space-y-2">
							<div className="w-full bg-stone-200/80 rounded-full h-2.5 overflow-hidden shadow-inner">
								<div
									className="bg-gradient-to-r from-amber-600 to-amber-800 h-2.5 rounded-full transition-all duration-500 ease-out shadow-sm"
									style={{ width: `${redirectProgress}%` }}
								/>
							</div>
							<div className="flex items-center justify-between text-[11px] font-medium text-stone-500">
								<span className="flex items-center gap-1 text-emerald-700">
									<Lock className="w-3 h-3 text-emerald-600" />
									<span>اتصال آمن ومشفر 256-bit</span>
								</span>
								<span className="font-mono font-bold tabular-nums text-amber-900">{redirectProgress}%</span>
							</div>
						</div>

						{/* Step Status Badges */}
						<div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-200 text-[10px]">
							<div className="text-center p-2 rounded-xl bg-emerald-50 text-emerald-800 font-semibold border border-emerald-100 flex flex-col items-center gap-1 shadow-xs">
								<CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
								<span>تأكيد الطلب</span>
							</div>
							<div className="text-center p-2 rounded-xl bg-amber-50 text-amber-900 font-semibold border border-amber-200/60 flex flex-col items-center gap-1 shadow-xs">
								<Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
								<span>تأمين الجلسة</span>
							</div>
							<div className="text-center p-2 rounded-xl bg-stone-100 text-stone-400 font-medium flex flex-col items-center gap-1">
								<div className="w-3.5 h-3.5 rounded-full border-2 border-stone-300"></div>
								<span>صفحة الدفع</span>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Ziina Payment Gateway Breakout Modal */}
			{ziinaModalUrl && (
				<div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 text-right">
					<div className="bg-[#FAF7F2] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-amber-900/20 shadow-2xl space-y-5 text-center animate-scaleUp">
						<div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center justify-center mx-auto shadow-sm">
							<CreditCard className="w-8 h-8 text-amber-800 animate-pulse" />
						</div>
						<div className="space-y-2">
							<h3 className="font-serif text-xl font-bold text-[#2C2014]">
								الانتقال إلى بوابة الدفع الآمنة (Ziina)
							</h3>
							<p className="text-xs text-stone-600 leading-relaxed">
								تم تجهيز الطلب بنجاح. إذا لم يتم فتح صفحة الدفع بالبطاقة / Apple Pay تلقائياً، يرجى الضغط على الزر أدناه لإتمام الدفع:
							</p>
						</div>
						<div className="space-y-3 pt-2">
							<a
								href={ziinaModalUrl}
								target="_blank"
								rel="noopener noreferrer"
								onClick={() => {
									setIsCartOpen(false);
									setZiinaModalUrl(null);
								}}
								className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white font-bold text-sm rounded-xl shadow-lg transition-transform active:scale-95"
							>
								<span>الانتقال للدفع الآن عبر Ziina</span>
								<ArrowUpRight className="w-4 h-4" />
							</a>
							<button
								type="button"
								onClick={() => {
									setIsCartOpen(false);
									setZiinaModalUrl(null);
								}}
								className="text-xs text-stone-500 hover:text-stone-800 underline"
							>
								إغلاق
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
