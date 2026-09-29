import Hero from "@/components/home/hero";
import BrandStatement from "@/components/home/brand-statement";
import Marquee from "@/components/home/marquee";
import Identity from "@/components/home/identity";
import MarketEntry from "@/components/home/market-entry";

export default function HomePage() {
  return (
    <>
      <Hero />
      <BrandStatement />
      <Marquee />
      <Identity />
      <MarketEntry />
    </>
  );
}
