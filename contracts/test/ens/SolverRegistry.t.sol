// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SafeTransferLib} from "solady/src/utils/SafeTransferLib.sol";

import {IStandardRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/interfaces/IStandardRegistry.sol";
import {RegistryRolesLib} from "@ensdomains/contracts-v2/contracts/src/registry/libraries/RegistryRolesLib.sol";

import {SolverRegistry} from "../../src/SolverRegistry.sol";
import {RivalNames} from "../../src/ens/RivalNames.sol";
import {TestToken} from "../../src/tokens/TestToken.sol";
import {LabelUnavailable, Stats, Unauthorized} from "../../src/Types.sol";
import {MockEns} from "./MockEns.sol";

contract FalseReturnToken {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract SolverRegistryTest is Test {
    uint256 internal constant DEPOSIT = 1_000_000;

    TestToken internal token;
    MockEns internal ens;
    RivalNames internal names;
    SolverRegistry internal reg;

    address internal house = makeAddr("house");
    address internal solver = makeAddr("solver");
    address internal other = makeAddr("other");
    address internal settlement = makeAddr("settlement");
    address internal makerA = makeAddr("makerA");
    address internal makerB = makeAddr("makerB");

    function setUp() public {
        token = new TestToken("Test USDC", "tUSDC", 6, address(this));
        ens = new MockEns();
        // RivalNames stores the registry immutably, and the registry stores RivalNames immutably.
        // Deploy names against the address the next CREATE will use.
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        names = new RivalNames(predicted, IStandardRegistry(address(ens)), address(0));
        reg = new SolverRegistry(address(token), DEPOSIT, names, house);
        assertEq(address(reg), predicted);
    }

    function test_registerPullsDepositAndOwnerIsSolver() public {
        _fund(solver, DEPOSIT);
        _register(solver, "atlas");

        assertEq(token.balanceOf(solver), 0);
        assertEq(token.balanceOf(address(reg)), DEPOSIT);
        uint256 tokenId = names.tokenIdOf(solver);
        assertGt(tokenId, 0);
        assertEq(ens.ownerOf(tokenId), solver);
        assertEq(reg.labelOf(solver), "atlas");
        assertTrue(reg.isListed(solver));
        (,,, uint256 roleBitmap) = _rec(tokenId);
        assertEq(roleBitmap, 0);
        assertEq(roleBitmap & RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN, 0);
    }

    function test_transferIsImpossible() public {
        _fund(solver, DEPOSIT);
        _register(solver, "atlas");
        uint256 tokenId = names.tokenIdOf(solver);

        vm.expectRevert(abi.encodeWithSelector(IStandardRegistry.TransferDisallowed.selector, tokenId, solver));
        ens.safeTransferFrom(solver, other, tokenId, 1, "");
        assertEq(ens.ownerOf(tokenId), solver);
    }

    function test_secondNameForSameSolverReverts() public {
        _fund(solver, DEPOSIT * 2);
        _register(solver, "atlas");

        vm.startPrank(solver);
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("other");
        vm.stopPrank();
        assertEq(token.balanceOf(address(reg)), DEPOSIT);
    }

    function test_takenLabelReverts() public {
        _fund(solver, DEPOSIT);
        _fund(other, DEPOSIT);
        _register(solver, "atlas");

        vm.startPrank(other);
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("atlas");
        vm.stopPrank();
        assertEq(token.balanceOf(other), DEPOSIT);
    }

    function test_reservedLabelsRevertAndHouseCanRegisterHouse() public {
        _fund(solver, DEPOSIT * 4);
        _fund(house, DEPOSIT);

        vm.startPrank(solver);
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("rival");
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("admin");
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("official");
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("house");
        vm.stopPrank();
        assertEq(token.balanceOf(address(reg)), 0);

        _register(house, "house");
        assertEq(ens.ownerOf(names.tokenIdOf(house)), house);
        assertTrue(reg.isListed(house));
    }

    function test_badCharsetAndLengthRevert() public {
        _fund(solver, DEPOSIT);
        vm.startPrank(solver);
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("");
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("ab");
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("ABCDEFGHIJKLMNOPQRSTUVWX");
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("Atlas");
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("at_las");
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("a b");
        vm.expectRevert(LabelUnavailable.selector);
        reg.register("abcdefghijklmnopqrstuvwxy");
        vm.stopPrank();
        assertEq(token.balanceOf(solver), DEPOSIT);

        _register(solver, "abc");
        assertTrue(reg.isListed(solver));
    }

    function test_lengthBounds() public {
        _fund(solver, DEPOSIT * 2);
        _register(solver, "abc");
        _exit(solver);
        _register(solver, "abcdefghijklmnopqrstuvwx");
        assertEq(reg.labelOf(solver), "abcdefghijklmnopqrstuvwx");
    }

    function test_issueRevertDoesNotKeepDeposit() public {
        _fund(solver, DEPOSIT);
        ens.setRevertRegister(true);
        vm.startPrank(solver);
        vm.expectRevert(bytes("register failed"));
        reg.register("atlas");
        vm.stopPrank();
        assertEq(token.balanceOf(solver), DEPOSIT);
        assertEq(token.balanceOf(address(reg)), 0);
        assertEq(reg.labelOf(solver), "");

        ens.setRevertRegister(false);
        _register(solver, "atlas");
        assertTrue(reg.isListed(solver));
    }

    function test_falseReturnAndShortBalanceRevert() public {
        FalseReturnToken bad = new FalseReturnToken();
        SolverRegistry badReg = new SolverRegistry(address(bad), DEPOSIT, names, house);
        vm.prank(solver);
        vm.expectRevert(SafeTransferLib.TransferFromFailed.selector);
        badReg.register("atlas");

        vm.prank(solver);
        vm.expectRevert(SafeTransferLib.TransferFromFailed.selector);
        reg.register("atlas");
        assertEq(token.balanceOf(address(reg)), 0);
    }

    function test_exitRefundsExactDepositAndReregisterMintsFreshToken() public {
        _fund(solver, DEPOSIT * 2);
        _register(solver, "atlas");
        uint256 firstId = names.tokenIdOf(solver);

        uint256 before = token.balanceOf(solver);
        _exit(solver);
        assertEq(token.balanceOf(solver) - before, DEPOSIT);
        assertEq(token.balanceOf(address(reg)), 0);
        assertEq(names.tokenIdOf(solver), 0);
        assertFalse(reg.isListed(solver));
        assertEq(reg.labelOf(solver), "");

        _register(solver, "atlas");
        uint256 secondId = names.tokenIdOf(solver);
        assertGt(secondId, 0);
        assertNotEq(secondId, firstId);
        assertEq(ens.ownerOf(secondId), solver);
        assertTrue(reg.isListed(solver));
    }

    function test_exitWithoutListingReverts() public {
        vm.prank(solver);
        vm.expectRevert(Unauthorized.selector);
        reg.exit();
    }

    function test_unregisterRevertKeepsDeposit() public {
        _fund(solver, DEPOSIT);
        _register(solver, "atlas");
        ens.setRevertUnregister(true);
        vm.prank(solver);
        vm.expectRevert(bytes("unregister failed"));
        reg.exit();
        assertEq(token.balanceOf(address(reg)), DEPOSIT);
        assertEq(token.balanceOf(solver), 0);
        assertTrue(reg.isListed(solver));
    }

    function test_setSettlementOnce() public {
        reg.setSettlement(settlement);
        assertEq(reg.settlement(), settlement);
        vm.expectRevert(Unauthorized.selector);
        reg.setSettlement(settlement);
        vm.expectRevert(Unauthorized.selector);
        reg.setSettlement(other);
    }

    function test_onFillOnlySettlementCountsMakersOnceAndSignedSum() public {
        _fund(solver, DEPOSIT);
        _register(solver, "atlas");
        uint256 tokenId = names.tokenIdOf(solver);
        uint64 issuedExpiry = ens.getExpiry(tokenId);

        vm.prank(solver);
        vm.expectRevert(Unauthorized.selector);
        reg.onFill(solver, makerA, 10);

        reg.setSettlement(settlement);
        vm.warp(block.timestamp + 1 days);
        vm.prank(settlement);
        reg.onFill(solver, makerA, -100);
        vm.prank(settlement);
        reg.onFill(solver, makerA, 40);
        vm.prank(settlement);
        reg.onFill(solver, makerB, -5);

        Stats memory stats_ = reg.stats(solver);
        assertEq(stats_.fills, 3);
        assertEq(stats_.makers, 2);
        assertEq(stats_.sumImprovementBps, -65);
        assertEq(stats_.lastFill, uint64(block.timestamp));
        assertGt(ens.getExpiry(tokenId), issuedExpiry);
    }

    function test_renewFailureDoesNotRevertOnFill() public {
        _fund(solver, DEPOSIT);
        _register(solver, "atlas");
        reg.setSettlement(settlement);
        ens.setRevertRenew(true);

        vm.prank(settlement);
        reg.onFill(solver, makerA, 7);
        Stats memory stats_ = reg.stats(solver);
        assertEq(stats_.fills, 1);
        assertEq(stats_.sumImprovementBps, 7);
    }

    function test_syncRecordsAverageTruncatesTowardZero() public {
        _fund(solver, DEPOSIT);
        _register(solver, "atlas");
        reg.setSettlement(settlement);

        vm.startPrank(settlement);
        reg.onFill(solver, makerA, 5);
        reg.onFill(solver, makerB, -1);
        vm.stopPrank();

        reg.syncRecords(solver);
        (uint64 fills, uint64 makers, int256 avg, uint64 lastFill) = names.protocolRecord(solver);
        assertEq(fills, 2);
        assertEq(makers, 2);
        assertEq(avg, 2);
        assertEq(lastFill, uint64(block.timestamp));

        vm.prank(settlement);
        reg.onFill(solver, makerA, -8);
        reg.syncRecords(solver);
        (,, avg,) = names.protocolRecord(solver);
        assertEq(avg, -1);
    }

    function test_isListedFalseWhenOwnerMissingMovedOrReverts() public {
        _fund(solver, DEPOSIT);
        _register(solver, "atlas");
        uint256 tokenId = names.tokenIdOf(solver);
        assertTrue(reg.isListed(solver));

        ens.setOwner(tokenId, address(0));
        assertFalse(reg.isListed(solver));
        assertEq(names.tokenIdOf(solver), tokenId);

        ens.setOwner(tokenId, other);
        assertFalse(reg.isListed(solver));

        ens.setOwner(tokenId, solver);
        ens.setRevertOwnerOf(true);
        assertFalse(reg.isListed(solver));
        ens.setRevertOwnerOf(false);
        assertTrue(reg.isListed(solver));

        assertFalse(reg.isListed(other));
    }

    function test_ownsAnyMatchesKeccakOfLabelBytes() public {
        _fund(solver, DEPOSIT);
        _register(solver, "atlas");
        bytes32 own = keccak256(bytes("atlas"));
        bytes32 otherHash = keccak256(bytes("other"));

        bytes32[] memory hit = new bytes32[](2);
        hit[0] = otherHash;
        hit[1] = own;
        assertTrue(reg.ownsAny(solver, hit));

        bytes32[] memory miss = new bytes32[](1);
        miss[0] = otherHash;
        assertFalse(reg.ownsAny(solver, miss));

        bytes32[] memory empty;
        assertFalse(reg.ownsAny(solver, empty));

        ens.setOwner(names.tokenIdOf(solver), address(0));
        assertFalse(reg.ownsAny(solver, hit));
    }

    function test_syncRecordsRevertsForUnknownAndForgedWriter() public {
        vm.expectRevert(LabelUnavailable.selector);
        reg.syncRecords(solver);

        _fund(solver, DEPOSIT);
        _register(solver, "atlas");
        _exit(solver);
        vm.expectRevert(LabelUnavailable.selector);
        reg.syncRecords(solver);

        vm.prank(other);
        vm.expectRevert(Unauthorized.selector);
        names.syncRecords(solver, 1, 1, 0, 1);

        vm.prank(other);
        vm.expectRevert(Unauthorized.selector);
        names.issue("atlas", other, uint64(block.timestamp + 1 days));
    }

    function test_lapseOwnerZeroSameBlock() public {
        _fund(solver, DEPOSIT);
        _register(solver, "atlas");
        uint256 tokenId = names.tokenIdOf(solver);
        uint64 expiry = ens.getExpiry(tokenId);

        vm.warp(expiry - 1);
        assertTrue(reg.isListed(solver));
        assertEq(ens.ownerOf(tokenId), solver);

        vm.warp(expiry);
        assertEq(ens.ownerOf(tokenId), address(0));
        assertFalse(reg.isListed(solver));
        assertEq(names.tokenIdOf(solver), tokenId);
    }

    function test_productionDepositAmountIsConfigurable() public {
        uint256 production = 100 * 10 ** 6;
        SolverRegistry prod = new SolverRegistry(address(token), production, names, house);
        assertEq(prod.depositAmount(), production);
        assertNotEq(production, DEPOSIT);

        token.mint(solver, production);
        vm.startPrank(solver);
        token.approve(address(prod), production);
        vm.expectRevert(LabelUnavailable.selector);
        prod.register("ab");
        vm.stopPrank();
        assertEq(token.balanceOf(solver), production);
    }

    function _fund(address account, uint256 amount) internal {
        token.mint(account, amount);
        vm.prank(account);
        token.approve(address(reg), type(uint256).max);
    }

    function _register(address account, string memory label) internal {
        vm.prank(account);
        reg.register(label);
    }

    function _exit(address account) internal {
        vm.prank(account);
        reg.exit();
    }

    function _rec(uint256 tokenId) internal view returns (address owner, uint64 expiry, bool exists, uint256 roleBitmap) {
        (owner, expiry, roleBitmap, exists) = ens.recs(tokenId);
    }
}
