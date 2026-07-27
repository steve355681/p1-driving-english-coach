import { ReviewScreen } from "@/components/review/ReviewScreen";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewScreen sessionId={id} />;
}
