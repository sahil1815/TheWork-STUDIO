import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNotes, getAllUserTags } from "@/actions/note-actions";
import { NotebookRoot } from "@/components/notebook/notebook-root";

export const metadata = {
  title: "Notebook — TheWork STUDIO",
  description: "Personal rich-text notes with autosave, pinning, and tag organization.",
};

export default async function NotebookPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/notebook");
  }

  const [initialNotes, initialTags] = await Promise.all([
    getNotes(),
    getAllUserTags(),
  ]);

  return <NotebookRoot initialNotes={initialNotes} initialTags={initialTags} />;
}
