import HomeClient from "./home-client";
import { getDeals } from "@/lib/deals";

export default async function Home() {
  const deals = await getDeals();
  return (
    <HomeClient
      flashDeals={deals.flash}
      hotDeals={deals.hot}
      source={deals.source}
    />
  );
}
