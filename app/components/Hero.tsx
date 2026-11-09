import React from "react";
import { useStore } from "../context/StoreContext";
import { ArrowLeft } from "lucide-react";
import { t } from "../frontend/locales/i18n";

export const Hero: React.FC = () => {
	const { setActiveCategory } = useStore();

	const handleScrollToCatalog = (cat?: "rutab" | "fig" | "faqa" | "dates" | "nuts") => {
		if (cat) setActiveCategory(cat as any);
		const el = document.getElementById("catalog-section");
		if (el) el.scrollIntoView({ behavior: "smooth" });
	};

	return (
		<section className="heritage-hero relative overflow-hidden bg-[#FAF7F2] border-b border-[#E8DCCB]">
			<div className="heritage-hero-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
				{/* Main Split Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
					{/* Text Column */}
					<div className="heritage-hero-copy lg:col-span-6 flex flex-col justify-center space-y-6 text-right">
						<div className="hero-kicker flex items-center gap-2 text-xs font-semibold text-[#8B5A2B]">
							<span className="w-2.5 h-2.5 rounded-full bg-[#DE2A2D] animate-pulse"></span>
							<span className="text-[#DE2A2D] font-bold">{t("hero.badge")}</span>
							<span aria-hidden="true">·</span>
							<span>{t("hero.pillSameDay")}</span>
						</div>

						<h1 className="hero-title font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-[#2C2014] leading-[1.25] tracking-tight">
							{t("hero.titleLine1")} <br />
							<span className="text-[#DE2A2D]">{t("hero.titleLine2")}</span>
						</h1>

						<p className="hero-description text-base sm:text-lg text-stone-600 leading-relaxed max-w-xl">
							{t("hero.subtitle")}
						</p>

						{/* CTAs */}
						<div className="hero-actions flex flex-wrap items-center gap-3 pt-2">
							<button
								onClick={() => handleScrollToCatalog()}
								className="flex items-center gap-2 px-6 py-3.5 bg-[#2C2014] text-amber-200 text-sm font-semibold rounded-xl hover:bg-[#DE2A2D] hover:text-white transition-all shadow-md active:scale-95"
							>
								<span>{t("hero.ctaShop")}</span>
								<ArrowLeft className="w-4 h-4 text-amber-400" />
							</button>

							<a
								href="https://wa.me/971504020220"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 px-5 py-3.5 bg-emerald-800 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
							>
								<span>{t("announcement.orderViaWhatsapp")}: 0504020220</span>
							</a>
						</div>

						{/* Quick category shortcuts */}
						<div className="hero-copy-shortcuts flex flex-wrap items-center gap-3 pt-4 text-xs text-stone-500 border-t border-[#E8DCCB]/60">
							<span className="font-bold text-stone-800">{t("categories.all")}:</span>
							<button
								onClick={() => handleScrollToCatalog("fig")}
								className="hover:text-[#DE2A2D] font-medium underline underline-offset-4"
							>
								{t("categories.fig")}
							</button>
							<span aria-hidden="true">·</span>
							<button
								onClick={() => handleScrollToCatalog("dates")}
								className="hover:text-[#DE2A2D] font-medium underline underline-offset-4"
							>
								{t("categories.dates")}
							</button>
							<span aria-hidden="true">·</span>
							<button
								onClick={() => handleScrollToCatalog("faqa")}
								className="hover:text-[#DE2A2D] font-medium underline underline-offset-4"
							>
								{t("categories.truffle")}
							</button>
							<span aria-hidden="true">·</span>
							<button
								onClick={() => handleScrollToCatalog("nuts")}
								className="hover:text-[#DE2A2D] font-medium underline underline-offset-4"
							>
								{t("categories.nuts")}
							</button>
						</div>
					</div>

					{/* Image Column */}
					<div className="lg:col-span-6 relative">
						<div className="hero-visual relative rounded-2xl overflow-hidden shadow-2xl border border-[#D6BE9F]/60 aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/3] bg-stone-100">
							<img
								src="/images/redfig.jpg"
								alt={t("brand.name")}
								referrerPolicy="no-referrer"
								className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
