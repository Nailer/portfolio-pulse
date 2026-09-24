import { PortfolioDashboard } from "@/components/PortfolioDashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-fg">
      <div className="max-w-4xl mx-auto px-4 pt-12">
        <header className="text-center mb-8">
          <h1 className="text-[32px] font-medium text-fg">Portfolio Pulse</h1>
          <p className="text-[13px] font-mono text-fg-subtle mt-2 max-w-lg mx-auto">
            Enter your holdings and see live value, sector exposure, concentration risk, and
            momentum correlation — all sourced straight from the CoinMarketCap API.
          </p>
        </header>
      </div>
      <div className="px-4">
        <PortfolioDashboard />
      </div>
    </main>
  );
}
