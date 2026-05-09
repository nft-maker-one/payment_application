// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFeeManager {
    /// @notice Calculate the fee for a given payment amount.
    /// @param amount Raw token units being transferred.
    /// @return fee   Raw token units to deduct as fee.
    function calculateFee(uint256 amount) external view returns (uint256 fee);
}
