import type { Metadata } from "next";
import { ProfileView } from "@/components/marketplace/profile-view";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your owned assets, listings and activity on the Zecians Marketplace.",
};

export default function ProfilePage() {
  return <ProfileView />;
}
