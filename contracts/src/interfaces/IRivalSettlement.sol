// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {FillParams, Intent} from "../Types.sol";

/// @title IRivalSettlement
/// @notice Atomic intent settlement. No custody: every successful call ends with zero net token balance (invariant I1).
/// @dev Curve and receipt math are PRD §7.2. `fill` is non-reentrant. Open intents (`gate = 0`) never read ENS.
interface IRivalSettlement {
    /// @notice Emitted when an intent is filled.
    /// @param intentHash EIP-712 struct hash of `i`.
    /// @param maker Intent maker.
    /// @param solver `msg.sender` of `fill`.
    /// @param tokenIn Token pulled from the maker.
    /// @param tokenOut Token delivered to the recipient.
    /// @param amountIn Exact input amount.
    /// @param amountOut Exact output delivered (`required` at fill time).
    /// @param fairOut Hook mid quote before fees. Zero when the oracle is unavailable.
    /// @param fairOutAfterFee `fairOut * (1_000_000 - poolFee) / 1_000_000`. Zero when `fairOut` is zero.
    /// @param improvementBps Truncating-toward-zero bps of `amountOut` versus `fairOutAfterFee`, clamped to [-10000, 10000]. `type(int32).min` when the oracle is unavailable (not counted in stats).
    /// @param curveBps Curve premium in bps at the fill timestamp.
    /// @param elapsed Seconds of decay applied, in `[0, decaySecs]`.
    event Filled(
        bytes32 indexed intentHash,
        address indexed maker,
        address indexed solver,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fairOut,
        uint256 fairOutAfterFee,
        int32 improvementBps,
        int32 curveBps,
        uint32 elapsed
    );

    /// @notice Emitted when an intent is cancelled before fill. Cancellation never moves tokens.
    /// @param intentHash EIP-712 struct hash of the cancelled intent.
    /// @param maker Intent maker.
    event Cancelled(bytes32 indexed intentHash, address indexed maker);

    /// @notice Fill an intent. Pulls `amountIn` of `tokenIn` from the maker to `p.inputTo` and requires `tokenOut` delivery of `required` to the recipient.
    /// @param i Signed intent.
    /// @param makerSig Permit2 witness signature over `i` (the Permit2 spender is this contract).
    /// @param p Solver parameters. Not signed.
    /// @dev Reverts with {NotStarted}, {Expired}, {Cancelled}, {AlreadyFilled}, {BadSignature}, {BadParams}, {OracleUnavailable}, {BelowFloor}, {SelfFill}, {NotListed}, {NotAllowlisted}, {GateFailed}, {DeliveryShort}, or Permit2 errors (`InvalidSigner`, `InvalidNonce`).
    function fill(Intent calldata i, bytes calldata makerSig, FillParams calldata p) external;

    /// @notice Maker cancels their own intent. Does not touch funds.
    /// @param i The intent. `msg.sender` must be `i.maker`. The hash is derived on-chain.
    /// @dev Reverts with {Unauthorized} when the caller is not the maker. Reverts with {AlreadyFilled} when the intent is already filled. A second cancel reverts with {Cancelled}.
    function cancel(Intent calldata i) external;

    /// @notice Anyone relays a maker-signed cancel. EIP-712 primary type `Cancel(bytes32 intentHash,uint256 deadline)`.
    /// @param intentHash Hash of the intent to cancel.
    /// @param deadline Unix time after which the signature is void.
    /// @param sig Maker signature over the `Cancel` struct.
    /// @dev Reverts with {Expired} when `block.timestamp > deadline`, {BadSignature} on a bad signature, {AlreadyFilled} if a fill landed first.
    function cancelBySig(bytes32 intentHash, uint256 deadline, bytes calldata sig) external;

    /// @notice Required output, curve bps, and base amount at timestamp `ts`.
    /// @param i Intent parameters. Signature and status are not consulted.
    /// @param ts Unix timestamp the curve is evaluated at (tests and the UI pass sampled times; `fill` passes `block.timestamp`).
    /// @return required `max(curveOut, hardMinOut)` in `tokenOut` base units.
    /// @return curveBps Signed premium in bps after decay. Wider than `int32` so callers can distinguish the raw value; the value always fits in `int32` for in-bounds intents.
    /// @return base Oracle quote when pegged, otherwise `i.baseOut`.
    /// @dev Reverts with {OracleUnavailable} when pegged and the hook cannot quote. Reverts with {BadParams} on out-of-bounds curve inputs.
    function requiredAt(Intent calldata i, uint256 ts)
        external
        view
        returns (uint256 required, int256 curveBps, uint256 base);

    /// @notice EIP-712 struct hash of `i` (not the signing digest).
    /// @param i Intent.
    /// @return EIP-712 struct hash.
    function intentHash(Intent calldata i) external view returns (bytes32);

    /// @notice Local status of an intent hash.
    /// @param intentHash Hash previously returned by {intentHash}.
    /// @return 0 none, 1 filled, 2 cancelled. Matches {IntentStatus}.
    function status(bytes32 intentHash) external view returns (uint8);
}
