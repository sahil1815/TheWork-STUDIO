import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInboxData } from "@/actions/proposal-actions";
import { InboxView } from "@/components/inbox/inbox-view";

export const metadata = {
  title: "Inbox — TheWork STUDIO",
  description: "Review incoming and outgoing task proposals, invitations, and notifications.",
};

export default async function InboxPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/inbox");
  }

  const initialData = await getInboxData();

  return <InboxView initialData={initialData} />;
}
