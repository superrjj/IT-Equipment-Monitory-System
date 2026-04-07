import React, { useState, useEffect } from "react";
import Header from "../administrator/dashboard/header";
import UserBottomNav from "./UserBottomNav";
import type { UserNavLabel } from "./UserBottomNav";
import UserDashboardHome from "./UserDashboardHome";
import UserSubmitTicket from "./userSubmitTicket";
import MyTicketsUser from "./MyTicketsUser";
import UserTicketFeedback from "./UserTicketFeedback";
import ProfileModal from "../administrator/Management/my-profiles";
import { supabase } from "../../lib/supabaseClient";

const UserShell: React.FC = () => {
  const [activeLabel, setActiveLabel] = useState<UserNavLabel>("Dashboard");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");

  const currentUserName =
    localStorage.getItem("session_user_full_name") || "Employee";
  const userId = localStorage.getItem("session_user_id") || "";

  useEffect(() => {
    const loadAvatar = async () => {
      if (!userId) {
        setAvatarUrl("");
        return;
      }
      const { data } = await supabase
        .from("user_accounts")
        .select("avatar_url, updated_at")
        .eq("id", userId)
        .single();
      setAvatarUrl(
        data?.avatar_url
          ? `${data.avatar_url}?t=${encodeURIComponent(
              String(data.updated_at ?? "")
            )}`
          : ""
      );
    };
    void loadAvatar();
  }, [userId]);

  const getPage = (label: UserNavLabel): React.ReactNode => {
    switch (label) {
      case "Dashboard":
        return (
          <UserDashboardHome
            onNavigateSubmit={() => setActiveLabel("Submit Ticket")}
            onNavigateMyTickets={() => setActiveLabel("My Tickets")}
          />
        );
      case "Submit Ticket":
        return <UserSubmitTicket />;
      case "My Tickets":
        return <MyTicketsUser />;
      case "Feedback":
        return <UserTicketFeedback />;
      default:
        return (
          <UserDashboardHome
            onNavigateSubmit={() => setActiveLabel("Submit Ticket")}
            onNavigateMyTickets={() => setActiveLabel("My Tickets")}
          />
        );
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .u-shell-scroll::-webkit-scrollbar             { width: 8px; height: 8px; }
        .u-shell-scroll::-webkit-scrollbar-track       { background: transparent; }
        .u-shell-scroll::-webkit-scrollbar-thumb       { background: #cbd5e1; border-radius: 4px; }
        .u-shell-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <div
        style={{
          height: "100vh",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#f5f6f7",
          fontFamily: "'Poppins', sans-serif",
          color: "#0f172a",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: 0,
            background: "#ffffff",
            borderBottom: "1px solid #e8edf5",
            boxShadow: "0 2px 12px rgba(10,76,134,0.06)",
          }}
        >
          <Header
            currentUserName={currentUserName}
            userRole="Employee"
            subtitleOverride={null}
            avatarUrl={avatarUrl}
            onNotificationNavigate={(entityType, entityId) => {
              if (entityType === "file_report" && entityId) {
                localStorage.setItem("focus_ticket_id", entityId);
                setActiveLabel("My Tickets");
              } else {
                setActiveLabel("My Tickets");
              }
            }}
            onOpenProfile={() => setShowProfileModal(true)}
          />
        </div>

        <div
          className="u-shell-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "1.2rem 10% 100px",
          }}
        >
          {getPage(activeLabel)}
        </div>

        <UserBottomNav activeLabel={activeLabel} onNavigate={setActiveLabel} />
      </div>

      <ProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onAvatarChange={url => setAvatarUrl(url)}
      />
    </>
  );
};

export default UserShell;