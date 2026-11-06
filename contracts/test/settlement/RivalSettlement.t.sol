// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {ECDSA} from "solady/src/utils/ECDSA.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SignatureVerification} from "permit2/src/libraries/SignatureVerification.sol";

import {LocalPermit2} from "./LocalPermit2.sol";

import {RivalSettlement} from "../../src/RivalSettlement.sol";
import {TestToken} from "../../src/tokens/TestToken.sol";
import {IRivalFill} from "../../src/interfaces/IRivalFill.sol";
import {
    AlreadyFilled,
    BadParams,
    BadSignature,
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
} from "../../src/Types.sol";
import {MockOracle} from "./MockOracle.sol";
import {MockRegistry} from "./MockRegistry.sol";

/// @notice Settlement invariants. The S2 fixture is the hash.test.ts sample.
///         permit2Digest matches the permit2-sdk SignatureTransfer hash, and viem signTypedData
///         produced FIXTURE_SIG over that digest.
contract RivalSettlementTest is Test {
    uint256 internal constant MAKER_KEY = 0xA11CE;
    uint32 internal constant T0 = 1_700_000_000;
    uint256 internal constant AMOUNT_IN = 1 ether;
    uint256 internal constant QUOTE = 3_000_000_000;
    uint256 internal constant HARD_MIN = 2_955_000_000;
    uint256 internal constant REQUIRED_0 = 3_006_000_000;

    address internal constant FIXTURE_MAKER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address internal constant FIXTURE_SETTLEMENT = 0x1111111111111111111111111111111111111111;
    address internal constant CANONICAL_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    bytes32 internal constant FIXTURE_STRUCT = 0x39eed9f09b53d1612a58ad768c8d48e172ee6d8afa9b775db00e007f49d3f77f;
    bytes32 internal constant FIXTURE_DIGEST = 0x4580ff53badece96246515300f5511f971a9987d2cbad010712e2c5a39910060;
    bytes32 internal constant WITNESS_HASH = 0xfde62bd1446ff4ef74d997612364f1e6e92d8a99eb15c566983ea70d250e6ae9;

    event Cancelled(bytes32 indexed intentHash, address indexed maker);

    TestToken internal tokenIn;
    TestToken internal tokenOut;
    LocalPermit2 internal permit2;
    MockOracle internal oracle;
    MockRegistry internal registry;
    RivalSettlement internal settlement;

    uint256 internal makerKey;
    address internal maker;
    address internal solver;
    address internal recipient;
    address internal relayer;
    uint256 internal nextNonce = 1;

    function setUp() public {
        vm.warp(T0);
        makerKey = MAKER_KEY;
        maker = vm.addr(makerKey);
        solver = makeAddr("solver");
        recipient = makeAddr("recipient");
        relayer = makeAddr("relayer");

        tokenIn = new TestToken("Test WETH", "tWETH", 18, address(this));
        tokenOut = new TestToken("Test USDC", "tUSDC", 6, address(this));
        permit2 = new LocalPermit2();
        oracle = new MockOracle();
        registry = new MockRegistry();

        (address c0, address c1) = address(tokenIn) < address(tokenOut)
            ? (address(tokenIn), address(tokenOut))
            : (address(tokenOut), address(tokenIn));
        settlement = new RivalSettlement(
            permit2,
            oracle,
            registry,
            RivalSettlement.PairConfig({
                key: PoolKey({
                    currency0: Currency.wrap(c0),
                    currency1: Currency.wrap(c1),
                    fee: 500,
                    tickSpacing: 10,
                    hooks: IHooks(address(oracle))
                })
            })
        );

        tokenIn.mint(maker, 1_000 ether);
        tokenOut.mint(solver, 1e24);
        tokenOut.mint(address(this), 1e24);
        vm.prank(maker);
        tokenIn.approve(address(permit2), type(uint256).max);
        vm.prank(solver);
        tokenOut.approve(address(settlement), type(uint256).max);
    }

    function test_S2_witnessMatchesViemAndSdk() public view {
        Intent memory i = _fixture();
        assertEq(settlement.intentHash(i), FIXTURE_STRUCT);
        assertEq(keccak256(bytes(settlement.WITNESS_TYPE_STRING())), WITNESS_HASH);
        bytes32 domainSep = _permit2Domain(CANONICAL_PERMIT2, 11_155_111);
        assertEq(_permitDigest(i, FIXTURE_SETTLEMENT, domainSep), FIXTURE_DIGEST);
        assertEq(ECDSA.recover(FIXTURE_DIGEST, _fixtureSig()), FIXTURE_MAKER);
    }

    function test_S2_localPermit2DomainMatchesFormula() public view {
        assertEq(permit2.DOMAIN_SEPARATOR(), _permit2Domain(address(permit2), block.chainid));
    }

    function test_I1_I2_directFill_workedReceipt() public {
        Intent memory i = _pegged();
        uint256 makerBefore = tokenIn.balanceOf(maker);
        uint256 recipientBefore = tokenOut.balanceOf(recipient);
        uint256 solverInBefore = tokenIn.balanceOf(solver);
        uint256 solverOutBefore = tokenOut.balanceOf(solver);

        bytes32 hash = settlement.intentHash(i);
        vm.recordLogs();
        _fill(solver, i, false);
        _assertFilled(vm.getRecordedLogs(), hash, solver, REQUIRED_0, QUOTE, 2_998_500_000, 25, 20, 0);

        assertEq(uint256(settlement.status(hash)), uint256(IntentStatus.FILLED));
        assertEq(tokenIn.balanceOf(address(settlement)), 0);
        assertEq(tokenOut.balanceOf(address(settlement)), 0);
        assertEq(makerBefore - tokenIn.balanceOf(maker), AMOUNT_IN);
        assertEq(tokenOut.balanceOf(recipient) - recipientBefore, REQUIRED_0);
        assertGe(tokenOut.balanceOf(recipient) - recipientBefore, i.hardMinOut);
        assertEq(tokenIn.balanceOf(solver) - solverInBefore, AMOUNT_IN);
        assertEq(solverOutBefore - tokenOut.balanceOf(solver), REQUIRED_0);
        assertEq(registry.fills(), 1);
        assertEq(registry.lastSolver(), solver);
        assertEq(registry.lastMaker(), maker);
        assertEq(registry.lastBps(), 25);
        assertEq(registry.syncs(), 1);
    }

    function test_callbackFill() public {
        Intent memory i = _pegged();
        uint256 makerBefore = tokenIn.balanceOf(maker);
        uint256 selfOutBefore = tokenOut.balanceOf(address(this));
        _fill(address(this), i, true);
        assertEq(makerBefore - tokenIn.balanceOf(maker), AMOUNT_IN);
        assertEq(tokenOut.balanceOf(recipient), REQUIRED_0);
        assertEq(selfOutBefore - tokenOut.balanceOf(address(this)), REQUIRED_0);
        assertEq(tokenIn.balanceOf(address(this)), AMOUNT_IN);
        _assertFlat();
        assertEq(registry.fills(), 1);
    }

    function test_I2_hardFloorHolds() public {
        Intent memory i = _pegged();
        i.hardMinOut = 3_010_000_000;
        (uint256 required,,) = settlement.requiredAt(i, T0);
        assertEq(required, 3_010_000_000);
        assertGe(required, i.hardMinOut);
        _fill(solver, i, false);
        assertEq(tokenOut.balanceOf(recipient), required);
        assertEq(registry.lastBps(), 38);
    }

    function test_workedExample_requiredAt() public view {
        Intent memory i = _peggedAt(1);
        _assertCurve(i, T0, 3_006_000_000, 20);
        _assertCurve(i, T0 + 18, 3_003_000_000, 10);
        _assertCurve(i, T0 + 45, 2_998_500_000, -5);
        _assertCurve(i, T0 + 90, 2_991_000_000, -30);
    }

    function testFuzz_I3_I4_requiredBounds(
        uint128 baseOut,
        uint128 hardMinOut,
        uint32 decayRaw,
        uint256 startRaw,
        uint256 floorRaw,
        uint32 step1,
        uint32 step2
    ) public view {
        int32 startBps = int32(int256(bound(startRaw, 0, 10_000))) - 5_000;
        uint256 floorSpan = uint256(int256(startBps) + 5_000);
        int32 floorBps = int32(int256(bound(floorRaw, 0, floorSpan))) - 5_000;
        uint32 decaySecs = uint32(bound(decayRaw, 10, 3_600));
        baseOut = uint128(bound(baseOut, 1, type(uint128).max));
        hardMinOut = uint128(bound(hardMinOut, 1, type(uint128).max));

        Intent memory i = _absolute(baseOut, hardMinOut, startBps, floorBps, decaySecs, 1);
        uint256 t1 = uint256(i.startTime) + bound(step1, 0, uint256(decaySecs) + 10);
        uint256 t2 = t1 + bound(step2, 0, uint256(decaySecs) + 10);
        (uint256 early,,) = settlement.requiredAt(i, uint256(i.startTime) - 1);
        (uint256 r1,,) = settlement.requiredAt(i, t1);
        (uint256 r2,,) = settlement.requiredAt(i, t2);
        assertGe(early, i.hardMinOut);
        assertGe(r1, i.hardMinOut);
        assertGe(r2, i.hardMinOut);
        assertGe(early, r1);
        assertGe(r1, r2);
    }

    function test_I5_replayAndWindow() public {
        Intent memory i = _pegged();
        _fill(solver, i, false);
        _fillRevert(solver, i, false, AlreadyFilled.selector);

        Intent memory early = _pegged();
        uint256 makerBefore = tokenIn.balanceOf(maker);
        vm.warp(T0 - 1);
        _fillRevert(solver, early, false, NotStarted.selector);
        assertEq(tokenIn.balanceOf(maker), makerBefore);

        vm.warp(early.deadline + 1);
        _fillRevert(solver, early, false, Expired.selector);
        assertEq(tokenIn.balanceOf(maker), makerBefore);

        vm.warp(T0);
        _fill(solver, early, false);

        Intent memory atDeadline = _pegged();
        vm.warp(atDeadline.deadline);
        _fill(solver, atDeadline, false);
        assertEq(uint256(settlement.status(settlement.intentHash(atDeadline))), uint256(IntentStatus.FILLED));
    }

    function test_I5_nonceUsedOnDifferentIntent() public {
        Intent memory first = _pegged();
        Intent memory second = _pegged();
        second.deadline = first.deadline - 1;
        second.nonce = first.nonce;
        _fill(solver, first, false);
        _fillRevert(solver, second, false, LocalPermit2.InvalidNonce.selector);
        assertEq(uint256(settlement.status(settlement.intentHash(second))), uint256(IntentStatus.NONE));
    }

    function test_I6_cancelBlocksFill_andFillBlocksCancel() public {
        Intent memory i = _pegged();
        uint256 makerBefore = tokenIn.balanceOf(maker);
        vm.prank(maker);
        settlement.cancel(i);
        assertEq(uint256(settlement.status(settlement.intentHash(i))), uint256(IntentStatus.CANCELLED));
        assertEq(tokenIn.balanceOf(maker), makerBefore);
        _fillRevert(solver, i, false, CancelledErr.selector);
        vm.prank(maker);
        vm.expectRevert(CancelledErr.selector);
        settlement.cancel(i);

        Intent memory filled = _pegged();
        _fill(solver, filled, false);
        vm.prank(maker);
        vm.expectRevert(AlreadyFilled.selector);
        settlement.cancel(filled);

        vm.prank(solver);
        vm.expectRevert(Unauthorized.selector);
        settlement.cancel(_pegged());
    }

    function test_cancelBySig_relayer() public {
        Intent memory i = _pegged();
        bytes32 hash = settlement.intentHash(i);
        uint256 deadline = block.timestamp + 100;
        bytes memory sig = _cancelSig(hash, deadline);
        vm.expectEmit(true, true, false, false, address(settlement));
        emit Cancelled(hash, maker);
        vm.prank(relayer);
        settlement.cancelBySig(hash, deadline, sig);
        assertEq(uint256(settlement.status(hash)), uint256(IntentStatus.CANCELLED));
        _fillRevert(solver, i, false, CancelledErr.selector);

        sig = _cancelSig(hash, deadline);
        vm.prank(relayer);
        vm.expectRevert(CancelledErr.selector);
        settlement.cancelBySig(hash, deadline, sig);
    }

    function test_cancelBySig_deadlineEdgesAndBadSig() public {
        Intent memory live = _pegged();
        bytes32 hash = settlement.intentHash(live);
        bytes memory nowSig = _cancelSig(hash, block.timestamp);
        vm.prank(relayer);
        settlement.cancelBySig(hash, block.timestamp, nowSig);
        assertEq(uint256(settlement.status(hash)), uint256(IntentStatus.CANCELLED));

        bytes32 other = settlement.intentHash(_pegged());
        bytes memory expired = _cancelSig(other, block.timestamp - 1);
        vm.expectRevert(Expired.selector);
        settlement.cancelBySig(other, block.timestamp - 1, expired);
        vm.expectRevert(BadSignature.selector);
        settlement.cancelBySig(other, block.timestamp + 10, hex"11");
        assertEq(uint256(settlement.status(other)), uint256(IntentStatus.NONE));

        Intent memory filled = _pegged();
        bytes32 filledHash = settlement.intentHash(filled);
        bytes memory late = _cancelSig(filledHash, block.timestamp + 10);
        _fill(solver, filled, false);
        vm.expectRevert(AlreadyFilled.selector);
        settlement.cancelBySig(filledHash, block.timestamp + 10, late);
    }

    function test_I7_listedAndNamedAndOpen() public {
        Intent memory listed = _pegged();
        listed.gate = Gate.LISTED;
        _fill(solver, listed, false);

        registry.setListed(false);
        Intent memory denied = _pegged();
        denied.gate = Gate.LISTED;
        _fillRevert(solver, denied, false, NotListed.selector);

        registry.setFailListed(true);
        Intent memory boom = _pegged();
        boom.gate = Gate.LISTED;
        _fillRevert(solver, boom, false, GateFailed.selector);
        registry.setFailListed(false);
        registry.setListed(true);

        bytes32[] memory labels = new bytes32[](1);
        labels[0] = keccak256("atlas");
        Intent memory named = _pegged();
        named.gate = Gate.NAMED;
        named.allowlistHash = keccak256(abi.encodePacked(labels));
        _fillNamed(solver, named, labels);

        named = _pegged();
        named.gate = Gate.NAMED;
        named.allowlistHash = keccak256("nope");
        _fillNamedRevert(solver, named, labels, BadParams.selector);

        named = _pegged();
        named.gate = Gate.NAMED;
        named.allowlistHash = keccak256(abi.encodePacked(labels));
        registry.setOwns(false);
        _fillNamedRevert(solver, named, labels, NotAllowlisted.selector);

        registry.setFailOwns(true);
        _fillNamedRevert(solver, _named(labels), labels, GateFailed.selector);
        registry.setFailOwns(false);
        registry.setOwns(true);

        registry.setFailListed(true);
        registry.setFailOwns(true);
        uint256 fillsBefore = registry.fills();
        vm.expectCall(address(registry), abi.encodeWithSelector(registry.isListed.selector), 0);
        vm.expectCall(address(registry), abi.encodeWithSelector(registry.ownsAny.selector), 0);
        _fill(solver, _pegged(), false);
        assertEq(registry.fills(), fillsBefore + 1);
    }

    function test_oracleUnavailable_peggedReverts_absoluteSentinel() public {
        Intent memory pegged = _pegged();
        oracle.setQuote(0);
        _fillRevert(solver, pegged, false, OracleUnavailable.selector);
        assertEq(tokenIn.balanceOf(maker), 1_000 ether);

        oracle.setQuote(QUOTE);
        oracle.setInsufficient(true);
        _fillRevert(solver, _pegged(), false, OracleUnavailable.selector);

        oracle.setInsufficient(false);
        oracle.setBoom(true);
        _fillRevert(solver, _pegged(), false, OracleUnavailable.selector);
        oracle.setBoom(false);

        oracle.setInsufficient(true);
        Intent memory absolute = _absolute(uint128(QUOTE), 1, 20, -30, 90, nextNonce++);
        uint256 fillsBefore = registry.fills();
        vm.recordLogs();
        _fill(solver, absolute, false);
        assertEq(registry.fills(), fillsBefore);
        assertEq(registry.syncs(), 0);
        assertEq(_filledImprovement(vm.getRecordedLogs()), type(int32).min);
        assertEq(tokenOut.balanceOf(recipient) > 0, true);
    }

    function test_absolute_fairQuoteWhenOracleWorks() public {
        Intent memory i = _absolute(uint128(QUOTE), uint128(HARD_MIN), 20, -30, 90, nextNonce++);
        _fill(solver, i, false);
        assertEq(registry.lastBps(), 25);
        assertEq(registry.fills(), 1);
    }

    function test_quoteDirection() public {
        oracle.setEcho(true);
        Intent memory i = _pegged();
        (,, uint256 base) = settlement.requiredAt(i, T0);
        assertEq(base, i.tokenIn == settlement.currency0() ? 111 : 222);
    }

    function test_badParams() public {
        Intent memory i = _pegged();
        i.amountIn = 0;
        vm.expectRevert(BadParams.selector);
        settlement.requiredAt(i, T0);

        i = _pegged();
        i.hardMinOut = 0;
        vm.expectRevert(BadParams.selector);
        settlement.requiredAt(i, T0);

        i = _pegged();
        i.floorBps = 100;
        i.startBps = 0;
        vm.expectRevert(BadParams.selector);
        settlement.requiredAt(i, T0);

        i = _pegged();
        i.startBps = 5_001;
        vm.expectRevert(BadParams.selector);
        settlement.requiredAt(i, T0);

        i = _pegged();
        i.decaySecs = 9;
        vm.expectRevert(BadParams.selector);
        settlement.requiredAt(i, T0);

        i = _pegged();
        i.deadline = i.startTime;
        vm.expectRevert(BadParams.selector);
        settlement.requiredAt(i, T0);

        i = _pegged();
        i.deadline = i.startTime + 86_401;
        vm.expectRevert(BadParams.selector);
        settlement.requiredAt(i, T0);

        i = _pegged();
        i.deadline = i.startTime + 86_400;
        settlement.requiredAt(i, T0);

        i = _pegged();
        i.oracleWindow = 59;
        vm.expectRevert(BadParams.selector);
        settlement.requiredAt(i, T0);

        i = _pegged();
        i.tokenOut = makeAddr("other");
        vm.expectRevert(BadParams.selector);
        settlement.requiredAt(i, T0);

        i = _pegged();
        i.gate = Gate.OPEN;
        i.allowlistHash = bytes32(uint256(1));
        vm.expectRevert(BadParams.selector);
        settlement.requiredAt(i, T0);
    }

    function test_selfFill_revertsAndLeavesNonce() public {
        Intent memory i = _pegged();
        _fillRevert(maker, i, false, SelfFill.selector);
        _fillRevert(recipient, i, false, SelfFill.selector);
        _fill(solver, i, false);
        assertEq(uint256(settlement.status(settlement.intentHash(i))), uint256(IntentStatus.FILLED));
    }

    function test_forgedSignature_reverts() public {
        Intent memory i = _pegged();
        bytes memory sig = _sign(i, 0xBEEF);
        uint256 makerBefore = tokenIn.balanceOf(maker);
        vm.expectRevert(SignatureVerification.InvalidSigner.selector);
        vm.prank(solver);
        settlement.fill(i, sig, _params(solver, false, new bytes32[](0)));
        assertEq(tokenIn.balanceOf(maker), makerBefore);
        assertEq(uint256(settlement.status(settlement.intentHash(i))), uint256(IntentStatus.NONE));
    }

    function test_deliveryShort_feeOnTransfer() public {
        FeeToken fee = new FeeToken(address(this));
        fee.mint(solver, 1e24);
        vm.prank(solver);
        fee.approve(address(settlement), type(uint256).max);
        Intent memory i = _absolute(uint128(QUOTE), uint128(HARD_MIN), 20, -30, 90, nextNonce++);
        i.tokenOut = address(fee);
        uint256 makerBefore = tokenIn.balanceOf(maker);
        _fillRevert(solver, i, false, DeliveryShort.selector);
        assertEq(tokenIn.balanceOf(maker), makerBefore);
        assertEq(fee.balanceOf(recipient), 0);
    }

    function test_delivery_falseReturn() public {
        FalseToken fake = new FalseToken();
        Intent memory i = _absolute(uint128(QUOTE), 1, 20, -30, 90, nextNonce++);
        i.tokenOut = address(fake);
        _fillRevertAny(solver, i, false);
        assertEq(uint256(settlement.status(settlement.intentHash(i))), uint256(IntentStatus.NONE));
    }

    function test_onFillRevert_undoesFill_syncRevertDoesNot() public {
        Intent memory i = _pegged();
        registry.setFailFill(true);
        uint256 makerBefore = tokenIn.balanceOf(maker);
        _fillRevert(solver, i, false, Unauthorized.selector);
        assertEq(tokenIn.balanceOf(maker), makerBefore);
        assertEq(uint256(settlement.status(settlement.intentHash(i))), uint256(IntentStatus.NONE));

        registry.setFailFill(false);
        registry.setFailSync(true);
        vm.expectCall(address(registry), abi.encodeCall(MockRegistry.syncRecords, (solver)));
        _fill(solver, i, false);
        assertEq(uint256(settlement.status(settlement.intentHash(i))), uint256(IntentStatus.FILLED));
        assertEq(tokenIn.balanceOf(maker), makerBefore - AMOUNT_IN);
        assertEq(registry.syncs(), 0);
        assertEq(registry.fills(), 1);
    }

    function test_I10_solverReenterCannotFillTwice() public {
        ReenterSolver attacker = new ReenterSolver(settlement, tokenOut);
        tokenOut.mint(address(attacker), 1e24);
        Intent memory first = _pegged();
        Intent memory second = _pegged();
        attacker.arm(second, _sign(second, makerKey), _params(address(attacker), true, new bytes32[](0)));

        bytes memory firstSig = _sign(first, makerKey);
        vm.prank(address(attacker));
        settlement.fill(first, firstSig, _params(address(attacker), true, new bytes32[](0)));

        assertEq(uint256(settlement.status(settlement.intentHash(first))), uint256(IntentStatus.FILLED));
        assertEq(uint256(settlement.status(settlement.intentHash(second))), uint256(IntentStatus.NONE));
        assertEq(_selector(attacker.caught()), bytes4(keccak256("Reentrancy()")));
        assertEq(tokenIn.balanceOf(maker), 1_000 ether - AMOUNT_IN);
        _assertFlat();

        bytes memory secondSig = _sign(second, makerKey);
        vm.prank(address(attacker));
        settlement.fill(second, secondSig, _params(address(attacker), true, new bytes32[](0)));
        assertEq(uint256(settlement.status(settlement.intentHash(second))), uint256(IntentStatus.FILLED));
    }

    function test_I10_tokenReenterCannotFillTwice() public {
        ReenterToken mal = new ReenterToken(address(this));
        mal.mint(solver, 1e24);
        vm.prank(solver);
        mal.approve(address(settlement), type(uint256).max);

        Intent memory first = _absolute(uint128(QUOTE), 1, 20, -30, 90, nextNonce++);
        first.tokenOut = address(mal);
        Intent memory second = _absolute(uint128(QUOTE), 1, 20, -30, 90, nextNonce++);
        second.tokenOut = address(mal);
        mal.mint(address(mal), 1e24);
        mal.arm(settlement, second, _sign(second, makerKey), _params(address(mal), false, new bytes32[](0)));

        uint256 makerBefore = tokenIn.balanceOf(maker);
        bytes memory firstSig = _sign(first, makerKey);
        vm.prank(solver);
        settlement.fill(first, firstSig, _params(solver, false, new bytes32[](0)));

        assertEq(uint256(settlement.status(settlement.intentHash(first))), uint256(IntentStatus.FILLED));
        assertEq(uint256(settlement.status(settlement.intentHash(second))), uint256(IntentStatus.NONE));
        assertEq(_selector(mal.caught()), bytes4(keccak256("Reentrancy()")));
        assertEq(makerBefore - tokenIn.balanceOf(maker), AMOUNT_IN);
        assertEq(tokenIn.balanceOf(address(settlement)), 0);
        assertEq(mal.balanceOf(address(settlement)), 0);

        bytes memory secondSig = _sign(second, makerKey);
        vm.prank(address(mal));
        settlement.fill(second, secondSig, _params(address(mal), false, new bytes32[](0)));
        assertEq(uint256(settlement.status(settlement.intentHash(second))), uint256(IntentStatus.FILLED));
    }

    function rivalFillCallback(bytes32, address, address token, uint256, uint256 requiredOut, bytes calldata) external {
        if (msg.sender != address(settlement)) revert Unauthorized();
        TestToken(token).approve(msg.sender, requiredOut);
    }

    function _fill(address who, Intent memory i, bool callback) internal {
        _submit(who, i, _sign(i, makerKey), _params(who, callback, new bytes32[](0)));
    }

    function _fillNamed(address who, Intent memory i, bytes32[] memory labels) internal {
        _submit(who, i, _sign(i, makerKey), _params(who, false, labels));
    }

    /// @dev Sign before `expectRevert` / `prank`. Those cheats apply to the next external call,
    ///      and signing calls `intentHash`.
    function _fillRevert(address who, Intent memory i, bool callback, bytes4 sel) internal {
        bytes memory sig = _sign(i, makerKey);
        FillParams memory p = _params(who, callback, new bytes32[](0));
        vm.expectRevert(sel);
        _submit(who, i, sig, p);
    }

    function _fillNamedRevert(address who, Intent memory i, bytes32[] memory labels, bytes4 sel) internal {
        bytes memory sig = _sign(i, makerKey);
        FillParams memory p = _params(who, false, labels);
        vm.expectRevert(sel);
        _submit(who, i, sig, p);
    }

    function _fillRevertAny(address who, Intent memory i, bool callback) internal {
        bytes memory sig = _sign(i, makerKey);
        FillParams memory p = _params(who, callback, new bytes32[](0));
        vm.expectRevert();
        _submit(who, i, sig, p);
    }

    function _submit(address who, Intent memory i, bytes memory sig, FillParams memory p) internal {
        vm.prank(who);
        settlement.fill(i, sig, p);
    }

    function _sign(Intent memory i, uint256 key) internal view returns (bytes memory) {
        bytes32 digest = _permitDigest(i, address(settlement), permit2.DOMAIN_SEPARATOR());
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _cancelSig(bytes32 hash, uint256 deadline) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(makerKey, settlement.cancelDigest(hash, deadline));
        return abi.encodePacked(r, s, v);
    }

    function _permitDigest(Intent memory i, address spender, bytes32 domainSep) internal view returns (bytes32) {
        bytes32 witness = settlement.intentHash(i);
        bytes32 typeHash = keccak256(
            abi.encodePacked(
                "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,",
                settlement.WITNESS_TYPE_STRING()
            )
        );
        bytes32 tokenHash = keccak256(
            abi.encode(keccak256("TokenPermissions(address token,uint256 amount)"), i.tokenIn, uint256(i.amountIn))
        );
        bytes32 structHash = keccak256(abi.encode(typeHash, tokenHash, spender, i.nonce, uint256(i.deadline), witness));
        return keccak256(abi.encodePacked(hex"1901", domainSep, structHash));
    }

    function _permit2Domain(address verifying, uint256 chainId) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256("Permit2"),
                chainId,
                verifying
            )
        );
    }

    function _params(address to, bool callback, bytes32[] memory labels) internal pure returns (FillParams memory) {
        return FillParams({inputTo: to, useCallback: callback, data: "", allowLabels: labels});
    }

    function _pegged() internal returns (Intent memory) {
        return _peggedAt(nextNonce++);
    }

    function _peggedAt(uint256 nonce) internal view returns (Intent memory i) {
        i = _skeleton(nonce);
        i.mode = Mode.PEGGED;
        i.baseOut = 0;
        i.oracleWindow = 60;
        i.hardMinOut = uint128(HARD_MIN);
    }

    function _named(bytes32[] memory labels) internal returns (Intent memory i) {
        i = _pegged();
        i.gate = Gate.NAMED;
        i.allowlistHash = keccak256(abi.encodePacked(labels));
    }

    function _absolute(uint128 baseOut, uint128 hardMinOut, int32 startBps, int32 floorBps, uint32 decaySecs, uint256 nonce)
        internal
        view
        returns (Intent memory i)
    {
        i = _skeleton(nonce);
        i.mode = Mode.ABSOLUTE;
        i.baseOut = baseOut;
        i.oracleWindow = 60;
        i.hardMinOut = hardMinOut;
        i.startBps = startBps;
        i.floorBps = floorBps;
        i.decaySecs = decaySecs;
        i.deadline = T0 + 3_600;
    }

    function _skeleton(uint256 nonce) internal view returns (Intent memory i) {
        i.maker = maker;
        i.tokenIn = address(tokenIn);
        i.tokenOut = address(tokenOut);
        i.amountIn = uint128(AMOUNT_IN);
        i.recipient = recipient;
        i.mode = Mode.ABSOLUTE;
        i.startBps = 20;
        i.floorBps = -30;
        i.startTime = T0;
        i.decaySecs = 90;
        i.deadline = T0 + 150;
        i.hardMinOut = 1;
        i.gate = Gate.OPEN;
        i.nonce = nonce;
    }

    function _fixture() internal pure returns (Intent memory i) {
        i.maker = FIXTURE_MAKER;
        i.tokenIn = 0x2222222222222222222222222222222222222222;
        i.tokenOut = 0x3333333333333333333333333333333333333333;
        i.amountIn = uint128(AMOUNT_IN);
        i.recipient = FIXTURE_MAKER;
        i.mode = Mode.PEGGED;
        i.baseOut = 0;
        i.oracleWindow = 60;
        i.startBps = 20;
        i.floorBps = -30;
        i.startTime = T0;
        i.decaySecs = 90;
        i.deadline = T0 + 150;
        i.hardMinOut = uint128(HARD_MIN);
        i.gate = Gate.NAMED;
        i.allowlistHash = 0x20ee8f1366f06926e9e8771d8fb9007a8537c8dfdb6a3f8c2cfd64db19d2ec90;
        i.nonce = 7;
    }

    function _fixtureSig() internal pure returns (bytes memory) {
        return hex"5841672b98037cca791fc9b5d6d44e32296431ea108b8cf295baa290ff964f423b31d05bc5495f1e6330fc6f51ec759dc6ee15a1482e7fe1cbb625fe563d2a911b";
    }

    function _assertCurve(Intent memory i, uint256 ts, uint256 required, int256 curveBps) internal view {
        (uint256 gotRequired, int256 gotBps, uint256 base) = settlement.requiredAt(i, ts);
        assertEq(gotRequired, required);
        assertEq(gotBps, curveBps);
        assertEq(base, QUOTE);
        assertGe(gotRequired, i.hardMinOut);
    }

    function _assertFlat() internal view {
        assertEq(tokenIn.balanceOf(address(settlement)), 0);
        assertEq(tokenOut.balanceOf(address(settlement)), 0);
    }

    function _assertFilled(
        Vm.Log[] memory logs,
        bytes32 hash,
        address solver_,
        uint256 amountOut,
        uint256 fairOut,
        uint256 fairAfter,
        int32 improvement,
        int32 curveBps,
        uint32 elapsed
    ) internal view {
        bytes32 topic = keccak256(
            "Filled(bytes32,address,address,address,address,uint256,uint256,uint256,uint256,int32,int32,uint32)"
        );
        for (uint256 n; n < logs.length; ++n) {
            if (logs[n].topics[0] != topic) continue;
            assertEq(logs[n].topics[1], hash);
            assertEq(address(uint160(uint256(logs[n].topics[2]))), maker);
            assertEq(address(uint160(uint256(logs[n].topics[3]))), solver_);
            bytes memory data = logs[n].data;
            assertEq(address(uint160(_word(data, 0))), address(tokenIn));
            assertEq(address(uint160(_word(data, 1))), address(tokenOut));
            assertEq(_word(data, 2), AMOUNT_IN);
            assertEq(_word(data, 3), amountOut);
            assertEq(_word(data, 4), fairOut);
            assertEq(_word(data, 5), fairAfter);
            assertEq(int32(int256(_word(data, 6))), improvement);
            assertEq(int32(int256(_word(data, 7))), curveBps);
            assertEq(uint32(_word(data, 8)), elapsed);
            return;
        }
        revert("missing Filled");
    }

    function _word(bytes memory data, uint256 index) internal pure returns (uint256 w) {
        assembly {
            w := mload(add(add(data, 32), mul(index, 32)))
        }
    }

    function _filledImprovement(Vm.Log[] memory logs) internal pure returns (int32 improvement) {
        bytes32 topic = keccak256(
            "Filled(bytes32,address,address,address,address,uint256,uint256,uint256,uint256,int32,int32,uint32)"
        );
        for (uint256 n; n < logs.length; ++n) {
            if (logs[n].topics[0] != topic) continue;
            (
                ,
                ,
                ,
                ,
                ,
                ,
                improvement,
                ,
            ) = abi.decode(
                logs[n].data, (address, address, uint256, uint256, uint256, uint256, int32, int32, uint32)
            );
        }
    }

    function _selector(bytes memory data) internal pure returns (bytes4 out) {
        assembly {
            out := mload(add(data, 32))
        }
    }
}

/// @notice Callback solver that tries to fill a second intent before approving the first.
contract ReenterSolver is IRivalFill {
    RivalSettlement public immutable settlement;
    TestToken public immutable tokenOut;
    Intent internal other;
    bytes internal otherSig;
    FillParams internal otherParams;
    bool public armed;
    bool public attacked;
    bytes public caught;

    constructor(RivalSettlement settlement_, TestToken tokenOut_) {
        settlement = settlement_;
        tokenOut = tokenOut_;
    }

    function arm(Intent calldata i, bytes calldata sig, FillParams calldata p) external {
        other = i;
        otherSig = sig;
        otherParams = p;
        armed = true;
    }

    function rivalFillCallback(bytes32, address, address, uint256, uint256 requiredOut, bytes calldata) external {
        if (msg.sender != address(settlement)) revert Unauthorized();
        if (armed && !attacked) {
            attacked = true;
            Intent memory i = other;
            bytes memory sig = otherSig;
            FillParams memory p = otherParams;
            try settlement.fill(i, sig, p) {}
            catch (bytes memory ret) {
                caught = ret;
            }
        }
        tokenOut.approve(msg.sender, requiredOut);
    }
}

/// @notice `tokenOut` whose `transferFrom` tries to fill a second intent.
contract ReenterToken is TestToken {
    RivalSettlement public settlement;
    Intent internal other;
    bytes internal otherSig;
    FillParams internal otherParams;
    bool public armed;
    bool public attacked;
    bytes public caught;

    constructor(address minter) TestToken("Malicious", "MAL", 18, minter) {}

    function arm(RivalSettlement s, Intent calldata i, bytes calldata sig, FillParams calldata p) external {
        settlement = s;
        other = i;
        otherSig = sig;
        otherParams = p;
        armed = true;
        _approve(address(this), address(s), type(uint256).max);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (armed && !attacked && msg.sender == address(settlement)) {
            attacked = true;
            Intent memory i = other;
            bytes memory sig = otherSig;
            FillParams memory p = otherParams;
            try settlement.fill(i, sig, p) {}
            catch (bytes memory ret) {
                caught = ret;
            }
        }
        return super.transferFrom(from, to, amount);
    }
}

/// @notice Delivers 90% and keeps 10%. Settlement must revert {DeliveryShort}.
contract FeeToken is TestToken {
    constructor(address minter) TestToken("Fee", "FEE", 18, minter) {}

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        uint256 fee = amount / 10;
        _transfer(from, to, amount - fee);
        _transfer(from, address(this), fee);
        return true;
    }
}

contract FalseToken {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }

    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }
}
