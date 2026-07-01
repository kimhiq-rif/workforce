import { CheckinClient } from "./CheckinClient";

export const dynamic = "force-dynamic";

interface Props { params: { token: string } }

export default function CheckinPage({ params }: Props) {
  return <CheckinClient token={params.token} />;
}
