import { PageHeader } from "@/components/layout/page-header";
import { SavedResources } from "@/components/resources/saved-resources";

export default function SavedResourcesPage() {
  return (
    <>
      <PageHeader
        description="Local bookmarks and recently viewed resources. Nothing here is stored server-side."
        title="Saved resources"
      />
      <SavedResources />
    </>
  );
}
