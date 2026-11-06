// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {SafeTransferLib} from "solady/src/utils/SafeTransferLib.sol";

import {IRivalFill} from "../interfaces/IRivalFill.sol";
import {BadParams, Unauthorized} from "../Types.sol";

/// @title UniswapSolver
/// @notice Fills an intent by swapping the maker's input through a v4 pool inside the settlement callback.
/// @dev `data` is `abi.encode(PoolKey)`. The swap, settle, and take all finish before this call returns.
///      Surplus `tokenOut` stays on this contract. The maker's `tokenIn` does not.
contract UniswapSolver is IRivalFill, IUnlockCallback {
    using SafeTransferLib for address;

    /// @notice The pool paid out less than `requiredOut`, or did not take the full input.
    error Shortfall();

    /// @notice Settlement allowed to call {rivalFillCallback}.
    address public immutable settlement;

    /// @notice Pool manager this solver swaps against.
    IPoolManager public immutable poolManager;

    /// @notice May call {sweep}.
    address public immutable owner;

    struct SwapRequest {
        PoolKey key;
        bool zeroForOne;
        uint256 amountIn;
        uint256 requiredOut;
    }

    constructor(address settlement_, IPoolManager poolManager_, address owner_) {
        if (settlement_ == address(0) || address(poolManager_) == address(0) || owner_ == address(0)) {
            revert BadParams();
        }
        settlement = settlement_;
        poolManager = poolManager_;
        owner = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @inheritdoc IRivalFill
    function rivalFillCallback(
        bytes32,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 requiredOut,
        bytes calldata data
    ) external {
        if (msg.sender != settlement) revert Unauthorized();

        PoolKey memory key = abi.decode(data, (PoolKey));
        poolManager.unlock(
            abi.encode(
                SwapRequest({
                    key: key,
                    zeroForOne: _zeroForOne(key, tokenIn, tokenOut),
                    amountIn: amountIn,
                    requiredOut: requiredOut
                })
            )
        );

        // Maker input must be gone before we return. A revert here undoes the fill.
        if (tokenIn.balanceOf(address(this)) != 0) revert Shortfall();
        if (tokenOut.balanceOf(address(this)) < requiredOut) revert Shortfall();
        tokenOut.safeApprove(settlement, requiredOut);
    }

    /// @inheritdoc IUnlockCallback
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert Unauthorized();
        _swap(abi.decode(data, (SwapRequest)));
        return "";
    }

    /// @notice Send this contract's full balance of `token` to `to`.
    function sweep(address token, address to) external onlyOwner {
        token.safeTransfer(to, token.balanceOf(address(this)));
    }

    function _swap(SwapRequest memory req) internal {
        if (req.amountIn == 0 || req.amountIn > uint256(type(int256).max)) revert Shortfall();

        BalanceDelta delta = poolManager.swap(
            req.key,
            SwapParams({
                zeroForOne: req.zeroForOne,
                amountSpecified: -int256(req.amountIn),
                sqrtPriceLimitX96: req.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        int128 inDelta = req.zeroForOne ? delta.amount0() : delta.amount1();
        int128 outDelta = req.zeroForOne ? delta.amount1() : delta.amount0();
        if (int256(inDelta) != -int256(req.amountIn) || outDelta <= 0) revert Shortfall();
        uint256 got = uint256(uint128(outDelta));
        if (got < req.requiredOut) revert Shortfall();

        _pay(req.zeroForOne ? req.key.currency0 : req.key.currency1, req.amountIn);
        poolManager.take(req.zeroForOne ? req.key.currency1 : req.key.currency0, address(this), got);
    }

    function _pay(Currency currency, uint256 amount) internal {
        poolManager.sync(currency);
        Currency.unwrap(currency).safeTransfer(address(poolManager), amount);
        if (poolManager.settle() != amount) revert Shortfall();
    }

    function _zeroForOne(PoolKey memory key, address tokenIn, address tokenOut) internal pure returns (bool) {
        address c0 = Currency.unwrap(key.currency0);
        address c1 = Currency.unwrap(key.currency1);
        if (tokenIn == c0 && tokenOut == c1) return true;
        if (tokenIn == c1 && tokenOut == c0) return false;
        revert BadParams();
    }
}
