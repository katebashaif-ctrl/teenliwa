import React from "react";
import { useStore } from "../context/StoreContext";
import { ShoppingBag, Phone } from "lucide-react";
import { Logo } from "./Logo";
import { t } from "../frontend/locales/i18n";

export const Header: React.FC = () => {
	const {
		currentView,
		setCurrentView,
		cartItemsCount,
		setIsCartOpen,
		setActiveCategory,
		settings,
	} = useStore();

	const handleCategoryClick = (cat: "rutab" | "fig" | "faqa" | "dates" | "nuts" | "all") => {
		setCurrentView("store");
		setActiveCategory(cat as any);
		const element = document.getElementById("catalog-section");
		if (element) {
			element.scrollIntoView({ behavior: "smooth" });
		}
	};

	const handleStoryClick = () => {
		setCurrentView("store");
		const element = document.getElementById("heritage-section");
		if (element) {
			element.scrollIntoView({ behavior: "smooth" });
		}
	};

	return (
		<header className="sticky top-0 z-40 bg-[#FCFBF8]/95 backdrop-blur-md border-b border-[#E8DCCB] transition-all">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3 sm:gap-6">
				{/* Zone 1: Logo & Brand Name */}
				<button
					onClick={() => {
						setCurrentView("store");
						setActiveCategory("all");
						window.scrollTo({ top: 0, behavior: "smooth" });
					}}
					className="flex min-w-0 items-center gap-2 sm:gap-3 text-right whitespace-nowrap shrink-0 group focus:outline-none"
					aria-label={t("nav.homeAria")}
				>
					<Logo variant="header" />
				</button>

				{/* Zone 2: Concise navigation links */}
				<nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-stone-700">
					<button
						onClick={() => handleCategoryClick("all")}
						className="hover:text-[#DE2A2D] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-8"
					>
						{t("nav.allProducts")}
					</button>
					<button
						onClick={() => handleCategoryClick("fig")}
						className="hover:text-[#DE2A2D] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-8"
					>
						{t("nav.freshFigs")}
					</button>
					<button
						onClick={() => handleCategoryClick("dates")}
						className="hover:text-[#DE2A2D] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-8"
					>
						{t("nav.dates")}
					</button>
					<button
						onClick={() => handleCategoryClick("faqa")}
						className="hover:text-[#DE2A2D] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-8"
					>
						{t("nav.desertTruffles")}
					</button>
					<button
						onClick={() => handleCategoryClick("nuts")}
						className="hover:text-[#DE2A2D] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-8"
					>
						{t("nav.freshFruits")}
					</button>
					<button
						onClick={handleStoryClick}
						className="hover:text-[#DE2A2D] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-8"
					>
						{t("nav.ourStory")}
					</button>
				</nav>

				{/* Zone 3: Direct WhatsApp / Call & Cart */}
				<div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
					<a
						href={`https://wa.me/${(settings.whatsappNumber || "971504020220").replace(/[^0-9]/g, "")}`}
						target="_blank"
						rel="noopener noreferrer"
						className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-lg hover:bg-emerald-100 transition-colors"
						title={t("nav.whatsappDirect")}
					>
						<Phone className="w-3.5 h-3.5 text-emerald-600" />
						<span dir="ltr">0504020220</span>
					</a>

					{/* Cart Button */}
					{currentView === "store" && (
						<button
							onClick={() => setIsCartOpen(true)}
							aria-label={`${t("cart.title")}, ${cartItemsCount}`}
							className="relative flex items-center gap-2 px-3.5 py-2 bg-[#2C2014] text-amber-100 rounded-lg hover:bg-black transition-colors"
						>
							<ShoppingBag className="w-4 h-4 text-amber-300" />
							<span className="text-xs font-semibold hidden sm:inline">{t("nav.cart")}</span>
							{cartItemsCount > 0 && (
								<span className="w-5 h-5 rounded-full bg-amber-500 text-[#2C2014] text-[11px] font-bold flex items-center justify-center tabular-nums">
									{cartItemsCount}
								</span>
							)}
						</button>
					)}
				</div>
			</div>

			<div className="lg:hidden border-t border-[#E8DCCB] bg-[#FCFBF8]/95 mobile-scroll-x">
				<nav className="max-w-7xl mx-auto flex min-w-max items-center gap-1 px-3 py-2 text-xs font-semibold text-stone-700" aria-label="التصنيفات">
					{([
						["all", t("nav.allProducts")],
						["fig", t("nav.freshFigs")],
						["dates", t("nav.dates")],
						["faqa", t("nav.desertTruffles")],
						["nuts", t("nav.freshFruits")],
					] as const).map(([id, label]) => (
						<button key={id} onClick={() => handleCategoryClick(id)} className="rounded-full px-3 py-1.5 whitespace-nowrap hover:bg-[#F5EFE6] hover:text-[#DE2A2D] transition-colors">
							{label}
						</button>
					))}
					<button onClick={handleStoryClick} className="rounded-full px-3 py-1.5 whitespace-nowrap hover:bg-[#F5EFE6] hover:text-[#DE2A2D] transition-colors">
						{t("nav.ourStory")}
					</button>
				</nav>
			</div>
		</header>
	);
};
