import type { Metadata } from "next";
import { ProfileView } from "@/components/marketplace/profile-view";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your owned assets, listings and activity on the Zecians Marketplace.",
};

export default function ProfilePage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Profile</div>
          <h1>Your marketplace.</h1>
          <p className="lede">
            Indexed assets, active listings and observed activity for the
            connected wallet address.
          </p>
        </div>
      </div>
      <div className="container" style={{ paddingTop: 34, paddingBottom: 40 }}>
        <ProfileView />
      </div>
    </>
  );
}
