import { Card, CardHeader } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors ProgressView's layout so the page doesn't jump when data lands. */
export function ProgressSkeleton() {
  return (
    <PageContainer>
      <PageHeader title="Progress" subtitle="Every completed session, tracked over time." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <Skeleton className="mx-6 mb-6 h-56 rounded-xl" />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </PageContainer>
  );
}
