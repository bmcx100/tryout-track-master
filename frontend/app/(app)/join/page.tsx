import { JoinForm } from "@/components/join/join-form"
import { getAvailableAssociations } from "@/app/(app)/join/actions"

export default async function JoinPage() {
  const associations = await getAvailableAssociations()

  return (
    <div className="join-page">
      <h1 className="join-title">Join an Association</h1>
      <p className="join-desc">
        Select your hockey association to view tryout&nbsp;data.
      </p>
      <JoinForm associations={associations} />
    </div>
  )
}
