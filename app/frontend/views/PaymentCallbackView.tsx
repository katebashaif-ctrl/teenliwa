import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
	CheckCircle,
	XCircle,
	AlertTriangle,
	Loader2,
	ShoppingBag,
	CreditCard,
	ArrowRight,
	Truck,
	ShieldCheck,
	Receipt,
	Phone,
	MessageSquare,
} from "lucide-react";
import { t } from "../locales/i18n";
import { Logo } from "../../components/Logo";
import { useStore } from "../../context/StoreContext";

interface VerificationResult {
	status: string;
	isPaid: boolean;
	intent?: {
		id: string;
		amount: number;
		currency_code: string;
		status: string;
		card_details?: {
			card_last_four?: string;
			card_brand?: string;
			card_issuer?: string;
		};
	};
}

export const PaymentCallbackView: React.FC = () => {
	const { orders, clearCart } = useStore();
	const [searchParams] = useSearchParams();
	const statusParam = searchParams.get("status") || "";
	const orderId = searchParams.get("orderId") || "";
	const paymentIntentId = searchParams.get("payment_intent_id") || searchParams.get("id") || "";
	const matchingOrder = orders.find((o) => o.id === orderId || o.orderNumber === orderId);

	const [isLoading, setIsLoading] = useState(true);
	const [result, setResult] = useState<VerificationResult | null>(null);

	useEffect(() => {
		let isMounted = true;
		async function verifyPayment() {
			if (!paymentIntentId || !orderId) {
				setResult({ status: "unverified", isPaid: false });
				setIsLoading(false);
				return;
			}
			try {
				const verifyUrl = `/api/ziina/verify?payment_intent_id=${encodeURIComponent(paymentIntentId)}&orderId=${encodeURIComponent(orderId)}`;
				const response = await fetch(verifyUrl, { cache: "no-store", credentials: "same-origin" });
				const data = await response.json() as any;
				if (!isMounted) return;
				if (response.ok && data.success && data.isPaid === true) {
					setResult({ status: String(data.status || "completed"), isPaid: true, intent: data.intent });
					clearCart();
				} else {
					setResult({ status: String(data.status || "unverified"), isPaid: false });
				}
			} catch (error) {
				console.warn("Payment verification error:", error);
				if (isMounted) setResult({ status: "unverified", isPaid: false });
			} finally {
				if (isMounted) setIsLoading(false);
			}
		}
		verifyPayment();
		return () => { isMounted = false; };
	}, [paymentIntentId, orderId]);

	const isSuccess = result?.isPaid === true;
	const isCancelled = statusParam === "cancelled" && !isSuccess;
	return (
		<div className="min-h-screen bg-[#FAF7F2] text-right flex flex-col justify-between selection:bg-amber-100 selection:text-amber-900">
			{/* Top Bar Header */}
			<header className="bg-[#2C2014] text-white border-b border-[#574127] py-4 px-6">
				<div className="max-w-4xl mx-auto flex items-center justify-between">
					<Link to="/" className="flex items-center gap-3">
						<Logo variant="compact" />
					</Link>
					<Link
						to="/"
						className="px-4 py-1.5 bg-[#574127] hover:bg-[#6d5231] text-amber-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
					>
						<span>{t("paymentCallback.returnToStore")}</span>
						<ArrowRight className="w-3.5 h-3.5" />
					</Link>
				</div>
			</header>

			{/* Main Content Area */}
			<main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
				<div className="w-full max-w-lg bg-white rounded-3xl border border-[#D6BE9F] shadow-2xl p-6 sm:p-8 space-y-6">
					{isLoading ? (
						<div className="py-16 text-center space-y-4">
							<Loader2 className="w-12 h-12 text-amber-700 animate-spin mx-auto" />
							<h2 className="font-serif text-xl font-bold text-[#2C2014]">
								{t("paymentCallback.verifying")}
							</h2>
						</div>
					) : isSuccess ? (
						<div className="space-y-6">
							{/* Success Header */}
							<div className="text-center space-y-2">
								<div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
									<CheckCircle className="w-9 h-9 text-emerald-600" />
								</div>
								<h2 className="font-serif text-2xl font-bold text-[#2C2014]">
									{t("paymentCallback.successTitle")}
								</h2>
								<p className="text-xs text-stone-500">
									{t("paymentCallback.successDesc")}
								</p>
							</div>

							{/* Payment Receipt Card */}
							<div className="p-4 rounded-2xl bg-[#F5EFE6]/70 border border-[#D6BE9F] space-y-3 text-xs">
								<div className="flex items-center justify-between pb-2 border-b border-[#D6BE9F]/60">
									<span className="text-stone-600 flex items-center gap-1.5">
										<Receipt className="w-3.5 h-3.5 text-amber-800" />
										<span>{t("admin.orderStatus")}:</span>
									</span>
									<span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1">
										<ShieldCheck className="w-3 h-3 text-emerald-600" />
										<span>{t("admin.statusDelivered")}</span>
									</span>
								</div>

								<div className="flex items-center justify-between">
									<span className="text-stone-600">{t("orderSuccess.orderNumber")}:</span>
									<span className="font-mono font-bold text-stone-900" dir="ltr">
										{matchingOrder?.orderNumber || orderId}
									</span>
								</div>

								{matchingOrder?.customerName && (
									<div className="flex items-center justify-between">
										<span className="text-stone-600">{t("orderSuccess.customer")}:</span>
										<span className="font-semibold text-stone-900">
											{matchingOrder.customerName}
										</span>
									</div>
								)}

								{matchingOrder?.customerEmirate && (
									<div className="flex items-center justify-between">
										<span className="text-stone-600">{t("orderSuccess.emirate")}:</span>
										<span className="font-semibold text-stone-900">
											{matchingOrder.customerEmirate} - {matchingOrder.customerAddress}
										</span>
									</div>
								)}

								{matchingOrder?.total && (
									<div className="flex items-center justify-between pt-1 border-t border-[#D6BE9F]/40 font-bold">
										<span className="text-stone-800">{t("cart.total")}:</span>
										<span className="text-[#8B5A2B] tabular-nums">
											{matchingOrder.total} {t("products.currency")}
										</span>
									</div>
								)}

								<div className="flex items-center justify-between">
									<span className="text-stone-600">{t("cart.paymentMethod")}:</span>
									<span className="font-semibold text-stone-900 flex items-center gap-1.5">
										<CreditCard className="w-3.5 h-3.5 text-amber-800" />
										<span>
											{result?.intent?.card_details?.card_brand || t("cart.payZiina")}
										</span>
									</span>
								</div>
							</div>

							{/* Delivery Steps Notice */}
							<div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-950 flex items-start gap-2.5">
								<Truck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
								<p className="leading-relaxed">
									{t("hero.pillColdTransport")}
								</p>
							</div>

							{/* Action Buttons */}
							<div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
								<Link
									to="/"
									className="flex-1 py-3 px-4 bg-[#2C2014] hover:bg-black text-amber-200 text-xs font-bold rounded-xl transition-colors text-center shadow flex items-center justify-center gap-1.5"
								>
									<ShoppingBag className="w-4 h-4" />
									<span>{t("orderSuccess.continueShopping")}</span>
								</Link>
								<a
									href="https://wa.me/971504020220"
									target="_blank"
									rel="noreferrer"
									className="py-3 px-4 border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
								>
									<MessageSquare className="w-4 h-4 text-emerald-600" />
									<span>{t("announcement.orderViaWhatsapp")}</span>
								</a>
							</div>
						</div>
					) : (
						/* Failure / Cancellation Screen */
						<div className="space-y-6">
							<div className="text-center space-y-2">
								<div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-sm">
									{isCancelled ? (
										<AlertTriangle className="w-9 h-9 text-amber-600" />
									) : (
										<XCircle className="w-9 h-9 text-rose-600" />
									)}
								</div>
								<h2 className="font-serif text-2xl font-bold text-[#2C2014]">
									{t("paymentCallback.failedTitle")}
								</h2>
								<p className="text-xs text-stone-500">
									{t("paymentCallback.failedDesc")}
								</p>
							</div>

							<div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
								<Link
									to="/"
									className="flex-1 py-3 px-4 bg-[#2C2014] hover:bg-black text-amber-200 text-xs font-bold rounded-xl transition-colors text-center shadow"
								>
									{t("paymentCallback.returnToStore")}
								</Link>
								<a
									href="tel:+971504020220"
									className="py-3 px-4 border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
								>
									<Phone className="w-4 h-4 text-stone-600" />
									<span>{t("nav.callUs")}</span>
								</a>
							</div>
						</div>
					)}
				</div>
			</main>

			{/* Footer */}
			<footer className="py-4 text-center text-xs text-stone-400 border-t border-[#E8DCCB] bg-[#F5EFE6]/50">
				<p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
			</footer>
		</div>
	);
};
