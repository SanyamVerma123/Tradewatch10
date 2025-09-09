import { ProfileClient } from "@/components/stockwatch/ProfileClient";
import { user } from "@/lib/user";

export default function ProfilePage() {
  return <ProfileClient user={user} />;
}
