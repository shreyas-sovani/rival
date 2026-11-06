// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ReentrancyGuard} from "solady/src/utils/ReentrancyGuard.sol";
import {SafeTransferLib} from "solady/src/utils/SafeTransferLib.sol";

import {IPermit2Min} from "./interfaces/IPermit2Min.sol";
import {IRivalFill} from "./interfaces/IRivalFill.sol";
import {IRivalOracle} from "./interfaces/IRivalOracle.sol";
import {IRivalSettlement} from "./interfaces/IRivalSettlement.sol";
import {ISolverRegistry} from "./interfaces/ISolverRegistry.sol";
import {RivalMath} from "./libs/RivalMath.sol";
import {
    AlreadyFilled,
    BadParams,
    BadSignature,
    BelowFloor,
    Cancelled as CancelledErr,
    DeliveryShort,
    Expired,
    FillParams,
    Gate,
    GateFailed,
    Intent,
    IntentStatus,
    Mode,
    NotAllowlisted,
    NotListed,
    NotStarted,
    OracleUnavailable,
    SelfFill,
    Unauthorized
} from "./Types.sol";

/// @title RivalSettlement
/// @notice Atomic intent settlement. Successful calls end with zero net token balance.
/// @dev The Permit2 witness suffix is `packages/intent` `WITNESS_TYPE_STRING`, byte for byte.
///      Gasless cancel is EIP-712 type `Cancel(bytes32 intentHash,uint256 deadline)` in this
///      contract's domain (`RivalSettlement` version `1`). See docs/spikes/S2.md.
contract RivalSettlement is IRivalSettlement, ReentrancyGuard {
    using SafeTransferLib for address;

    /// @notice Permit2 witness suffix. Must match `WITNESS_TYPE_STRING` in `packages/intent/src/types.ts`.
    string public constant WITNESS_TYPE_STRING =
        "Intent witness)Intent(address maker,address tokenIn,address tokenOut,uint128 amountIn,address recipient,uint8 mode,uint128 baseOut,uint32 oracleWindow,int32 startBps,int32 floorBps,uint32 startTime,uint32 decaySecs,uint32 deadline,uint128 hardMinOut,uint8 gate,bytes32 allowlistHash,uint256 nonce)TokenPermissions(address token,uint256 amount)";

    /// @notice EIP-712 name for {cancelBySig}. Not used for the Permit2 witness.
    string public constant NAME = "RivalSettlement";

    /// @notice EIP-712 version for {cancelBySig}.
    string public constant VERSION = "1";

    bytes32 internal constant _INTENT_TYPEHASH = keccak256(
        "Intent(address maker,address tokenIn,address tokenOut,uint128 amountIn,address recipient,uint8 mode,uint128 baseOut,uint32 oracleWindow,int32 startBps,int32 floorBps,uint32 startTime,uint32 decaySecs,uint32 deadline,uint128 hardMinOut,uint8 gate,bytes32 allowlistHash,uint256 nonce)"
    );

    /// @notice `keccak256("Cancel(bytes32 intentHash,uint256 deadline)")`.
    bytes32 public constant CANCEL_TYPEHASH = keccak256("Cancel(bytes32 intentHash,uint256 deadline)");

    bytes32 internal constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @notice The one hooked pool this settlement quotes.
    /// @dev `key.currency0` must sort below `key.currency1`. Pegged intents for any other pair revert {BadParams}.
    struct PairConfig {
        PoolKey key;
    }

    /// @notice Curve evaluation plus the receipt's fair quote.
    struct Priced {
        bytes32 hash;
        uint256 required;
        int256 curveBps;
        uint256 base;
        uint256 fairOut;
        uint32 elapsed;
    }

    /// @notice Permit2. The spender bound into maker signatures is this contract.
    IPermit2Min public immutable permit2;

    /// @notice Block-start TWAP. Pegged `base` and receipt `fairOut` both come from {quote}.
    IRivalOracle public immutable oracle;

    /// @notice Listing and fill stats. Open intents never call {isListed} or {ownsAny}.
    ISolverRegistry public immutable registry;

    /// @notice Lower currency of the hooked pool.
    address public immutable currency0;

    /// @notice Higher currency of the hooked pool.
    address public immutable currency1;

    /// @notice Pool fee passed to the receipt, in hundredths of a bip (500 = 0.05%).
    uint24 public immutable poolFee;

    /// @notice Tick spacing stored so {poolKey} round-trips the constructor value.
    int24 public immutable tickSpacing;

    /// @notice Hook on the configured pool. Production sets this to the oracle hook.
    address public immutable hooks;

    bytes32 internal immutable _domainSeparator;
    uint256 internal immutable _chainId;

    mapping(bytes32 hash => IntentStatus) internal _status;

    constructor(IPermit2Min permit2_, IRivalOracle oracle_, ISolverRegistry registry_, PairConfig memory pair) {
        if (address(permit2_) == address(0) || address(oracle_) == address(0) || address(registry_) == address(0)) {
            revert BadParams();
        }
        address c0 = Currency.unwrap(pair.key.currency0);
        address c1 = Currency.unwrap(pair.key.currency1);
        if (c0 == address(0) || c1 == address(0) || c0 >= c1) revert BadParams();

        permit2 = permit2_;
        oracle = oracle_;
        registry = registry_;
        currency0 = c0;
        currency1 = c1;
        poolFee = pair.key.fee;
        tickSpacing = pair.key.tickSpacing;
        hooks = address(pair.key.hooks);
        _chainId = block.chainid;
        _domainSeparator = _buildDomain(block.chainid);
    }

    /// @inheritdoc IRivalSettlement
    function fill(Intent calldata i, bytes calldata makerSig, FillParams calldata p) external nonReentrant {
        bytes32 hash = intentHash(i);
        _precheck(i, hash, p);
        _gate(i, p);
        Priced memory priced = _price(i, block.timestamp);
        priced.hash = hash;
        _pullAndDeliver(i, makerSig, p, priced);
    }

    /// @inheritdoc IRivalSettlement
    function cancel(Intent calldata i) external nonReentrant {
        if (msg.sender != i.maker) revert Unauthorized();
        _cancel(intentHash(i), i.maker);
    }

    /// @inheritdoc IRivalSettlement
    /// @dev The recovered signer is emitted as `maker`. Deadline is valid through `deadline == block.timestamp`.
    function cancelBySig(bytes32 intentHash_, uint256 deadline, bytes calldata sig) external nonReentrant {
        if (block.timestamp > deadline) revert Expired();
        address maker = _recover(cancelDigest(intentHash_, deadline), sig);
        if (maker == address(0)) revert BadSignature();
        _cancel(intentHash_, maker);
    }

    /// @inheritdoc IRivalSettlement
    function requiredAt(Intent calldata i, uint256 ts)
        external
        view
        returns (uint256 required, int256 curveBps, uint256 base)
    {
        Priced memory priced = _price(i, ts);
        return (priced.required, priced.curveBps, priced.base);
    }

    /// @inheritdoc IRivalSettlement
    function intentHash(Intent calldata i) public pure returns (bytes32) {
        return _hashIntent(i);
    }

    /// @dev A memory `Intent` is seventeen 32-byte words, the same image as `abi.encode` of its fields.
    function _hashIntent(Intent calldata i) private pure returns (bytes32 hash) {
        Intent memory copied = i;
        bytes32 typehash = _INTENT_TYPEHASH;
        assembly ("memory-safe") {
            let p := mload(0x40)
            mstore(p, typehash)
            let k := 0
            for {} lt(k, 544) {} {
                mstore(add(add(p, 32), k), mload(add(copied, k)))
                k := add(k, 32)
            }
            hash := keccak256(p, 576)
            mstore(0x40, add(p, 576))
        }
    }

    /// @inheritdoc IRivalSettlement
    function status(bytes32 intentHash_) external view returns (uint8) {
        return uint8(_status[intentHash_]);
    }

    /// @notice EIP-712 domain separator for {cancelBySig}. Rebuilt if `chainid` changes.
    function domainSeparator() public view returns (bytes32) {
        return block.chainid == _chainId ? _domainSeparator : _buildDomain(block.chainid);
    }

    /// @notice Signing digest for `Cancel(bytes32 intentHash,uint256 deadline)`.
    function cancelDigest(bytes32 intentHash_, uint256 deadline) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(CANCEL_TYPEHASH, intentHash_, deadline));
        return keccak256(abi.encodePacked(hex"1901", domainSeparator(), structHash));
    }

    /// @notice Pool key passed to the oracle. Currencies are the constructor pair.
    function poolKey() public view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: poolFee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hooks)
        });
    }

    function _precheck(Intent calldata i, bytes32 hash, FillParams calldata p) internal view {
        IntentStatus current = _status[hash];
        if (current == IntentStatus.FILLED) revert AlreadyFilled();
        if (current != IntentStatus.NONE) revert CancelledErr();
        if (block.timestamp < i.startTime) revert NotStarted();
        if (block.timestamp > i.deadline) revert Expired();
        if (msg.sender == i.maker || msg.sender == i.recipient) revert SelfFill();
        if (p.inputTo == address(0) || p.inputTo == address(this) || i.recipient == address(this)) revert BadParams();
    }

    function _gate(Intent calldata i, FillParams calldata p) internal view {
        if (i.gate == Gate.OPEN) return;
        if (i.gate == Gate.LISTED) {
            try registry.isListed(msg.sender) returns (bool listed) {
                if (!listed) revert NotListed();
            } catch {
                revert GateFailed();
            }
            return;
        }
        if (keccak256(abi.encodePacked(p.allowLabels)) != i.allowlistHash) revert BadParams();
        try registry.ownsAny(msg.sender, p.allowLabels) returns (bool ok) {
            if (!ok) revert NotAllowlisted();
        } catch {
            revert GateFailed();
        }
    }

    function _price(Intent calldata i, uint256 ts) internal view returns (Priced memory priced) {
        _validate(i);
        uint256 quoteOut;
        if (i.mode == Mode.PEGGED) {
            (bool ok, uint256 quote) = _tryQuote(i);
            if (!ok) revert OracleUnavailable();
            quoteOut = quote;
            priced.fairOut = quote;
        } else {
            priced.fairOut = _fairOrZero(i);
        }
        (priced.required, priced.curveBps, priced.base,, priced.elapsed) = RivalMath.requiredAt(
            RivalMath.CurveInput({
                mode: uint8(i.mode),
                baseOut: i.baseOut,
                quoteOut: quoteOut,
                startBps: i.startBps,
                floorBps: i.floorBps,
                startTime: i.startTime,
                decaySecs: i.decaySecs,
                hardMinOut: i.hardMinOut,
                ts: ts
            })
        );
        if (priced.required < i.hardMinOut) revert BelowFloor();
    }

    function _pullAndDeliver(Intent calldata i, bytes calldata makerSig, FillParams calldata p, Priced memory priced)
        internal
    {
        uint256 recipientBefore = i.tokenOut.balanceOf(i.recipient);
        uint256 makerBefore = i.tokenIn.balanceOf(i.maker);
        uint256 selfIn = i.tokenIn.balanceOf(address(this));
        uint256 selfOut = i.tokenOut.balanceOf(address(this));

        permit2.permitWitnessTransferFrom(
            IPermit2Min.PermitTransferFrom({
                permitted: IPermit2Min.TokenPermissions({token: i.tokenIn, amount: i.amountIn}),
                nonce: i.nonce,
                deadline: i.deadline
            }),
            IPermit2Min.SignatureTransferDetails({to: p.inputTo, requestedAmount: i.amountIn}),
            i.maker,
            priced.hash,
            WITNESS_TYPE_STRING,
            makerSig
        );

        uint256 makerAfter = i.tokenIn.balanceOf(i.maker);
        if (makerAfter > makerBefore || makerBefore - makerAfter != i.amountIn) revert DeliveryShort();

        if (p.useCallback) {
            IRivalFill(msg.sender).rivalFillCallback(
                priced.hash, i.tokenIn, i.tokenOut, i.amountIn, priced.required, p.data
            );
        }

        i.tokenOut.safeTransferFrom(msg.sender, i.recipient, priced.required);
        uint256 recipientAfter = i.tokenOut.balanceOf(i.recipient);
        if (recipientAfter < recipientBefore || recipientAfter - recipientBefore < priced.required) {
            revert DeliveryShort();
        }

        _status[priced.hash] = IntentStatus.FILLED;
        _emitAndRecord(i, priced);

        if (i.tokenIn.balanceOf(address(this)) != selfIn || i.tokenOut.balanceOf(address(this)) != selfOut) {
            revert DeliveryShort();
        }
    }

    function _emitAndRecord(Intent calldata i, Priced memory priced) internal {
        (uint256 fairAfter, int256 improvement) = RivalMath.receipt(priced.required, priced.fairOut, poolFee);
        emit Filled(
            priced.hash,
            i.maker,
            msg.sender,
            i.tokenIn,
            i.tokenOut,
            i.amountIn,
            priced.required,
            priced.fairOut,
            fairAfter,
            int32(improvement),
            int32(priced.curveBps),
            priced.elapsed
        );
        if (improvement == RivalMath.IMPROVEMENT_SENTINEL) return;
        registry.onFill(msg.sender, i.maker, int32(improvement));
        try registry.syncRecords(msg.sender) {} catch {}
    }

    function _cancel(bytes32 hash, address maker) internal {
        IntentStatus current = _status[hash];
        if (current == IntentStatus.FILLED) revert AlreadyFilled();
        if (current == IntentStatus.CANCELLED) revert CancelledErr();
        _status[hash] = IntentStatus.CANCELLED;
        emit Cancelled(hash, maker);
    }

    function _validate(Intent calldata i) internal view {
        if (i.maker == address(0) || i.tokenIn == address(0) || i.tokenOut == address(0) || i.recipient == address(0)) {
            revert BadParams();
        }
        if (i.amountIn == 0 || i.hardMinOut == 0) revert BadParams();
        if (i.startBps < -5_000 || i.startBps > 5_000 || i.floorBps < -5_000 || i.floorBps > 5_000) revert BadParams();
        if (i.startBps < i.floorBps) revert BadParams();
        if (i.decaySecs < 10 || i.decaySecs > 3_600) revert BadParams();
        if (i.deadline <= i.startTime || uint256(i.deadline) > uint256(i.startTime) + 86_400) revert BadParams();
        if (i.gate != Gate.NAMED && i.allowlistHash != bytes32(0)) revert BadParams();
        if (i.mode == Mode.PEGGED) {
            if (i.oracleWindow < 60 || i.oracleWindow > 3_600) revert BadParams();
            if (!_isPair(i.tokenIn, i.tokenOut)) revert BadParams();
        }
    }

    /// @dev Pair mismatch or a window outside [60, 3600] is "unavailable" and returns 0 without a call.
    function _fairOrZero(Intent calldata i) internal view returns (uint256) {
        if (!_isPair(i.tokenIn, i.tokenOut)) return 0;
        if (i.oracleWindow < 60 || i.oracleWindow > 3_600) return 0;
        (bool ok, uint256 quote) = _tryQuote(i);
        return ok ? quote : 0;
    }

    /// @dev `InsufficientHistory`, any other quote revert, and a zero quote are all unavailable.
    function _tryQuote(Intent calldata i) internal view returns (bool ok, uint256 amountOut) {
        try oracle.quote(poolKey(), i.tokenIn == currency0, i.amountIn, i.oracleWindow) returns (uint256 quote) {
            if (quote == 0) return (false, 0);
            return (true, quote);
        } catch {
            return (false, 0);
        }
    }

    function _isPair(address tokenIn, address tokenOut) internal view returns (bool) {
        return (tokenIn == currency0 && tokenOut == currency1) || (tokenIn == currency1 && tokenOut == currency0);
    }

    function _buildDomain(uint256 chainId) internal view returns (bytes32) {
        return keccak256(
            abi.encode(_DOMAIN_TYPEHASH, keccak256(bytes(NAME)), keccak256(bytes(VERSION)), chainId, address(this))
        );
    }

    /// @dev 65-byte `r || s || v`. High `s` and `v` outside {27, 28} are {BadSignature} via a zero return.
    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address signer) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) return address(0);
        if (v != 27 && v != 28) return address(0);
        signer = ecrecover(digest, v, r, s);
    }
}
