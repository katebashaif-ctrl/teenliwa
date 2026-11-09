import React from "react";
import { useStore } from "../../context/StoreContext";
import { Lock } from "lucide-react";
import { StoreLayout } from "../layout/StoreLayout";
import { AdminLayout } from "../layout/AdminLayout";
import { CMSDashboard } from "../../components/CMSDashboard";
import { t } from "../locales/i18n";

export const CMSView: React.FC = () => {
	const {
		isAdminAuthenticated,
		setIsAdminLoginModalOpen,
		setCurrentView,
	} = useStore();

	const isAuthEffective = isAdminAuthenticated;

	if (!isAuthEffective) {
		return (
			<StoreLayout>
				<div className="cms-access-screen flex-1 flex items-center justify-center p-6 py-20 bg-[#FAF7F2]">
					<div className="cms-access-card text-center space-y-4 max-w-md w-full bg-white p-8 rounded-2xl border border-[#D6BE9F] shadow-xl">
						<div className="w-16 h-16 rounded-2xl bg-[#F5EFE6] text-amber-900 border border-[#D6BE9F] flex items-center justify-center mx-auto">
							<Lock className="w-8 h-8 text-amber-800" />
						</div>
						<h2 className="font-serif text-2xl font-bold text-[#2C2014]">
							{t("admin.protectedAreaTitle")}
						</h2>
						<p className="text-xs text-stone-500 leading-relaxed">
							{t("admin.protectedAreaDesc")}
						</p>
						<div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
							<button
								onClick={() => setIsAdminLoginModalOpen(true)}
								className="px-6 py-3 bg-[#2C2014] text-amber-200 font-bold rounded-xl text-xs hover:bg-black transition-colors"
							>
								{t("admin.loginButton")}
							</button>
							<button
								onClick={() => setCurrentView("store")}
								className="px-5 py-3 border border-stone-300 text-stone-600 rounded-xl text-xs font-semibold hover:bg-stone-50"
							>
								{t("admin.backToStore")}
							</button>
						</div>
					</div>
				</div>
			</StoreLayout>
		);
	}

	return (
		<AdminLayout>
			<CMSDashboard />
		</AdminLayout>
	);
};
