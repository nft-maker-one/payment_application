// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPaymentCore {
    // ─── Structs ─────────────────────────────────────────────────────────────

    struct MerchantInfo {
        bool     registered;
        string   name;
        uint256  totalReceived; // cumulative net amount received (raw token units)
        uint256  registeredAt;  // block.timestamp of registration
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    event MerchantRegistered(address indexed merchant, string name);
    event MerchantDeregistered(address indexed merchant);

    /// @param paymentId  Unique on-chain payment identifier (for middleware tracking)
    /// @param amount     Gross amount including fee
    /// @param fee        Fee portion forwarded to treasury
    event PaymentProcessed(
        bytes32 indexed paymentId,
        address indexed payer,
        address indexed merchant,
        address  token,
        uint256  amount,
        uint256  fee
    );

    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event FeeManagerUpdated(address indexed oldManager, address indexed newManager);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ─── Core ────────────────────────────────────────────────────────────────

    /// @notice Pay a registered merchant with a supported stablecoin.
    /// @param token    ERC-20 token address (must be whitelisted).
    /// @param merchant Registered merchant address.
    /// @param amount   Gross amount (fee will be deducted before forwarding net).
    /// @return paymentId Unique identifier for this payment.
    function pay(
        address token,
        address merchant,
        uint256 amount
    ) external returns (bytes32 paymentId);

    // ─── Merchant Registry ───────────────────────────────────────────────────

    function registerMerchant(address merchant, string calldata name) external;
    function deregisterMerchant(address merchant) external;
    function getMerchant(address merchant) external view returns (MerchantInfo memory);

    // ─── Token Whitelist ─────────────────────────────────────────────────────

    function isSupportedToken(address token) external view returns (bool);
}
