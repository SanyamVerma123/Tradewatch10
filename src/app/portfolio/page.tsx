import { PortfolioClient } from "@/components/stockwatch/PortfolioClient";
import { portfolio } from "@/lib/portfolio";

export default function PortfolioPage() {
  const initialPortfolio = portfolio;
  return <PortfolioClient initialPortfolio={initialPortfolio} />;
}
