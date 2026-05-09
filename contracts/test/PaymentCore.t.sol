// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2}  from "forge-std/Test.sol";
import {PaymentCore}     from "../src/PaymentCore.sol";
import {FeeManager}      from "../src/FeeManager.sol";
import {IPaymentCore}    from "../src/interfaces/IPaymentCore.sol";
import {MockERC20}       from "./mocks/MockERC20.sol";

contract PaymentCoreTest is Test {
    PaymentCore  core;
    FeeManager   fm;
    MockERC20    usdc;

    address admin    = makeAddr("admin");
    address treasury = makeAddr("treasury");
    address merchant = makeAddr("merchant");
    address payer    = makeAddr("payer");
    address noRole   = makeAddr("noRole");

    uint256 constant ONE_USDC    = 1_000_000;     // 6 decimals
    uint256 constant FIFTY_USDC  = 50_000_000;
    uint256 constant FLAT_FEE    = 2_000;          // default tier-0 flat fee

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        fm   = new FeeManager(admin);
        core = new PaymentCore(admin, treasury, address(fm));

        // Admin registers token and merchant
        vm.startPrank(admin);
        core.addSupportedToken(address(usdc));
        core.registerMerchant(merchant, "Acme Shop");
        vm.stopPrank();

        // Fund payer and approve PaymentCore
        usdc.mint(payer, 1_000 * ONE_USDC);
        vm.prank(payer);
        usdc.approve(address(core), type(uint256).max);
    }

    // ─── Merchant Registry ────────────────────────────────────────────────────

    function testRegisterMerchant_success() public view {
        PaymentCore.MerchantInfo memory info = core.getMerchant(merchant);
        assertTrue(info.registered);
        assertEq(info.name, "Acme Shop");
        assertEq(info.totalReceived, 0);
        assertGt(info.registeredAt, 0);
    }

    function testRegisterMerchant_emitsEvent() public {
        address m2 = makeAddr("m2");
        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit IPaymentCore.MerchantRegistered(m2, "Shop 2");
        core.registerMerchant(m2, "Shop 2");
    }

    function testRegisterMerchant_unauthorised() public {
        vm.prank(noRole);
        vm.expectRevert();
        core.registerMerchant(makeAddr("x"), "X");
    }

    function testRegisterMerchant_duplicate() public {
        vm.prank(admin);
        vm.expectRevert("PaymentCore: already registered");
        core.registerMerchant(merchant, "Dup");
    }

    function testRegisterMerchant_zeroAddress() public {
        vm.prank(admin);
        vm.expectRevert("PaymentCore: zero address");
        core.registerMerchant(address(0), "Zero");
    }

    function testRegisterMerchant_emptyName() public {
        vm.prank(admin);
        vm.expectRevert("PaymentCore: empty name");
        core.registerMerchant(makeAddr("x"), "");
    }

    function testDeregisterMerchant_success() public {
        vm.prank(admin);
        core.deregisterMerchant(merchant);
        assertFalse(core.getMerchant(merchant).registered);
    }

    function testDeregisterMerchant_notRegistered() public {
        vm.prank(admin);
        vm.expectRevert("PaymentCore: not registered");
        core.deregisterMerchant(makeAddr("ghost"));
    }

    // ─── Token Whitelist ──────────────────────────────────────────────────────

    function testAddSupportedToken() public {
        address tok = makeAddr("tok");
        vm.prank(admin);
        core.addSupportedToken(tok);
        assertTrue(core.isSupportedToken(tok));
    }

    function testRemoveSupportedToken() public {
        vm.prank(admin);
        core.removeSupportedToken(address(usdc));
        assertFalse(core.isSupportedToken(address(usdc)));
    }

    function testAddSupportedToken_zeroAddress() public {
        vm.prank(admin);
        vm.expectRevert("PaymentCore: zero address");
        core.addSupportedToken(address(0));
    }

    // ─── pay() — happy path ───────────────────────────────────────────────────

    function testPay_balancesCorrect() public {
        uint256 amount     = FIFTY_USDC;
        uint256 fee        = fm.calculateFee(amount); // flat 2_000
        uint256 net        = amount - fee;

        uint256 payerBefore    = usdc.balanceOf(payer);
        uint256 merchantBefore = usdc.balanceOf(merchant);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.prank(payer);
        core.pay(address(usdc), merchant, amount);

        assertEq(usdc.balanceOf(payer),    payerBefore    - amount);
        assertEq(usdc.balanceOf(merchant), merchantBefore + net);
        assertEq(usdc.balanceOf(treasury), treasuryBefore + fee);
    }

    function testPay_totalReceivedAccumulates() public {
        vm.prank(payer);
        core.pay(address(usdc), merchant, FIFTY_USDC);

        vm.prank(payer);
        core.pay(address(usdc), merchant, FIFTY_USDC);

        uint256 net = FIFTY_USDC - FLAT_FEE;
        assertEq(core.getMerchant(merchant).totalReceived, net * 2);
    }

    function testPay_emitsEvent() public {
        uint256 amount = FIFTY_USDC;
        uint256 fee    = fm.calculateFee(amount);

        vm.prank(payer);
        vm.expectEmit(false, true, true, false); // paymentId is dynamic; skip it
        emit IPaymentCore.PaymentProcessed(
            bytes32(0), payer, merchant, address(usdc), amount, fee
        );
        core.pay(address(usdc), merchant, amount);
    }

    function testPay_returnsUniqueIds() public {
        vm.prank(payer);
        bytes32 id1 = core.pay(address(usdc), merchant, FIFTY_USDC);

        vm.prank(payer);
        bytes32 id2 = core.pay(address(usdc), merchant, FIFTY_USDC);

        assertTrue(id1 != id2);
    }

    // ─── pay() — reverts ──────────────────────────────────────────────────────

    function testPay_unsupportedToken() public {
        address badToken = makeAddr("bad");
        vm.prank(payer);
        vm.expectRevert("PaymentCore: token not supported");
        core.pay(badToken, merchant, FIFTY_USDC);
    }

    function testPay_unregisteredMerchant() public {
        address ghost = makeAddr("ghost");
        vm.prank(payer);
        vm.expectRevert("PaymentCore: merchant not registered");
        core.pay(address(usdc), ghost, FIFTY_USDC);
    }

    function testPay_zeroAmount() public {
        vm.prank(payer);
        vm.expectRevert("PaymentCore: zero amount");
        core.pay(address(usdc), merchant, 0);
    }

    function testPay_whenPaused() public {
        vm.prank(admin);
        core.pause();

        vm.prank(payer);
        vm.expectRevert();
        core.pay(address(usdc), merchant, FIFTY_USDC);
    }

    // ─── Pausable ─────────────────────────────────────────────────────────────

    function testPauseUnpause() public {
        vm.prank(admin);
        core.pause();
        assertTrue(core.paused());

        vm.prank(admin);
        core.unpause();
        assertFalse(core.paused());
    }

    function testPause_unauthorised() public {
        vm.prank(noRole);
        vm.expectRevert();
        core.pause();
    }

    // ─── Admin config ─────────────────────────────────────────────────────────

    function testSetTreasury() public {
        address newT = makeAddr("newTreasury");
        vm.prank(admin);
        core.setTreasury(newT);
        assertEq(core.treasury(), newT);
    }

    function testSetTreasury_zero() public {
        vm.prank(admin);
        vm.expectRevert("PaymentCore: zero address");
        core.setTreasury(address(0));
    }

    function testSetFeeManager() public {
        FeeManager newFm = new FeeManager(admin);
        vm.prank(admin);
        core.setFeeManager(address(newFm));
        assertEq(address(core.feeManager()), address(newFm));
    }

    function testSetFeeManager_zero() public {
        vm.prank(admin);
        vm.expectRevert("PaymentCore: zero address");
        core.setFeeManager(address(0));
    }

    function testSetFeeManager_unauthorised() public {
        vm.prank(noRole);
        vm.expectRevert();
        core.setFeeManager(address(fm));
    }

    // ─── fuzz ─────────────────────────────────────────────────────────────────

    /// For any valid amount the net amount received by merchant must equal amount − fee.
    function testFuzz_payNetAmount(uint256 amount) public {
        // Keep amounts in range: above fee, below payer balance
        amount = bound(amount, FLAT_FEE + 1, 1_000 * ONE_USDC);

        uint256 fee = fm.calculateFee(amount);
        vm.assume(fee < amount); // skip edge cases where fee >= amount

        uint256 merchantBefore = usdc.balanceOf(merchant);

        vm.prank(payer);
        core.pay(address(usdc), merchant, amount);

        assertEq(usdc.balanceOf(merchant), merchantBefore + (amount - fee));
    }
}
