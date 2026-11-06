// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {TestToken} from "../src/tokens/TestToken.sol";

contract TestTokenTest is Test {
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    TestToken internal token;
    address internal minter = makeAddr("minter");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function setUp() public {
        token = new TestToken("Test WETH", "tWETH", 18, minter);
    }

    function test_permit2AllowanceIsMaxForAnyone() public view {
        assertEq(token.allowance(alice, PERMIT2), type(uint256).max);
        assertEq(token.allowance(bob, PERMIT2), type(uint256).max);
        assertEq(token.allowance(address(0), PERMIT2), type(uint256).max);
        assertEq(token.allowance(address(this), PERMIT2), type(uint256).max);
    }

    function test_decimalsNameAndSymbol() public {
        TestToken six = new TestToken("Test USDC", "tUSDC", 6, minter);
        assertEq(six.decimals(), 6);
        assertEq(six.name(), "Test USDC");
        assertEq(six.symbol(), "tUSDC");
        assertEq(token.decimals(), 18);
    }

    function test_mintOnlyByMinter() public {
        vm.prank(minter);
        token.mint(alice, 1_000);
        assertEq(token.balanceOf(alice), 1_000);
        assertEq(token.totalSupply(), 1_000);

        vm.prank(bob);
        vm.expectRevert(TestToken.NotMinter.selector);
        token.mint(bob, 1);
        assertEq(token.totalSupply(), 1_000);
    }

    function test_transferAndTransferFromHaveNoFee() public {
        vm.prank(minter);
        token.mint(alice, 1_000);

        vm.prank(alice);
        assertTrue(token.transfer(bob, 400));
        assertEq(token.balanceOf(alice), 600);
        assertEq(token.balanceOf(bob), 400);

        vm.prank(alice);
        assertTrue(token.approve(bob, 250));
        assertEq(token.allowance(alice, bob), 250);

        vm.prank(bob);
        assertTrue(token.transferFrom(alice, carol, 250));
        assertEq(token.balanceOf(alice), 350);
        assertEq(token.balanceOf(carol), 250);
        assertEq(token.allowance(alice, bob), 0);
        assertEq(token.balanceOf(alice) + token.balanceOf(bob) + token.balanceOf(carol), token.totalSupply());
    }

    function test_permitIsInherited() public {
        bytes memory callData = abi.encodeWithSignature(
            "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
            alice,
            bob,
            1,
            block.timestamp,
            uint8(0),
            bytes32(0),
            bytes32(0)
        );
        (bool ok,) = address(token).call(callData);
        assertFalse(ok);
    }
}
