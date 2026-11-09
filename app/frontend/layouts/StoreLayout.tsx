import React from "react";
import { Header } from "../../components/Header";
import { AnnouncementBar } from "../../components/AnnouncementBar";
import { Footer } from "../../components/Footer";
import { CartDrawer } from "../../components/CartDrawer";
import { OrderSuccessModal } from "../../components/OrderSuccessModal";
import { AdminLoginModal } from "../../components/AdminLoginModal";
import { CookieBanner } from "../../components/CookieBanner";
import { PrivacyTermsModal } from "../../components/PrivacyTermsModal";
import { ToastContainer } from "../../components/ToastContainer";

interface StoreLayoutProps {
	children: React.ReactNode;
}

export const StoreLayout: React.FC<StoreLayoutProps> = ({ children }) => {
	return (
		<div className="storefront-shell flex flex-col min-h-screen text-right">
			<AnnouncementBar />
			<Header />
			<main className="flex-1">{children}</main>
			<Footer />
			<CartDrawer />
			<OrderSuccessModal />
			<AdminLoginModal />
			<CookieBanner />
			<PrivacyTermsModal />
			<ToastContainer />
		</div>
	);
};
