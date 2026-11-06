// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IPermit2Min
/// @notice The Permit2 surface Rival calls. Struct layout matches `ISignatureTransfer` in Uniswap/permit2 (fetched from `main` on 6 Nov 2026).
/// @dev Only the single-token witness transfer and the nonce bitmap are included. Batch transfers and `invalidateUnorderedNonces` are not used.
///      Field order is ABI-significant and must stay aligned with Permit2.
///      Canonical Sepolia Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`.
interface IPermit2Min {
    /// @notice Token and maximum amount the owner signs over.
    struct TokenPermissions {
        /// @notice ERC-20 being spent.
        address token;
        /// @notice Maximum amount the spender may pull.
        uint256 amount;
    }

    /// @notice Signed single-token permit. The spender is bound by Permit2 to `msg.sender` (settlement).
    struct PermitTransferFrom {
        /// @notice Permitted token and cap.
        TokenPermissions permitted;
        /// @notice Unordered nonce. The bit at word `nonce >> 8`, mask `1 << uint8(nonce)`, must be clear.
        uint256 nonce;
        /// @notice Unix deadline of the permit. Rival passes `Intent.deadline`.
        uint256 deadline;
    }

    /// @notice Where Permit2 sends the tokens, and how much of the permitted cap to send.
    struct SignatureTransferDetails {
        /// @notice Recipient of the tokens. Rival passes `FillParams.inputTo`.
        address to;
        /// @notice Amount to transfer. Must be `<= permitted.amount`. Rival passes `Intent.amountIn`.
        uint256 requestedAmount;
    }

    /// @notice Read the unordered-nonce bitmap for `owner` at `wordPos`.
    /// @param owner Token owner (the maker).
    /// @param wordPos `nonce >> 8`. Capped at `type(uint248).max` by Permit2.
    /// @return bitmap Bits already consumed. A set bit means that nonce was used.
    function nonceBitmap(address owner, uint256 wordPos) external view returns (uint256 bitmap);

    /// @notice Pull tokens using a Permit2 signature that also commits to `witness`.
    /// @param permit Permit signed by `owner`. `permitted.token` is `tokenIn`, `permitted.amount` is `amountIn`, `deadline` is the intent deadline.
    /// @param transferDetails Recipient and requested amount.
    /// @param owner Maker. Must equal the recovered signer (or pass EIP-1271).
    /// @param witness EIP-712 struct hash of the Rival `Intent` (`IRivalSettlement.intentHash`).
    /// @param witnessTypeString Permit2 witness suffix: the `Intent` type definition followed by `TokenPermissions(address token,uint256 amount)`.
    /// @param signature Maker's EIP-712 signature over the Permit2 witness digest.
    /// @dev Reverts inside Permit2 with `InvalidSigner` when the witness string or digest does not match, `InvalidNonce` when the nonce bit is set, and `InvalidAmount` when `requestedAmount` exceeds the permit.
    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external;
}
