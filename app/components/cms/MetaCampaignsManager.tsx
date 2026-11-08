import { cmsT, cmsFormat } from "../../frontend/locales/cmsI18n";
import React, { useState, useEffect } from "react";
import { useStore } from "../../context/StoreContext";
import type { MetaCampaign, MetaCampaignObjective, ProductCategory } from "../../types/store";
import {
	Share2,
	Plus,
	ExternalLink,
	Play,
	Pause,
	Trash2,
	Sparkles,
	Target,
	DollarSign,
	Eye,
	MousePointerClick,
	Users,
	ShoppingBag,
	CheckCircle2,
	AlertCircle,
	X,
	Settings,
	Layers,
	FileText,
	RefreshCw,
} from "lucide-react";

export const MetaCampaignsManager: React.FC = () => {
	const {
		metaCampaigns,
		addMetaCampaign,
		toggleCampaignStatus,
		updateCampaignBudget,
		deleteCampaign,
		metaConfig,
		updateMetaConfig,
		products,
		showToast,
	} = useStore();

	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
	const [isGeneratingAi, setIsGeneratingAi] = useState(false);
	const [aiVariants, setAiVariants] = useState<any[]>([]);

	// Campaign Form State
	const [name, setName] = useState("");
	const [objective, setObjective] = useState<MetaCampaignObjective>("OUTCOME_SALES");
	const [dailyBudget, setDailyBudget] = useState<number>(150);
	const [productCategory, setProductCategory] = useState<ProductCategory | "all">("rutab");
	const [selectedEmirates, setSelectedEmirates] = useState<string[]>([
		cmsT("cms_1"),
		cmsT("cms_2"),
		cmsT("cms_3"),
		cmsT("cms_4"),
	]);
	const [headline, setHeadline] = useState(cmsT("cms_5"));
	const [primaryText, setPrimaryText] = useState(
		cmsT("cms_6"),
	);
	const [callToAction, setCallToAction] = useState<
		"SHOP_NOW" | "ORDER_NOW" | "GET_QUOTE" | "WHATSAPP_MESSAGE"
	>("SHOP_NOW");
	const [imageUrl, setImageUrl] = useState("/images/product_emirati_rutab_1792506810615.jpg");

	// Config Form State
	const [configForm, setConfigForm] = useState(metaConfig);

	useEffect(() => {
		setConfigForm(metaConfig);
	}, [metaConfig]);

	const emiratesList = [
		cmsT("cms_1"),
		cmsT("cms_2"),
		cmsT("cms_3"),
		cmsT("cms_4"),
		cmsT("cms_7"),
		cmsT("cms_8"),
		cmsT("cms_9"),
		cmsT("cms_10"),
	];

	// Summary KPI calculations
	const totalSpent = metaCampaigns.reduce((sum, c) => sum + (c.spentAED || 0), 0);
	const totalImpressions = metaCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
	const totalClicks = metaCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
	const totalLeads = metaCampaigns.reduce((sum, c) => sum + (c.leadsCount || 0), 0);
	const totalConversions = metaCampaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
	const avgCtr =
		totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

	// Generate AI Ad Copy
	const handleGenerateAiCopy = async () => {
		setIsGeneratingAi(true);
		try {
			const res = await fetch("/api/ai/marketing", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "generate_ad_copy",
					productCategory,
					objective,
					season: cmsT("cms_11"),
				}),
			});
			const data = (await res.json()) as any;
			if (data.success && data.data?.variants) {
				setAiVariants(data.data.variants);
				showToast(cmsT("cms_12"), cmsT("cms_13"));
			}
		} catch (e) {
			showToast(cmsT("cms_14"), cmsT("cms_15"), "warning");
		} finally {
			setIsGeneratingAi(false);
		}
	};

	const applyAiVariant = (variant: any) => {
		if (variant.headline) setHeadline(variant.headline);
		if (variant.primaryText) setPrimaryText(variant.primaryText);
		if (variant.callToAction) setCallToAction(variant.callToAction);
		if (variant.targetEmirates) setSelectedEmirates(variant.targetEmirates);
		showToast(cmsT("cms_16"), cmsT("cms_17"));
	};

	const handleCreateCampaign = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		// Local and server dispatch
		addMetaCampaign({
			name,
			objective,
			status: "ACTIVE",
			dailyBudget: Number(dailyBudget),
			targetEmirates: selectedEmirates,
			targetInterests: [cmsT("cms_18"), cmsT("cms_19"), cmsT("cms_20")],
			productCategory,
			headline,
			primaryText,
			callToAction,
			imageUrl,
			leadFormName:
				objective === "OUTCOME_LEADS" ? cmsFormat("cms_21", [name]) : undefined,
		});


		setIsCreateModalOpen(false);
		setName("");
		setAiVariants([]);
	};

	const toggleEmirate = (em: string) => {
		if (selectedEmirates.includes(em)) {
			setSelectedEmirates(selectedEmirates.filter((e) => e !== em));
		} else {
			setSelectedEmirates([...selectedEmirates, em]);
		}
	};

	return (
		<div className="space-y-6 text-right">
			{/* Meta Marketing API Banner */}
			<div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-900 text-white p-6 rounded-2xl border border-blue-500/30 shadow-xl space-y-4">
				<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center shrink-0">
							<Share2 className="w-6 h-6 text-blue-300" />
						</div>
						<div>
							<div className="flex items-center gap-2 flex-wrap">
								<h2 className="font-serif text-xl font-bold text-white">
									
									{cmsT("cms_22")}
								</h2>
								<span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
									<CheckCircle2 className="w-3 h-3 text-emerald-400" />
									<span>Graph API {metaConfig.apiVersion}  {cmsT("cms_23")}</span>
								</span>
							</div>
							<p className="text-xs text-blue-200/90 pt-1">
								
								{cmsT("cms_24")}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2 self-end md:self-center">
						<a
							href="https://developers.facebook.com/documentation/ads-commerce/marketing-api"
							target="_blank"
							rel="noreferrer"
							className="px-3.5 py-2 bg-blue-800/80 hover:bg-blue-700 text-blue-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-blue-600/50"
						>
							<span>{cmsT("cms_25")}</span>
							<ExternalLink className="w-3.5 h-3.5 text-blue-300" />
						</a>

						<button
							onClick={() => setIsConfigModalOpen(true)}
							className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border border-white/20"
							title={cmsT("cms_26")}
						>
							<Settings className="w-4 h-4 text-blue-200" />
						</button>

						<button
							onClick={() => setIsCreateModalOpen(true)}
							className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-900 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
						>
							<Plus className="w-4 h-4 text-stone-900" />
							<span>{cmsT("cms_27")}</span>
						</button>
					</div>
				</div>

				{/* Quick Meta Credentials Strip */}
				<div className="pt-3 border-t border-blue-800/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
					<div className="bg-black/20 p-2.5 rounded-xl border border-blue-800/40">
						<span className="text-[10px] text-blue-300 block">Ad Account ID</span>
						<span className="font-mono font-bold text-white text-[11px]" dir="ltr">
							{metaConfig.adAccountId}
						</span>
					</div>
					<div className="bg-black/20 p-2.5 rounded-xl border border-blue-800/40">
						<span className="text-[10px] text-blue-300 block">{cmsT("cms_28")}</span>
						<span className="font-mono font-bold text-white text-[11px]" dir="ltr">
							{metaConfig.pixelId}
						</span>
					</div>
					<div className="bg-black/20 p-2.5 rounded-xl border border-blue-800/40">
						<span className="text-[10px] text-blue-300 block">Commerce Catalog ID</span>
						<span className="font-mono font-bold text-white text-[11px]" dir="ltr">
							{metaConfig.catalogId}
						</span>
					</div>
					<div className="bg-black/20 p-2.5 rounded-xl border border-blue-800/40">
						<span className="text-[10px] text-blue-300 block">{cmsT("cms_29")}</span>
						<span className="font-bold text-emerald-300 text-[11px] flex items-center gap-1">
							<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
							<span>{cmsT("cms_30")}</span>
						</span>
					</div>
				</div>
			</div>

			{/* KPI Metric Cards */}
			<div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
				<div className="bg-white p-4 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-1">
					<div className="flex items-center justify-between text-stone-500 text-xs">
						<span>{cmsT("cms_31")}</span>
						<DollarSign className="w-4 h-4 text-amber-700" />
					</div>
					<div className="flex items-baseline gap-1">
						<span className="font-serif text-2xl font-bold text-[#2C2014] tabular-nums">
							{totalSpent.toLocaleString()}
						</span>
						<span className="text-xs font-bold text-amber-800">{cmsT("cms_32")}</span>
					</div>
					<p className="text-[10px] text-stone-400">{cmsT("cms_33")}</p>
				</div>

				<div className="bg-white p-4 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-1">
					<div className="flex items-center justify-between text-stone-500 text-xs">
						<span>{cmsT("cms_34")}</span>
						<Eye className="w-4 h-4 text-blue-700" />
					</div>
					<div className="font-serif text-2xl font-bold text-[#2C2014] tabular-nums">
						{totalImpressions.toLocaleString()}
					</div>
					<p className="text-[10px] text-emerald-600 font-semibold">{cmsT("cms_35")}</p>
				</div>

				<div className="bg-white p-4 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-1">
					<div className="flex items-center justify-between text-stone-500 text-xs">
						<span>{cmsT("cms_36")}</span>
						<MousePointerClick className="w-4 h-4 text-indigo-700" />
					</div>
					<div className="flex items-baseline gap-2">
						<span className="font-serif text-2xl font-bold text-[#2C2014] tabular-nums">
							{totalClicks.toLocaleString()}
						</span>
						<span className="text-xs font-bold text-emerald-700">({avgCtr}%)</span>
					</div>
					<p className="text-[10px] text-stone-400">{cmsT("cms_37")}</p>
				</div>

				<div className="bg-white p-4 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-1">
					<div className="flex items-center justify-between text-stone-500 text-xs">
						<span>{cmsT("cms_38")}</span>
						<Users className="w-4 h-4 text-emerald-700" />
					</div>
					<div className="font-serif text-2xl font-bold text-[#2C2014] tabular-nums">
						{totalLeads}
					</div>
					<p className="text-[10px] text-emerald-700 font-semibold">{cmsT("cms_39")}</p>
				</div>

				<div className="bg-white p-4 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-1">
					<div className="flex items-center justify-between text-stone-500 text-xs">
						<span>{cmsT("cms_40")}</span>
						<ShoppingBag className="w-4 h-4 text-amber-700" />
					</div>
					<div className="font-serif text-2xl font-bold text-[#2C2014] tabular-nums">
						{totalConversions}
					</div>
					<p className="text-[10px] text-stone-400">{cmsT("cms_41")}</p>
				</div>
			</div>

			{/* Campaigns List */}
			<div className="bg-white p-6 rounded-2xl border border-[#E8DCCB] shadow-sm space-y-5">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-serif text-lg font-bold text-[#2C2014]">
							
							{cmsT("cms_42")}{metaCampaigns.length})
						</h3>
						<p className="text-xs text-stone-500">
							
							{cmsT("cms_43")}
						</p>
					</div>

					<button
						onClick={() => setIsCreateModalOpen(true)}
						className="px-3.5 py-1.5 bg-[#2C2014] text-amber-200 text-xs font-bold rounded-xl hover:bg-black transition-colors flex items-center gap-1.5"
					>
						<Plus className="w-3.5 h-3.5" />
						<span>{cmsT("cms_44")}</span>
					</button>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-right text-xs">
						<thead className="bg-[#FAF7F2] border-b border-stone-200 text-stone-600">
							<tr>
								<th className="py-3 px-3 font-semibold">{cmsT("cms_45")}</th>
								<th className="py-3 px-3 font-semibold">{cmsT("cms_46")}</th>
								<th className="py-3 px-3 font-semibold">{cmsT("cms_47")}</th>
								<th className="py-3 px-3 font-semibold">{cmsT("cms_48")}</th>
								<th className="py-3 px-3 font-semibold">{cmsT("cms_49")}</th>
								<th className="py-3 px-3 font-semibold">{cmsT("cms_50")}</th>
								<th className="py-3 px-3 font-semibold">{cmsT("cms_51")}</th>
								<th className="py-3 px-3 font-semibold text-center">{cmsT("cms_52")}</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-stone-100">
							{metaCampaigns.map((camp) => (
								<tr key={camp.id} className="hover:bg-stone-50/60">
									<td className="py-3.5 px-3">
										<div className="flex items-center gap-2.5">
											<img
												src={camp.imageUrl}
												alt={camp.name}
												className="w-10 h-10 rounded-lg object-cover border border-stone-200 shrink-0"
											/>
											<div>
												<p className="font-bold text-stone-900">{camp.name}</p>
												<span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-mono inline-block mt-0.5">
													{camp.objective}
												</span>
											</div>
										</div>
									</td>
									<td className="py-3.5 px-3">
										<span
											className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
												camp.status === "ACTIVE"
													? "bg-emerald-100 text-emerald-800 border border-emerald-300"
													: "bg-stone-100 text-stone-600 border border-stone-300"
											}`}
										>
											<span
												className={`w-1.5 h-1.5 rounded-full ${
													camp.status === "ACTIVE" ? "bg-emerald-600" : "bg-stone-400"
												}`}
											></span>
											<span>{camp.status === "ACTIVE" ? cmsT("cms_53") : cmsT("cms_54")}</span>
										</span>
									</td>
									<td className="py-3.5 px-3 font-bold text-amber-900 tabular-nums">
										<div className="flex items-center gap-1">
											<span>{camp.dailyBudget}  {cmsT("cms_55")}</span>
											<button
												onClick={() => {
													const newBudget = prompt(
														cmsT("cms_56"),
														camp.dailyBudget.toString(),
													);
													if (newBudget && !isNaN(Number(newBudget))) {
														updateCampaignBudget(camp.id, Number(newBudget));
													}
												}}
												className="text-stone-400 hover:text-stone-700 text-[10px] underline"
												title={cmsT("cms_57")}
											>
												
												{cmsT("cms_58")}
											</button>
										</div>
									</td>
									<td className="py-3.5 px-3 font-semibold tabular-nums text-stone-700">
										{camp.spentAED}  {cmsT("cms_55")}
									</td>
									<td className="py-3.5 px-3 tabular-nums">
										<span className="font-semibold text-stone-800">
											{camp.impressions.toLocaleString()}
										</span>
										<span className="text-[10px] text-stone-400 block">
											{camp.clicks.toLocaleString()}  {cmsT("cms_59")}
										</span>
									</td>
									<td className="py-3.5 px-3">
										<span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px] tabular-nums">
											{camp.leadsCount}  {cmsT("cms_60")}
										</span>
									</td>
									<td className="py-3.5 px-3 text-stone-600 text-[11px]">
										<div className="flex flex-wrap gap-1 max-w-[150px]">
											{camp.targetEmirates.slice(0, 3).map((e) => (
												<span key={e} className="bg-stone-100 px-1.5 py-0.2 rounded text-[10px]">
													{e}
												</span>
											))}
											{camp.targetEmirates.length > 3 && (
												<span className="text-[10px] text-stone-400">
													+{camp.targetEmirates.length - 3}
												</span>
											)}
										</div>
									</td>
									<td className="py-3.5 px-3 text-center">
										<div className="flex items-center justify-center gap-1.5">
											<button
												onClick={() => toggleCampaignStatus(camp.id)}
												className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
													camp.status === "ACTIVE"
														? "bg-amber-100 text-amber-800 hover:bg-amber-200"
														: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
												}`}
												title={camp.status === "ACTIVE" ? cmsT("cms_61") : cmsT("cms_62")}
											>
												{camp.status === "ACTIVE" ? (
													<Pause className="w-3.5 h-3.5" />
												) : (
													<Play className="w-3.5 h-3.5" />
												)}
											</button>

											<button
												onClick={() => {
													deleteCampaign(camp.id);
													showToast(cmsT("cms_63"), cmsFormat("cms_64", [camp.name]), "info");
												}}
												className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
												title={cmsT("cms_65")}
											>
												<Trash2 className="w-3.5 h-3.5" />
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* MODAL: CREATE META CAMPAIGN WITH AI COPYWRITER */}
			{isCreateModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
					<div
						className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#D6BE9F] max-h-[90vh] flex flex-col"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="p-5 bg-[#FAF7F2] border-b border-[#E8DCCB] flex items-center justify-between">
							<div className="flex items-center gap-2.5">
								<div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-700 flex items-center justify-center">
									<Share2 className="w-4 h-4 text-blue-700" />
								</div>
								<div>
									<h3 className="font-serif text-lg font-bold text-[#2C2014]">
										
										{cmsT("cms_66")}
									</h3>
									<p className="text-[11px] text-stone-500">
										
										{cmsT("cms_67")}
									</p>
								</div>
							</div>

							<button
								onClick={() => setIsCreateModalOpen(false)}
								className="p-1.5 text-stone-400 hover:text-black rounded-lg"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						{/* Form Content */}
						<form onSubmit={handleCreateCampaign} className="p-6 overflow-y-auto space-y-5 text-xs">
							{/* AI Helper Banner */}
							<div className="bg-gradient-to-r from-amber-50 to-amber-100/60 p-4 rounded-xl border border-amber-300/80 space-y-2">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Sparkles className="w-4 h-4 text-amber-700" />
										<span className="font-bold text-amber-900">
											
											{cmsT("cms_68")}
										</span>
									</div>
									<button
										type="button"
										onClick={handleGenerateAiCopy}
										disabled={isGeneratingAi}
										className="px-3 py-1.5 bg-[#2C2014] text-amber-200 text-xs font-bold rounded-lg hover:bg-black transition-colors flex items-center gap-1.5 disabled:opacity-50"
									>
										{isGeneratingAi ? (
											<>
												<RefreshCw className="w-3.5 h-3.5 animate-spin" />
												<span>{cmsT("cms_69")}</span>
											</>
										) : (
											<>
												<Sparkles className="w-3.5 h-3.5 text-amber-400" />
												<span>{cmsT("cms_70")}</span>
											</>
										)}
									</button>
								</div>
								<p className="text-[11px] text-amber-800 leading-relaxed">
									
									{cmsT("cms_71")}
								</p>

								{/* AI Variants display if generated */}
								{aiVariants.length > 0 && (
									<div className="pt-2 space-y-2">
										<span className="text-[10px] font-bold text-stone-700 block">
											
											{cmsT("cms_72")}
										</span>
										<div className="grid grid-cols-1 gap-2">
											{aiVariants.map((v, i) => (
												<div
													key={i}
													className="bg-white p-3 rounded-lg border border-amber-300 text-right space-y-1 hover:border-amber-600 transition-colors cursor-pointer"
													onClick={() => applyAiVariant(v)}
												>
													<div className="flex items-center justify-between">
														<span className="font-bold text-stone-900 text-[11px]">
															{v.angle}
														</span>
														<span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
															
															{cmsT("cms_73")}
														</span>
													</div>
													<p className="font-semibold text-amber-950 text-xs">
														{v.headline}
													</p>
													<p className="text-[11px] text-stone-600 line-clamp-2">
														{v.primaryText}
													</p>
												</div>
											))}
										</div>
									</div>
								)}
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block font-semibold text-stone-800 mb-1">
										
										{cmsT("cms_74")}
									</label>
									<input
										type="text"
										required
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder={cmsT("cms_75")}
										className="w-full p-2.5 border border-stone-300 rounded-xl focus:border-amber-800 focus:outline-none"
									/>
								</div>

								<div>
									<label className="block font-semibold text-stone-800 mb-1">
										
										{cmsT("cms_76")}
									</label>
									<select
										value={objective}
										onChange={(e) =>
											setObjective(e.target.value as MetaCampaignObjective)
										}
										className="w-full p-2.5 border border-stone-300 rounded-xl focus:border-amber-800 focus:outline-none bg-white"
									>
										<option value="OUTCOME_SALES">
											
											{cmsT("cms_77")}
										</option>
										<option value="OUTCOME_LEADS">
											
											{cmsT("cms_78")}
										</option>
										<option value="OUTCOME_TRAFFIC">
											
											{cmsT("cms_79")}
										</option>
										<option value="OUTCOME_AWARENESS">
											
											{cmsT("cms_80")}
										</option>
									</select>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block font-semibold text-stone-800 mb-1">
										
										{cmsT("cms_81")}
									</label>
									<div className="space-y-1.5">
										<input
											type="number"
											min={30}
											max={10000}
											value={dailyBudget}
											onChange={(e) => setDailyBudget(Number(e.target.value))}
											className="w-full p-2.5 border border-stone-300 rounded-xl font-bold font-mono focus:border-amber-800 focus:outline-none"
										/>
										<div className="flex gap-1.5">
											{[100, 150, 250, 500].map((b) => (
												<button
													key={b}
													type="button"
													onClick={() => setDailyBudget(b)}
													className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
														dailyBudget === b
															? "bg-[#2C2014] text-white border-black"
															: "bg-stone-100 text-stone-600 border-stone-200"
													}`}
												>
													{b}  {cmsT("cms_55")}
												</button>
											))}
										</div>
									</div>
								</div>

								<div>
									<label className="block font-semibold text-stone-800 mb-1">
										
										{cmsT("cms_82")}
									</label>
									<select
										value={productCategory}
										onChange={(e) =>
											setProductCategory(e.target.value as ProductCategory | "all")
										}
										className="w-full p-2.5 border border-stone-300 rounded-xl focus:border-amber-800 focus:outline-none bg-white"
									>
										<option value="rutab">{cmsT("cms_83")}</option>
										<option value="faqa">{cmsT("cms_84")}</option>
										<option value="fig">{cmsT("cms_85")}</option>
										<option value="boxes">{cmsT("cms_86")}</option>
										<option value="all">{cmsT("cms_87")}</option>
									</select>
								</div>
							</div>

							{/* Target Emirates */}
							<div>
								<label className="block font-semibold text-stone-800 mb-1.5">
									
									{cmsT("cms_88")}
								</label>
								<div className="flex flex-wrap gap-2">
									{emiratesList.map((em) => (
										<button
											key={em}
											type="button"
											onClick={() => toggleEmirate(em)}
											className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
												selectedEmirates.includes(em)
													? "bg-[#2C2014] text-amber-200 border-black"
													: "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"
											}`}
										>
											{em}
										</button>
									))}
								</div>
							</div>

							{/* Creative Copy */}
							<div className="space-y-3 pt-2 border-t border-stone-200">
								<h4 className="font-bold text-stone-900 text-sm">
									
									{cmsT("cms_89")}
								</h4>

								<div>
									<label className="block font-semibold text-stone-800 mb-1">
										
										{cmsT("cms_90")}
									</label>
									<input
										type="text"
										required
										value={headline}
										onChange={(e) => setHeadline(e.target.value)}
										className="w-full p-2.5 border border-stone-300 rounded-xl font-bold"
									/>
								</div>

								<div>
									<label className="block font-semibold text-stone-800 mb-1">
										
										{cmsT("cms_91")}
									</label>
									<textarea
										rows={3}
										required
										value={primaryText}
										onChange={(e) => setPrimaryText(e.target.value)}
										className="w-full p-2.5 border border-stone-300 rounded-xl"
									/>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div>
										<label className="block font-semibold text-stone-800 mb-1">
											
											{cmsT("cms_92")}
										</label>
										<select
											value={callToAction}
											onChange={(e) => setCallToAction(e.target.value as any)}
											className="w-full p-2.5 border border-stone-300 rounded-xl bg-white"
										>
											<option value="SHOP_NOW">{cmsT("cms_93")}</option>
											<option value="ORDER_NOW">{cmsT("cms_94")}</option>
											<option value="GET_QUOTE">{cmsT("cms_95")}</option>
											<option value="WHATSAPP_MESSAGE">
												
												{cmsT("cms_96")}
											</option>
										</select>
									</div>

									<div>
										<label className="block font-semibold text-stone-800 mb-1">
											
											{cmsT("cms_97")}
										</label>
										<select
											value={imageUrl}
											onChange={(e) => setImageUrl(e.target.value)}
											className="w-full p-2.5 border border-stone-300 rounded-xl bg-white"
										>
											<option value="/images/product_emirati_rutab_1792506810615.jpg">
												
												{cmsT("cms_98")}
											</option>
											<option value="/images/product_desert_truffles_1792506845219.jpg">
												
												{cmsT("cms_99")}
											</option>
											<option value="/images/product_fresh_figs_1792506832142.jpg">
												
												{cmsT("cms_85")}
											</option>
											<option value="/images/hero_emirati_gourmet_1792506796316.jpg">
												
												{cmsT("cms_100")}
											</option>
										</select>
									</div>
								</div>
							</div>

							<div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
								<button
									type="button"
									onClick={() => setIsCreateModalOpen(false)}
									className="px-4 py-2.5 border border-stone-300 rounded-xl text-stone-600 hover:bg-stone-50 font-medium"
								>
									
									{cmsT("cms_101")}
								</button>
								<button
									type="submit"
									className="px-6 py-2.5 bg-[#2C2014] text-amber-200 font-bold rounded-xl hover:bg-black transition-colors flex items-center gap-1.5"
								>
									<Share2 className="w-4 h-4 text-amber-400" />
									<span>{cmsT("cms_102")}</span>
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* MODAL: META MARKETING API SETTINGS */}
			{isConfigModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
					<div
						className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 border border-[#D6BE9F] space-y-4"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between border-b pb-3">
							<h3 className="font-serif text-lg font-bold text-[#2C2014]">
								
								{cmsT("cms_103")}
							</h3>
							<button onClick={() => setIsConfigModalOpen(false)}>
								<X className="w-5 h-5 text-stone-400" />
							</button>
						</div>

						<div className="space-y-3 text-xs">
							<div>
								<label className="block font-semibold text-stone-800 mb-1">
									
									{cmsT("cms_104")}
								</label>
								<input
									type="text"
									value={configForm.adAccountId}
									onChange={(e) =>
										setConfigForm({ ...configForm, adAccountId: e.target.value })
									}
									dir="ltr"
									className="w-full p-2 border border-stone-300 rounded-lg font-mono"
								/>
							</div>

							<div>
								<label className="block font-semibold text-stone-800 mb-1">
									
									{cmsT("cms_105")}
								</label>
								<input
									type="password"
									value={configForm.accessToken}
									onChange={(e) =>
										setConfigForm({ ...configForm, accessToken: e.target.value })
									}
									dir="ltr"
									className="w-full p-2 border border-stone-300 rounded-lg font-mono"
								/>
							</div>

							<div>
								<label className="block font-semibold text-stone-800 mb-1">
									Meta Pixel ID
								</label>
								<input
									type="text"
									value={configForm.pixelId}
									onChange={(e) =>
										setConfigForm({ ...configForm, pixelId: e.target.value })
									}
									dir="ltr"
									className="w-full p-2 border border-stone-300 rounded-lg font-mono"
								/>
							</div>

							<div>
								<label className="block font-semibold text-stone-800 mb-1">
									
									{cmsT("cms_106")}
								</label>
								<input
									type="text"
									value={configForm.catalogId}
									onChange={(e) =>
										setConfigForm({ ...configForm, catalogId: e.target.value })
									}
									dir="ltr"
									className="w-full p-2 border border-stone-300 rounded-lg font-mono"
								/>
							</div>
						</div>

						<div className="pt-3 border-t flex justify-end gap-2">
							<button
								onClick={() => setIsConfigModalOpen(false)}
								className="px-4 py-2 border rounded-lg text-stone-600 hover:bg-stone-50"
							>
								
								{cmsT("cms_101")}
							</button>
							<button
								onClick={() => {
									updateMetaConfig(configForm);
									setIsConfigModalOpen(false);
								}}
								className="px-5 py-2 bg-[#2C2014] text-amber-200 font-bold rounded-lg hover:bg-black"
							>
								
								{cmsT("cms_107")}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
