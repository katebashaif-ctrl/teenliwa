import React from "react";
import type { Product } from "../types/store";
import { useStore } from "../context/StoreContext";
import { Plus, Eye, MapPin, CheckCircle, Clock } from "lucide-react";
import { t, formatImagePath } from "../frontend/locales/i18n";

interface ProductCardProps {
	product: Product;
	onOpenDetail: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
	product,
	onOpenDetail,
}) => {
	const { addToCart } = useStore();

	const isDisabled =
		product.disabled === 1 ||
		!product.inStock ||
		(product.stockQuantity !== undefined && product.stockQuantity <= 0);

	const buttonText = isDisabled
		? product.disabledTxt && product.disabledTxt !== t("products.available")
			? product.disabledTxt
			: t("products.comingSoon")
		: t("products.addToCart");

	const imageSrc = formatImagePath(product.image);

	const handleQuickAdd = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isDisabled) return;
		addToCart(product, product.minQty || 1);
	};

	return (
		<article
			onClick={() => onOpenDetail(product)}
			className={`store-product-card group flex flex-col bg-white rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer relative ${
				isDisabled
					? "border-[#E8DCCB] opacity-95 hover:border-stone-400"
					: "border-[#E8DCCB] hover:border-[#DE2A2D]/50 hover:shadow-xl hover:-translate-y-0.5"
			}`}
		>
			{/* Image container */}
			<div className="store-product-media relative aspect-square w-full overflow-hidden bg-gradient-to-b from-[#FAF7F2] to-[#F5EFE6] flex items-center justify-center p-3">
				<img
					src={imageSrc}
					alt={product.name}
					referrerPolicy="no-referrer"
					className={`w-full h-full object-contain transition-transform duration-500 ${
						isDisabled ? "grayscale-[15%] group-hover:scale-102" : "group-hover:scale-105 drop-shadow-sm"
					}`}
				/>

				{/* Availability Tag Top-Right */}
				<div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
					{!isDisabled ? (
						<span className="bg-emerald-700/90 backdrop-blur-sm text-emerald-100 text-[10px] font-bold px-2.5 py-1 rounded-md border border-emerald-500/30 flex items-center gap-1 shadow-sm">
							<CheckCircle className="w-3 h-3 text-emerald-300" />
							<span>
								{product.disabledTxt && product.disabledTxt !== t("products.comingSoon")
									? product.disabledTxt
									: t("products.available")}
							</span>
						</span>
					) : (
						<span className="bg-amber-900/90 backdrop-blur-sm text-amber-200 text-[10px] font-bold px-2.5 py-1 rounded-md border border-amber-600/30 flex items-center gap-1 shadow-sm">
							<Clock className="w-3 h-3 text-amber-300" />
							<span>
								{product.disabledTxt && product.disabledTxt !== t("products.available")
									? product.disabledTxt
									: t("products.comingSoon")}
							</span>
						</span>
					)}
				</div>

				{/* Min quantity indicator if > 1 */}
				{product.minQty && product.minQty > 1 && (
					<div className="absolute top-3 left-3 bg-[#2C2014]/85 backdrop-blur-sm text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
						{t("products.minQuantity", { qty: product.minQty })}
					</div>
				)}

				{/* Hover overlay button to preview */}
				<div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
					<span className="px-3.5 py-1.5 bg-white/95 text-stone-900 text-xs font-semibold rounded-lg shadow-md flex items-center gap-1.5">
						<Eye className="w-3.5 h-3.5 text-[#DE2A2D]" />
						<span>{t("products.viewDetails")}</span>
					</span>
				</div>
			</div>

			{/* Card Content */}
			<div className="store-product-content p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3 text-right">
				<div>
					{/* Origin & Unit */}
					<div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
						<span className="flex items-center gap-1 text-[11px] text-[#8B5A2B] font-medium">
							<MapPin className="w-3 h-3 shrink-0 text-[#DE2A2D]" />
							<span className="truncate max-w-[150px]">{product.origin || t("brand.tagline")}</span>
						</span>
						<span className="text-[11px] text-stone-400">{product.unit || t("products.freshCut")}</span>
					</div>

					{/* Title */}
					<h3 className="font-semibold text-stone-900 text-base leading-snug group-hover:text-[#DE2A2D] transition-colors line-clamp-1">
						{product.name}
					</h3>

					{/* Short description */}
					<p className="text-xs text-stone-500 line-clamp-2 mt-1 leading-relaxed">
						{product.desc || product.description}
					</p>
				</div>

				{/* Price and Action Baseline */}
				<div className="pt-3 border-t border-[#F5EFE6] flex items-center justify-between gap-3">
					<div className="flex flex-col">
						<div className="flex items-baseline gap-1">
							<span className="font-serif text-2xl font-bold text-[#2C2014] tabular-nums">
								{product.price}
							</span>
							<span className="text-xs font-semibold text-[#8B5A2B]">{t("products.currency")}</span>
							{product.originalPrice && (
								<span className="text-xs text-stone-400 line-through tabular-nums mr-1">
									{product.originalPrice}
								</span>
							)}
						</div>
					</div>

					{/* Add to Cart or Status Button */}
					<button
						onClick={handleQuickAdd}
						disabled={isDisabled}
						className={`store-product-add flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
							!isDisabled
								? "bg-[#2C2014] text-amber-200 hover:bg-[#DE2A2D] hover:text-white shadow-sm active:scale-95"
								: "bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed"
						}`}
						title={isDisabled ? t("products.comingSoon") : t("products.addToCart")}
					>
						{!isDisabled && <Plus className="w-3.5 h-3.5" />}
						<span>{buttonText}</span>
					</button>
				</div>
			</div>
		</article>
	);
};
