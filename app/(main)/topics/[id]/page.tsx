import { TopicEditor } from "@/components/topics/TopicEditor";

export default async function EditTopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TopicEditor topicId={id} />;
}
