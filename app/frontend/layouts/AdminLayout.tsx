import React from "react";
import { ToastContainer } from "../../components/ToastContainer";

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * The CMS dashboard owns its navigation and actions.
 * Keep this layout intentionally lightweight to avoid rendering a second,
 * duplicate admin header above the dashboard toolbar.
 */
export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <div className="admin-layout-shell min-h-screen min-w-[320px] text-right" dir="rtl">
      <main className="relative z-10 min-h-screen">{children}</main>
      <ToastContainer />
    </div>
  );
};
