// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title Rival shared types
/// @notice Normative data model for intents, fills, and solver stats (PRD §7.1).
/// @dev Field order of {Intent} is the EIP-712 encoding order. Enum fields are `uint8` in the
///      type string below. Do not reorder fields; Permit2 witness hashes depend on this order.
///
///      EIP-712 type string (enums encoded as uint8):
///      Intent(address maker,address tokenIn,address tokenOut,uint128 amountIn,address recipient,uint8 mode,uint128 baseOut,uint32 oracleWindow,int32 startBps,int32 floorBps,uint32 startTime,uint32 decaySecs,uint32 deadline,uint128 hardMinOut,uint8 gate,bytes32 allowlistHash,uint256 nonce)

/// @notice How `base` is chosen for the price curve.
/// @dev ABSOLUTE = 0 uses `Intent.baseOut`. PEGGED = 1 uses the hook quote.
enum Mode {
    ABSOLUTE,
    PEGGED
}

/// @notice Who may call `fill` for an intent.
/// @dev OPEN = 0, LISTED = 1 (`isListed`), NAMED = 2 (allowlist hash + `ownsAny`).
enum Gate {
    OPEN,
    LISTED,
    NAMED
}

/// @notice Local settlement status of an intent hash.
/// @dev NONE = 0, FILLED = 1, CANCELLED = 2. Distinct from the Arkiv advisory status string.
enum IntentStatus {
    NONE,
    FILLED,
    CANCELLED
}

/// @notice Signed maker order. Also the Permit2 witness struct.
/// @dev `nonce` is a Permit2 unordered nonce. `allowlistHash` is `keccak256(abi.encodePacked(labelhashes))` when `gate` is {Gate.NAMED}, otherwise zero.
struct Intent {
    /// @notice Token owner and EIP-712 signer. Permit2 also accepts EIP-1271 makers.
    address maker;
    /// @notice Token pulled from the maker via Permit2.
    address tokenIn;
    /// @notice Token delivered to `recipient`.
    address tokenOut;
    /// @notice Exact input amount, in `tokenIn` base units. Must be > 0.
    uint128 amountIn;
    /// @notice Address that receives `tokenOut`. Must not equal the filling solver.
    address recipient;
    /// @notice {Mode.ABSOLUTE} or {Mode.PEGGED}.
    Mode mode;
    /// @notice Reference output for `amountIn` when `mode` is {Mode.ABSOLUTE}. Ignored when pegged.
    uint128 baseOut;
    /// @notice TWAP window in seconds when pegged. Bounds [60, 3600]. Ignored when absolute.
    uint32 oracleWindow;
    /// @notice Premium over `base` at `startTime`, in signed bps. Bounds [-5000, +5000], and `startBps >= floorBps`.
    int32 startBps;
    /// @notice Premium at and after `startTime + decaySecs`, in signed bps.
    int32 floorBps;
    /// @notice Unix time when the curve starts decaying.
    uint32 startTime;
    /// @notice Decay length in seconds. Bounds [10, 3600].
    uint32 decaySecs;
    /// @notice Unix time after which the intent cannot be filled. `startTime < deadline <= startTime + 86400`.
    uint32 deadline;
    /// @notice Absolute minimum `tokenOut` the recipient must receive. Always enforced.
    uint128 hardMinOut;
    /// @notice {Gate} applied to `msg.sender` of `fill`.
    Gate gate;
    /// @notice Commitment to the named-solver allowlist. Zero when `gate` is not {Gate.NAMED}.
    bytes32 allowlistHash;
    /// @notice Permit2 unordered nonce. Replay protection lives in Permit2's bitmap.
    uint256 nonce;
}

/// @notice Solver-supplied parameters for one `fill` call. Not signed by the maker.
struct FillParams {
    /// @notice Recipient of `tokenIn` (the solver contract, or the solver EOA for a direct fill).
    address inputTo;
    /// @notice When true, settlement calls `IRivalFill.rivalFillCallback` on `msg.sender` before pulling `tokenOut`.
    bool useCallback;
    /// @notice Opaque bytes forwarded to the callback. Settlement does not decode them.
    bytes data;
    /// @notice Label hashes for {Gate.NAMED}. `keccak256(abi.encodePacked(allowLabels))` must equal `Intent.allowlistHash`.
    bytes32[] allowLabels;
}

/// @notice Protocol performance counters for one solver. ENS text records mirror these; storage is authoritative for the numbers.
struct Stats {
    /// @notice Count of fills whose receipt was not the oracle-unavailable sentinel.
    uint64 fills;
    /// @notice Distinct maker addresses filled against.
    uint64 makers;
    /// @notice Sum of non-sentinel `improvementBps`. Average is this sum divided by `fills`.
    int128 sumImprovementBps;
    /// @notice `block.timestamp` of the latest counted fill. Zero when `fills` is zero.
    uint64 lastFill;
}

/// @notice Thrown when `block.timestamp < intent.startTime`.
error NotStarted();

/// @notice Thrown when `block.timestamp > intent.deadline`, or a cancel signature's deadline has passed.
error Expired();

/// @notice Thrown when the intent hash is already cancelled.
error Cancelled();

/// @notice Thrown when the intent hash is already filled.
error AlreadyFilled();

/// @notice Thrown when a maker, cancel, or faucet signature does not recover to the expected signer.
error BadSignature();

/// @notice Thrown when intent parameters are outside PRD §7.2 bounds, the pair is unsupported in pegged mode, or a named-gate hash mismatches.
error BadParams();

/// @notice Thrown when a pegged intent's oracle window is not available (insufficient history or stale).
error OracleUnavailable();

/// @notice Thrown when a computed output would sit below `hardMinOut` (should be unreachable: `required` is `max(curve, hardMinOut)`).
error BelowFloor();

/// @notice Thrown when a gate check cannot be completed. Named-gate and listed-gate ENS failures use {NotListed} / {NotAllowlisted} when the read succeeds and returns false.
error GateFailed();

/// @notice Thrown when the recipient's `tokenOut` balance increased by less than `required`.
error DeliveryShort();

/// @notice Thrown when `msg.sender` is the maker or the recipient.
error SelfFill();

/// @notice Thrown when `gate` is {Gate.LISTED} and `isListed(msg.sender)` is false.
error NotListed();

/// @notice Thrown when `gate` is {Gate.NAMED} and the caller does not own a listed label in the allowlist.
error NotAllowlisted();

/// @notice Thrown when the caller lacks the role the function requires (maker cancel, settlement-only hooks, callback caller).
error Unauthorized();

/// @notice Thrown by the oracle when the stored history does not cover the requested window.
error InsufficientHistory();

/// @notice Thrown by the oracle when `window` is outside [60, 3600].
error WindowOutOfRange();

/// @notice Thrown when a solver label is reserved, malformed, already taken, or the solver already has a name.
error LabelUnavailable();
