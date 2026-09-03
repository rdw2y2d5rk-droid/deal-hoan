import HomeClient from "./home-client";
import { getDeals, getActiveFlashSaleSession } from "@/lib/deals";

export default async function Home() {
  const [deals, flashSession] = await Promise.all([
    getDeals(),
    getActiveFlashSaleSession().catch(() => null),
  ]);

  return (
    <HomeClient
      flashDeals={deals.flash}
      hotDeals={deals.hot}
      source={deals.source}
      flashEndTime={flashSession?.endTime ? flashSession.endTime * 1000 : undefined}
      flashSlot={flashSession?.timeSlot}
    />
  );
}
