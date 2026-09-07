import HomeClient from "./home-client";
import { getDeals, getActiveFlashSaleSession, getVouchers } from "@/lib/deals";

export default async function Home() {
  const [deals, flashSession, vouchers] = await Promise.all([
    getDeals(),
    getActiveFlashSaleSession().catch(() => null),
    getVouchers().catch(() => []),
  ]);

  return (
    <HomeClient
      flashDeals={deals.flash}
      hotDeals={deals.hot}
      vouchers={vouchers}
      source={deals.source}
      flashEndTime={flashSession?.endTime ? flashSession.endTime * 1000 : undefined}
      flashSlot={flashSession?.timeSlot}
    />
  );
}

