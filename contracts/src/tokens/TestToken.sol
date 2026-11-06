// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "solady/src/tokens/ERC20.sol";

/// @notice Test token. One minter. Permit2 allowance stays at infinity.
/// @dev EIP-2612 permit comes from Solady ERC20. No fee and no transfer hook.
contract TestToken is ERC20 {
    error NotMinter();

    string private _name;
    string private _symbol;
    uint8 private immutable _decimals;
    address private immutable _minter;

    constructor(string memory name_, string memory symbol_, uint8 decimals_, address minter_) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        _minter = minter_;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != _minter) revert NotMinter();
        _mint(to, amount);
    }

    function _givePermit2InfiniteAllowance() internal pure override returns (bool) {
        return true;
    }
}
