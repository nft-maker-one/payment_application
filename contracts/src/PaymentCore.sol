// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPaymentCore}    from "./interfaces/IPaymentCore.sol";
import {IFeeManager}     from "./interfaces/IFeeManager.sol";

/// @title  PaymentCore
/// @notice Core stablecoin payment contract for the Payment Appchain.
///
/// Responsibilities
/// ────────────────
/// • Stablecoin transfers (USDC / USDT / any whitelisted ERC-20)
/// • Merchant account registry (register / deregister)
/// • Per-payment fee deduction via pluggable FeeManager
/// • Role-based access control (ADMIN, PAUSER)
/// • Reentrancy protection and Pausable emergency stop
/// • Application-level payment idempotency via on-chain paymentId ledger
///
/// Security notes
/// ──────────────
/// • Solidity 0.8.x arithmetic is overflow-safe by default; no SafeMath needed.
/// • All token movements use SafeERC20 to handle non-standard ERC-20 edge cases.
/// • The two-phase pull pattern (pull full amount → forward net + fee) ensures
///   atomicity: both transfers happen in the same transaction or neither does.
/// • processedPayments prevents replay of the same paymentId within the chain.
contract PaymentCore is IPaymentCore, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Roles ────────────────────────────────────────────────────────────────

    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ─── State ────────────────────────────────────────────────────────────────

    IFeeManager public feeManager;
    address     public treasury;

    /// @dev Token address → is whitelisted for payments.
    mapping(address => bool)         public supportedTokens;

    /// @dev Merchant address → registration info.
    mapping(address => MerchantInfo) private _merchants;

    /// @dev paymentId → already processed; guards against cross-function replay.
    mapping(bytes32 => bool)         private _processedPayments;

    /// @dev Monotonic counter used when generating paymentIds.
    uint256 private _nonce;

    // ─── Constructor ──────────────────────────────────────────────────────────

    /// @param admin       Address granted DEFAULT_ADMIN, ADMIN, and PAUSER roles.
    /// @param _treasury   Address that receives fee proceeds.
    /// @param _feeManager IFeeManager implementation.
    constructor(address admin, address _treasury, address _feeManager) {
        require(admin      != address(0), "PaymentCore: zero admin");
        require(_treasury  != address(0), "PaymentCore: zero treasury");
        require(_feeManager != address(0), "PaymentCore: zero feeManager");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE,  admin);
        _grantRole(PAUSER_ROLE, admin);

        treasury   = _treasury;
        feeManager = IFeeManager(_feeManager);
    }

    // ─── Payment ──────────────────────────────────────────────────────────────

    /// @inheritdoc IPaymentCore
    /// @dev Pull pattern:
    ///      1. Pull `amount` from payer into this contract.
    ///      2. Forward `net` (amount − fee) to merchant.
    ///      3. Forward `fee` to treasury.
    ///      Atomic: if any transfer reverts the whole call reverts.
    function pay(
        address token,
        address merchant,
        uint256 amount
    ) external override nonReentrant whenNotPaused returns (bytes32 paymentId) {
        require(supportedTokens[token],          "PaymentCore: token not supported");
        require(_merchants[merchant].registered, "PaymentCore: merchant not registered");
        require(amount > 0,                       "PaymentCore: zero amount");

        uint256 fee = feeManager.calculateFee(amount);
        require(fee < amount, "PaymentCore: fee exceeds amount");
        uint256 net = amount - fee;

        // Unique ID: includes chain ID to prevent cross-chain replay.
        paymentId = keccak256(
            abi.encodePacked(msg.sender, merchant, token, amount, _nonce++, block.chainid)
        );
        // Belt-and-suspenders: nonce increment makes collisions computationally infeasible,
        // but we track them anyway to make idempotency guarantees explicit.
        require(!_processedPayments[paymentId], "PaymentCore: duplicate payment");
        _processedPayments[paymentId] = true;

        // Phase 1: pull full gross amount from payer.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Phase 2: forward net to merchant and fee to treasury.
        IERC20(token).safeTransfer(merchant, net);
        if (fee > 0) {
            IERC20(token).safeTransfer(treasury, fee);
        }

        _merchants[merchant].totalReceived += net;

        emit PaymentProcessed(paymentId, msg.sender, merchant, token, amount, fee);
    }

    // ─── Merchant Registry ────────────────────────────────────────────────────

    /// @inheritdoc IPaymentCore
    function registerMerchant(
        address merchant,
        string calldata name
    ) external override onlyRole(ADMIN_ROLE) {
        require(merchant != address(0),          "PaymentCore: zero address");
        require(!_merchants[merchant].registered, "PaymentCore: already registered");
        require(bytes(name).length > 0,           "PaymentCore: empty name");

        _merchants[merchant] = MerchantInfo({
            registered:    true,
            name:          name,
            totalReceived: 0,
            registeredAt:  block.timestamp
        });

        emit MerchantRegistered(merchant, name);
    }

    /// @inheritdoc IPaymentCore
    function deregisterMerchant(address merchant) external override onlyRole(ADMIN_ROLE) {
        require(_merchants[merchant].registered, "PaymentCore: not registered");
        delete _merchants[merchant];
        emit MerchantDeregistered(merchant);
    }

    /// @inheritdoc IPaymentCore
    function getMerchant(address merchant) external view override returns (MerchantInfo memory) {
        return _merchants[merchant];
    }

    // ─── Token Whitelist ──────────────────────────────────────────────────────

    /// @notice Whitelist a token so it can be used in pay().
    function addSupportedToken(address token) external onlyRole(ADMIN_ROLE) {
        require(token != address(0), "PaymentCore: zero address");
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    /// @notice Remove a token from the whitelist.
    function removeSupportedToken(address token) external onlyRole(ADMIN_ROLE) {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    /// @inheritdoc IPaymentCore
    function isSupportedToken(address token) external view override returns (bool) {
        return supportedTokens[token];
    }

    // ─── Admin Config ─────────────────────────────────────────────────────────

    /// @notice Swap out the FeeManager implementation (e.g., after a fee model upgrade).
    function setFeeManager(address _feeManager) external onlyRole(ADMIN_ROLE) {
        require(_feeManager != address(0), "PaymentCore: zero address");
        address old = address(feeManager);
        feeManager  = IFeeManager(_feeManager);
        emit FeeManagerUpdated(old, _feeManager);
    }

    /// @notice Update the treasury address.
    function setTreasury(address _treasury) external onlyRole(ADMIN_ROLE) {
        require(_treasury != address(0), "PaymentCore: zero address");
        address old = treasury;
        treasury    = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    // ─── Emergency Controls ───────────────────────────────────────────────────

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
