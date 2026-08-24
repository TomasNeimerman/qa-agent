// Fixture: trivial App Router page, no form — exists solely to exercise
// the D-08 both-present branch of router-layout detection alongside
// pages/api/legacy.ts. Static text only; nothing in this repo imports or
// executes this file.
export default function HomePage() {
  return <p>Hybrid fixture home page.</p>;
}
