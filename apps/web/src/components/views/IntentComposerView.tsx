import type { IntentComposerVM } from "../../viewmodels/intent-composer.ts";
import { testIds } from "../../testids.ts";
import { AddressText } from "../ui/AddressText.tsx";
import { Button } from "../ui/Button.tsx";
import { ErrorState } from "../ui/ErrorState.tsx";
import { Skeleton } from "../ui/Skeleton.tsx";
import { CurveChartView } from "./CurveChartView.tsx";
import { PresenceChip } from "./PresenceChip.tsx";
import { StatusBanner } from "./StatusBanner.tsx";

export function IntentComposerView({ vm }: { vm: IntentComposerVM }) {
  const loading = vm.poolQuote === "" && vm.twap === "" && vm.solversOnline === "";
  return (
    <form data-testid={testIds.intentComposer} onSubmit={(event) => event.preventDefault()}>
      <h1>
        Sell {vm.sellSymbol} for {vm.buySymbol}
      </h1>
      {vm.banner?.kind === "error" ? <ErrorState title={vm.banner.text} /> : null}
      {vm.banner ? <StatusBanner banner={vm.banner} /> : null}
      {loading ? <Skeleton label="Quote" /> : null}
      <p>
        Balance {vm.sellBalance} {vm.sellSymbol} · {vm.buyBalance} {vm.buySymbol}
      </p>
      <p>{vm.walletAddress ? <AddressText value={vm.walletAddress} /> : "Wallet creating"}</p>
      {vm.signingState === "idle" ? null : <p>Signing {vm.signingState}</p>}
      {vm.published ? <p>Published {vm.published.intentHash}</p> : null}
      <label>
        Amount
        <input onChange={(event) => vm.onChange({ amountIn: event.target.value })} value={vm.amountIn} />
      </label>
      <fieldset>
        <legend>Preset</legend>
        {vm.presets.map((preset) => (
          <label key={preset.id}>
            <input
              checked={vm.preset === preset.id}
              name="preset"
              onChange={() => vm.onChange({ preset: preset.id })}
              type="radio"
              value={preset.id}
            />
            {preset.label} {preset.summary}
          </label>
        ))}
      </fieldset>
      <label>
        Gate
        <select onChange={(event) => vm.onChange({ gate: event.target.value as IntentComposerVM["gate"] })} value={vm.gate}>
          {vm.gateOptions.map((option) => (
            <option disabled={!option.enabled} key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {vm.gate === "named" ? (
        <label>
          Named labels
          <input onChange={(event) => vm.onChange({ namedLabels: event.target.value })} value={vm.namedLabels} />
        </label>
      ) : null}
      <label>
        Mode
        <select onChange={(event) => vm.onChange({ mode: event.target.value as IntentComposerVM["mode"] })} value={vm.mode}>
          <option value="absolute">absolute</option>
          <option disabled={!vm.peggedEnabled} value="pegged">
            pegged
          </option>
        </select>
      </label>
      <p>
        Pool {vm.poolQuote} · TWAP {vm.twap} · {vm.solversOnline}
      </p>
      <PresenceChip presence={vm.presence} />
      <p>Floor {vm.floorLine}</p>
      <CurveChartView curve={vm.preview} />
      {vm.validationMessages.length > 0 ? (
        <ul>
          {vm.validationMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      <Button disabled={!vm.canFaucet} onClick={vm.onFaucet}>
        {vm.faucetLabel}
      </Button>
      <Button disabled={!vm.canSubmit} onClick={vm.onSubmit}>
        {vm.submitLabel}
      </Button>
    </form>
  );
}
