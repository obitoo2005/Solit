import { InviteFeature } from '@/components/groups/invite-feature'

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <InviteFeature inviteCode={code} />
}
