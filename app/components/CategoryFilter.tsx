import React from "react";
import { useStore } from "../context/StoreContext";
import type { ProductCategory } from "../types/store";
import { t } from "../frontend/locales/i18n";

export const CategoryFilter: React.FC = () => {
	const { activeCategory, setActiveCategory, products } = useStore();

	const categories: { id: ProductCategory | "all"; labelKey: string; count: number }[] = [
		{ id: "all", labelKey: "categories.all", count: products.length },
		{
			id: "fig",
			labelKey: "categories.fig",
			count: products.filter((p) => p.category === "fig" || p.tag === "fig").length,
		},
		{
			id: "dates",
			labelKey: "categories.dates",
			count: products.filter(
				(p) =>
					p.category === "dates" ||
					p.category === "rutab" ||
					p.tag === "dates",
			).length,
		},
		{
			id: "faqa",
			labelKey: "categories.truffle",
			count: products.filter(
				(p) => p.category === "faqa" || p.category === "truffle" || p.tag === "truffle",
			).length,
		},
		{
			id: "nuts",
			labelKey: "categories.nuts",
			count: products.filter((p) => p.category === "nuts" || p.tag === "nuts").length,
		},
		{
			id: "fruits",
			labelKey: "categories.fruits",
			count: products.filter((p) => p.category === "fruits" || p.tag === "fruits").length,
		},
	];

	return (
		<div className="category-filter-panel space-y-4 mb-8" id="catalog-section">
			{/* Top bar with heading and counts */}
			<div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
				<div>
					<h2 className="font-serif text-2xl font-black text-[#2C2014] flex items-center gap-2">
						<span>{t("products.sectionTitle")}</span>
						<span className="text-xs px-2 py-0.5 rounded-md bg-[#DE2A2D]/10 text-[#DE2A2D] font-bold">
							{t("products.freshCut")}
						</span>
					</h2>
					<p className="text-xs text-stone-500 mt-1">
						{t("products.sectionSubtitle")}
					</p>
				</div>
			</div>

			{/* Segmented Category Buttons */}
			<div className="category-filter-tabs flex items-center gap-1.5 p-1 bg-[#F5EFE6] rounded-xl overflow-x-auto scrollbar-none border border-[#E8DCCB]">
				{categories.map((cat) => {
					const isActive = activeCategory === cat.id;
					return (
						<button
							key={cat.id}
							onClick={() => setActiveCategory(cat.id)}
							className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
								isActive
									? "bg-[#2C2014] text-amber-200 shadow-sm"
									: "text-[#574127] hover:text-[#2C2014] hover:bg-white/60"
							}`}
						>
							<span>{t(cat.labelKey)}</span>
							<span
								className={`text-[11px] px-1.5 py-0.2 rounded font-medium tabular-nums ${
									isActive
										? "bg-amber-500/20 text-amber-300"
										: "bg-stone-200/60 text-stone-600"
								}`}
							>
								{cat.count}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
};
