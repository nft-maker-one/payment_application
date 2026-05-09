// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IFeeManager}   from "./interfaces/IFeeManager.sol";

/// @title  FeeManager
/// @notice Tiered fee model optimised for small, high-frequency stablecoin payments.
///
/// Default tiers (calibrated for 6-decimal tokens such as USDC / USDT):
///
///   Tier 0  amount < 100 USDC  →  flat  0.002 USDC  (keeps micro-payments ultra-cheap)
///   Tier 1  amount < 10 000 USDC →  3 BPS (0.03 %)
///   Tier 2  amount ≥ 10 000 USDC →  2 BPS (0.02 %)  (largest volumes, lowest rate)
///
/// All thresholds and rates are admin-configurable post-deployment.
contract FeeManager is IFeeManager, AccessControl {
    bytes32 public constant FEE_ADMIN_ROLE = keccak256("FEE_ADMIN_ROLE");

    /// @dev A single fee tier entry.
    ///      Tiers are evaluated in ascending order; the first tier whose
    ///      `threshold` is greater than `amount` (or is the catch-all) wins.
    struct FeeTier {
        uint256 threshold; // exclusive upper bound; 0 signals "catch-all last tier"
        bool    isFlat;    // true → use flatFee; false → use feeBps
        uint256 flatFee;   // raw token units (used when isFlat == true)
        uint256 feeBps;    // basis points, 1 BPS = 0.01% (used when isFlat == false)
    }

    FeeTier[] public feeTiers;

    /// @notice Minimum fee returned even when BPS would yield less.
    uint256 public minFee;

    // ─── Events ──────────────────────────────────────────────────────────────

    event FeeTierSet(uint256 indexed index, FeeTier tier);
    event MinFeeUpdated(uint256 minFee);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address admin) {
        require(admin != address(0), "FeeManager: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FEE_ADMIN_ROLE, admin);

        // Tier 0: amounts below 100 USDC (100_000_000 with 6 dec) → flat 0.002 USDC
        feeTiers.push(FeeTier({threshold: 100_000_000, isFlat: true,  flatFee: 2_000,  feeBps: 0}));
        // Tier 1: amounts below 10 000 USDC               → 3 BPS
        feeTiers.push(FeeTier({threshold: 10_000_000_000, isFlat: false, flatFee: 0, feeBps: 3}));
        // Tier 2: catch-all (largest amounts)             → 2 BPS
        feeTiers.push(FeeTier({threshold: 0,              isFlat: false, flatFee: 0, feeBps: 2}));

        minFee = 1; // never return a zero fee
    }

    // ─── IFeeManager ─────────────────────────────────────────────────────────

    /// @inheritdoc IFeeManager
    function calculateFee(uint256 amount) external view override returns (uint256 fee) {
        uint256 len = feeTiers.length;
        for (uint256 i = 0; i < len; ) {
            FeeTier storage tier = feeTiers[i];
            bool isCatchAll = (tier.threshold == 0);
            if (isCatchAll || amount < tier.threshold) {
                fee = tier.isFlat
                    ? tier.flatFee
                    : (amount * tier.feeBps) / 10_000;
                break;
            }
            unchecked { ++i; }
        }
        if (fee < minFee) fee = minFee;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Add or overwrite a fee tier.
    /// @param index Existing index to overwrite, or feeTiers.length to append.
    function setFeeTier(uint256 index, FeeTier calldata tier) external onlyRole(FEE_ADMIN_ROLE) {
        require(index <= feeTiers.length, "FeeManager: index out of range");
        if (index == feeTiers.length) {
            feeTiers.push(tier);
        } else {
            feeTiers[index] = tier;
        }
        emit FeeTierSet(index, tier);
    }

    /// @notice Update the global minimum fee floor.
    function setMinFee(uint256 _minFee) external onlyRole(FEE_ADMIN_ROLE) {
        minFee = _minFee;
        emit MinFeeUpdated(_minFee);
    }

    /// @notice Returns the number of configured fee tiers.
    function tierCount() external view returns (uint256) {
        return feeTiers.length;
    }
}
