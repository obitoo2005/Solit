import { GroupDetailFeature } from '@/components/groups/group-detail-feature'

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GroupDetailFeature groupId={id} />
}
