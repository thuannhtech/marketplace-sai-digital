import { redirect } from "next/navigation";
import { getCurrentAdminUserAction } from "@/src/app/actions/auth";
import { getDefaultRedirectPage } from "@/src/lib/auth/role-utils";

export default async function HomePage() {
  const { success, user } = await getCurrentAdminUserAction();

  if (!success || !user) {
    redirect("/login");
  }

  const target = getDefaultRedirectPage(user.roles || user.xpRoles, user.username);
  redirect(target);
}
