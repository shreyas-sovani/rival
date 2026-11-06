import type { BannerVM } from "../../viewmodels/common.ts";
import { Banner } from "../ui/Banner.tsx";

export function StatusBanner({ banner }: { banner: BannerVM }) {
  return (
    <Banner actionLabel={banner.actionLabel} kind={banner.kind} onAction={banner.onAction}>
      {banner.text}
    </Banner>
  );
}
