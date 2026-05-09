// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {FeeManager}     from "../src/FeeManager.sol";

contract FeeManagerTest is Test {
    FeeManager fm;
    address admin   = makeAddr("admin");
    address noRole  = makeAddr("noRole");

    function setUp() public {
        fm = new FeeManager(admin);
    }

    // ─── calculateFee — tier 0: flat fee ─────────────────────────────────────

    /// Amounts strictly below 100 USDC (6 dec) should pay the flat fee: 0.002 USDC
    function testFeeFlat_micro() public view {
        // 1 USDC
        assertEq(fm.calculateFee(1_000_000), 2_000);
        // 50 USDC
        assertEq(fm.calculateFee(50_000_000), 2_000);
        // 99.99 USDC — still below threshold
        assertEq(fm.calculateFee(99_999_999), 2_000);
    }

    /// Exact threshold (100 USDC) falls into tier 1 (3 BPS), not tier 0.
    function testFeeFlat_atThresholdFallsToTier1() public view {
        uint256 amount = 100_000_000; // 100 USDC
        uint256 fee    = fm.calculateFee(amount);
        // 3 BPS of 100 USDC = 0.03 USDC = 30_000
        assertEq(fee, 30_000);
    }

    // ─── calculateFee — tier 1: 3 BPS ────────────────────────────────────────

    function testFee_tier1_bps() public view {
        // 500 USDC → 3 BPS → 0.15 USDC = 150_000
        uint256 amount = 500_000_000;
        assertEq(fm.calculateFee(amount), 150_000);
    }

    function testFee_tier1_upperBound() public view {
        // 9 999 USDC — still tier 1
        uint256 amount = 9_999_000_000;
        // 3 BPS = amount * 3 / 10000
        assertEq(fm.calculateFee(amount), (amount * 3) / 10_000);
    }

    // ─── calculateFee — tier 2 (catch-all): 2 BPS ────────────────────────────

    function testFee_tier2_bps() public view {
        // 10 000 USDC → 2 BPS → 2 USDC = 2_000_000
        // 10_000_000_000 * 2 / 10_000 = 2_000_000
        uint256 amount = 10_000_000_000;
        assertEq(fm.calculateFee(amount), 2_000_000);
    }

    function testFee_tier2_large() public view {
        uint256 amount = 1_000_000_000_000; // 1 000 000 USDC
        assertEq(fm.calculateFee(amount), (amount * 2) / 10_000);
    }

    // ─── calculateFee — minimum fee floor ────────────────────────────────────

    function testFee_minFeeFloor() public {
        // Set a high minimum so BPS result is below it
        vm.prank(admin);
        fm.setMinFee(5_000);

        // tier 1: 3 BPS of 100 USDC = 30_000 — above new minFee, unchanged
        assertEq(fm.calculateFee(100_000_000), 30_000);

        // Set minFee above flat tier result
        vm.prank(admin);
        fm.setMinFee(3_000);

        // tier 0 flat fee is 2_000 < minFee 3_000 → returns 3_000
        assertEq(fm.calculateFee(1_000_000), 3_000);
    }

    // ─── setFeeTier ───────────────────────────────────────────────────────────

    function testSetFeeTier_overwrite() public {
        FeeManager.FeeTier memory newTier = FeeManager.FeeTier({
            threshold: 100_000_000,
            isFlat:    true,
            flatFee:   1_000, // halved flat fee
            feeBps:    0
        });
        vm.prank(admin);
        fm.setFeeTier(0, newTier);

        assertEq(fm.calculateFee(1_000_000), 1_000);
    }

    function testSetFeeTier_append() public {
        uint256 before = fm.tierCount();
        FeeManager.FeeTier memory newTier = FeeManager.FeeTier({
            threshold: 0,
            isFlat:    false,
            flatFee:   0,
            feeBps:    1
        });
        vm.prank(admin);
        fm.setFeeTier(before, newTier);
        assertEq(fm.tierCount(), before + 1);
    }

    function testSetFeeTier_unauthorised() public {
        FeeManager.FeeTier memory tier = FeeManager.FeeTier({
            threshold: 0, isFlat: true, flatFee: 0, feeBps: 0
        });
        vm.prank(noRole);
        vm.expectRevert();
        fm.setFeeTier(0, tier);
    }

    function testSetFeeTier_indexOutOfRange() public {
        FeeManager.FeeTier memory tier = FeeManager.FeeTier({
            threshold: 0, isFlat: true, flatFee: 0, feeBps: 0
        });
        vm.prank(admin);
        vm.expectRevert("FeeManager: index out of range");
        fm.setFeeTier(99, tier); // gap index
    }

    // ─── setMinFee ────────────────────────────────────────────────────────────

    function testSetMinFee_admin() public {
        vm.prank(admin);
        fm.setMinFee(9_999);
        assertEq(fm.minFee(), 9_999);
    }

    function testSetMinFee_unauthorised() public {
        vm.prank(noRole);
        vm.expectRevert();
        fm.setMinFee(1);
    }

    // ─── fuzz ─────────────────────────────────────────────────────────────────

    /// Fee must not exceed the amount for any payment-viable amount.
    /// Dust below the flat fee is rejected by PaymentCore, so we start from flatFee + 1.
    function testFuzz_feeNeverExceedsAmount(uint256 amount) public view {
        // tier-0 flat fee is 2_000; amounts below that are rejected upstream by PaymentCore
        amount = bound(amount, 2_001, type(uint128).max);
        uint256 fee = fm.calculateFee(amount);
        assertLe(fee, amount);
    }

    /// Fee must always be at least minFee.
    function testFuzz_feeAtLeastMinFee(uint256 amount) public view {
        amount = bound(amount, 1, type(uint128).max);
        assertGe(fm.calculateFee(amount), fm.minFee());
    }
}
