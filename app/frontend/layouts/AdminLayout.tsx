import React from "react";
import { useStore } from "../../context/StoreContext";
import { LogOut, Store } from "lucide-react";
import { t } from "../locales/i18n";
import { ToastContainer } from "../../components/ToastContainer";

interface AdminLayoutProps {
	children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
	const { adminLogout, setCurrentView } = useStore();

	return (
		<div className="flex flex-col min-h-screen min-w-[320px] bg-[#FAF7F2] text-right overflow-x-hidden">
			{/* Admin Header */}
			<header className="sticky top-0 z-40 bg-[#2C2014] text-[#E8DCCB] border-b border-[#574127] shadow-md">
				<div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2 sm:gap-3">
						<span className="font-serif text-base sm:text-lg font-bold text-amber-200 truncate">
							{t("admin.cmsTitle")}
						</span>
						<span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded">
							Admin
						</span>
					</div>

					<div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
						<button
							onClick={() => setCurrentView("store")}
							className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF7F2]/10 hover:bg-[#FAF7F2]/20 text-stone-200 text-xs rounded-lg transition-colors"
						>
							<Store className="w-3.5 h-3.5 text-amber-300" />
							<span className="hidden sm:inline">{t("admin.backToStore")}</span>
						</button>

						<button
							onClick={adminLogout}
							className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/60 hover:bg-rose-900 text-rose-200 text-xs rounded-lg transition-colors"
						>
							<LogOut className="w-3.5 h-3.5" />
							<span className="hidden sm:inline">{t("admin.logout")}</span>
						</button>
					</div>
				</div>
			</header>

			<main className="flex-1">{children}</main>

			<ToastContainer />
		</div>
	);
};
