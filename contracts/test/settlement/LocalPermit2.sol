// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SafeTransferLib} from "solady/src/utils/SafeTransferLib.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";
import {PermitHash} from "permit2/src/libraries/PermitHash.sol";
import {SignatureVerification} from "permit2/src/libraries/SignatureVerification.sol";

import {IPermit2Min} from "../../src/interfaces/IPermit2Min.sol";

/// @notice Witness-transfer shell around the pinned Permit2 hash and signature libraries.
/// @dev `contracts/lib/permit2/src/Permit2.sol` is `pragma solidity 0.8.17` and imports solmate,
///      which is not checked out. This contract keeps Permit2's domain, nonce bitmap, and
///      `hashWithWitness` (via the pinned library) so a viem witness signature verifies here.
contract LocalPermit2 is IPermit2Min {
    using SafeTransferLib for address;
    using PermitHash for ISignatureTransfer.PermitTransferFrom;
    using SignatureVerification for bytes;

    error SignatureExpired(uint256 signatureDeadline);
    error InvalidNonce();
    error InvalidAmount(uint256 maxAmount);

    bytes32 private immutable _cachedDomainSeparator;
    uint256 private immutable _cachedChainId;
    bytes32 private constant _HASHED_NAME = keccak256("Permit2");
    bytes32 private constant _TYPE_HASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    mapping(address owner => mapping(uint256 word => uint256 bitmap)) internal _nonceBitmap;

    constructor() {
        _cachedChainId = block.chainid;
        _cachedDomainSeparator = _buildDomainSeparator();
    }

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return block.chainid == _cachedChainId ? _cachedDomainSeparator : _buildDomainSeparator();
    }

    /// @inheritdoc IPermit2Min
    function nonceBitmap(address owner, uint256 wordPos) external view returns (uint256) {
        return _nonceBitmap[owner][wordPos];
    }

    /// @inheritdoc IPermit2Min
    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external {
        if (block.timestamp > permit.deadline) revert SignatureExpired(permit.deadline);
        if (transferDetails.requestedAmount > permit.permitted.amount) revert InvalidAmount(permit.permitted.amount);

        _useUnorderedNonce(owner, permit.nonce);

        ISignatureTransfer.PermitTransferFrom memory hashed = ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: permit.permitted.token, amount: permit.permitted.amount
            }),
            nonce: permit.nonce,
            deadline: permit.deadline
        });
        signature.verify(_hashTypedData(hashed.hashWithWitness(witness, witnessTypeString)), owner);
        permit.permitted.token.safeTransferFrom(owner, transferDetails.to, transferDetails.requestedAmount);
    }

    function _useUnorderedNonce(address from, uint256 nonce) internal {
        uint256 wordPos = uint248(nonce >> 8);
        uint256 bit = 1 << uint8(nonce);
        uint256 flipped = _nonceBitmap[from][wordPos] ^= bit;
        if (flipped & bit == 0) revert InvalidNonce();
    }

    function _hashTypedData(bytes32 dataHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", DOMAIN_SEPARATOR(), dataHash));
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(_TYPE_HASH, _HASHED_NAME, block.chainid, address(this)));
    }
}
