import React, { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { StoreLayout } from "../layout/StoreLayout";
import { Hero } from "../../components/Hero";
import { CategoryFilter } from "../../components/CategoryFilter";
import { ProductCard } from "../../components/ProductCard";
import { EmiratiHeritageSection } from "../../components/EmiratiHeritageSection";
import { ProductDetailModal } from "../../components/ProductDetailModal";
import { CMSView } from "./CMSView";
import { t } from "../locales/i18n";
import type { Product } from "../../types/store";

export const HomeView: React.FC = () => {
	const {
		currentView,
		activeCategory,
		searchQuery,
		selectedProduct,
		setSelectedProduct,
	} = useStore();
	const [serverProducts, setServerProducts] = useState<Product[] | null>(null);
	const [isCatalogLoading, setIsCatalogLoading] = useState(true);

	useEffect(() => {
		if (currentView !== "store") return;

		let cancelled = false;
		setIsCatalogLoading(true);
		const loadCatalog = async () => {
			try {
				// Always render the server catalog, never a possibly stale browser/R2 copy.
				const response = await fetch(`/api/products?_=${Date.now()}`, {
					cache: "no-store",
					headers: { "Cache-Control": "no-cache" },
				});
				if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
				const result = (await response.json()) as {
					success?: boolean;
					products?: Product[];
				};
				if (!result.success || !Array.isArray(result.products)) {
					throw new Error("Server returned an invalid product catalog");
				}
				if (!cancelled) setServerProducts(result.products);
			} catch (error) {
				console.warn("Could not load the canonical product catalog:", error);
				if (!cancelled) setServerProducts([]);
			} finally {
				if (!cancelled) setIsCatalogLoading(false);
			}
		};

		void loadCatalog();
		return () => {
			cancelled = true;
		};
	}, [currentView]);

	if (currentView === "cms") {
		return <CMSView />;
	}

	const catalogProducts = serverProducts ?? [];
	const filteredProducts = catalogProducts.filter((p) => {
		let matchesCategory = activeCategory === "all";
		if (!matchesCategory) {
			if (activeCategory === "fig") {
				matchesCategory = p.category === "fig" || p.tag === "fig";
			} else if (activeCategory === "dates" || activeCategory === "rutab") {
				matchesCategory =
					p.category === "dates" ||
					p.category === "rutab" ||
					p.tag === "dates";
			} else if (activeCategory === "faqa" || activeCategory === "truffle") {
				matchesCategory =
					p.category === "faqa" ||
					p.category === "truffle" ||
					p.tag === "truffle";
			} else if (activeCategory === "nuts") {
				matchesCategory = p.category === "nuts" || p.tag === "nuts";
			} else if (activeCategory === "fruits") {
				matchesCategory = p.category === "fruits" || p.tag === "fruits";
			} else {
				matchesCategory = p.category === activeCategory;
			}
		}

		const query = searchQuery.toLowerCase();
		const matchesSearch =
			!query ||
			p.name.toLowerCase().includes(query) ||
			(p.nameEn && p.nameEn.toLowerCase().includes(query)) ||
			(p.origin && p.origin.toLowerCase().includes(query)) ||
			(p.desc && p.desc.toLowerCase().includes(query)) ||
			(p.description && p.description.toLowerCase().includes(query));

		return matchesCategory && matchesSearch;
	});

	return (
		<StoreLayout>
			<Hero />
			<section
				id="catalog-section"
				className="store-catalog-section py-12 lg:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
			>
				<CategoryFilter />
				{isCatalogLoading ? (
					<div className="py-16 text-center text-stone-500" role="status" aria-live="polite">
						جاري تحميل المنتجات…
					</div>
				) : filteredProducts.length === 0 ? (
					<div className="py-16 text-center bg-white rounded-2xl border border-[#E8DCCB] p-8 space-y-3">
						<p className="font-serif text-xl font-bold text-stone-800">
							{t("products.emptySearchTitle")}
						</p>
						<p className="text-xs text-stone-500">
							{t("products.emptySearchDesc")}
						</p>
					</div>
				) : (
					<div className="store-product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
						{filteredProducts.map((product) => (
							<ProductCard
								key={product.id}
								product={product}
								onOpenDetail={(prod) => setSelectedProduct(prod)}
							/>
						))}
					</div>
				)}
			</section>
			<EmiratiHeritageSection />
			<ProductDetailModal
				product={selectedProduct}
				onClose={() => setSelectedProduct(null)}
			/>
		</StoreLayout>
	);
};
