import { JoinForm } from "@/components/join/join-form"

export default function JoinPage() {
  return (
    <div className="join-page">
      <h1 className="join-title">Join an Association</h1>
      <p className="join-desc">
        Enter the code provided by your hockey association to view tryout&nbsp;data.
      </p>
      <JoinForm />
    </div>
  )
}
