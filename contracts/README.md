# Payment Appchain — Smart Contracts

This directory contains the core smart contracts of the payment system, developed using the [Foundry](https://book.getfoundry.sh/?utm_source=chatgpt.com) framework.

---

## Table of Contents

* [Environment Setup](#environment-setup)
* [Running Unit Tests](#running-unit-tests)
* [Local Deployment (Anvil)](#local-deployment-anvil)
* [Testnet / Mainnet Deployment](#testnet--mainnet-deployment)
* [Contract Features](#contract-features)
* [Interface Reference](#interface-reference)

---

## Environment Setup

```bash
# Install Foundry (skip if already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Enter the contracts directory
cd contracts

# Install dependencies (run after first clone)
forge install
```

---

## Running Unit Tests

```bash
# Run all tests
forge test

# Show verbose output (including emitted events and call traces)
forge test -vvv

# Run only FeeManager-related tests
forge test --match-contract FeeManagerTest

# Run only PaymentCore-related tests
forge test --match-contract PaymentCoreTest

# Run fuzz testing (adjust number of runs)
forge test --fuzz-runs 1000

# Display gas usage report
forge test --gas-report
```

Test coverage (42 test cases):

| Test File                | Coverage                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `test/FeeManager.t.sol`  | Three-tier fee calculation, minimum fee floor, admin configuration, fuzz invariants                                            |
| `test/PaymentCore.t.sol` | Merchant registration/deregistration, token whitelist, payment balances, events, access control, pause mechanism, fuzz testing |

---

## Local Deployment (Anvil)

```bash
# Terminal 1: start local node
anvil

# Terminal 2: deploy contracts (using Anvil default account)
export DEPLOYER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export DEPLOYER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
export TREASURY=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
export USDC_ADDRESS=0x0000000000000000000000000000000000000000   # Fill in local mock address
export USDT_ADDRESS=0x0000000000000000000000000000000000000000

forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  -vvvv
```

After successful deployment, the terminal will print:

```text
FeeManager deployed: 0x...
PaymentCore deployed: 0x...
```

---

## Testnet / Mainnet Deployment

```bash
# Configure environment variables (recommended to store in .env, already excluded in .gitignore)
export DEPLOYER_PK=<your private key>
export DEPLOYER_ADDRESS=<corresponding address>
export TREASURY=<fee recipient address>
export USDC_ADDRESS=<on-chain USDC contract address>
export USDT_ADDRESS=<on-chain USDT contract address>
export RPC_URL=<RPC endpoint>

# Deploy + automatically verify source code
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

> Contract verification requires configuring `etherscan.api_key` in `foundry.toml`, or using the `--etherscan-api-key` parameter.

---

## Contract Features

### FeeManager — Tiered Fee Model

File: `src/FeeManager.sol`

A transaction fee calculator optimized for small, high-frequency payments, supporting dynamic fee adjustment by administrators.

**Default fee rates (using 6-decimal stablecoins such as USDC as an example):**

| Tier   | Amount Range      | Billing Method   | Fee Example           |
| ------ | ----------------- | ---------------- | --------------------- |
| Tier 0 | < 100 USDC        | Fixed 0.002 USDC | 50 USDC → Fee $0.002  |
| Tier 1 | 100 ~ 10,000 USDC | 3 BPS (0.03%)    | 500 USDC → Fee $0.15  |
| Tier 2 | ≥ 10,000 USDC     | 2 BPS (0.02%)    | 50,000 USDC → Fee $10 |

**Main functions:**

* `calculateFee(uint256 amount)` — Returns the transaction fee based on amount (read-only)
* `setFeeTier(uint256 index, FeeTier calldata tier)` — Admin modifies/adds fee tiers
* `setMinFee(uint256 minFee)` — Admin sets the minimum fee floor

---

### PaymentCore — Core Payment Contract

File: `src/PaymentCore.sol`

Handles stablecoin transfers, merchant account management, access control, and security protections.

**Main features:**

| Module               | Description                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Stablecoin Payments  | Deducts funds from payer and automatically splits net amount to merchant and fee to treasury |
| Merchant Registry    | Admin registers/deregisters merchants and tracks cumulative received payments                |
| Token Whitelist      | Only authorized ERC-20 tokens are allowed for payments                                       |
| Access Control       | `ADMIN_ROLE` manages configuration, `PAUSER_ROLE` handles emergency pause                    |
| Security Protections | ReentrancyGuard + Pausable + SafeERC20 + replay protection via payment IDs                   |

---

## Interface Reference

> The following section provides the complete contract interface reference for other modules (frontend / middleware).

### 1. Initiate Payment `pay()`

```solidity
function pay(
    address token,    // Token contract address (must be whitelisted, e.g. USDC)
    address merchant, // Merchant address (must be registered)
    uint256 amount    // Total amount (including fee, in token smallest unit)
) external returns (bytes32 paymentId);
```

**Prerequisites:**

* Caller must first execute ERC-20 `approve(paymentCoreAddress, amount)` for the `PaymentCore` contract address
* `token` must be whitelisted
* `merchant` must be registered

**Return value:** `paymentId` (unique payment ID for middleware tracking)

**Emitted event:**

```solidity
event PaymentProcessed(
    bytes32 indexed paymentId,
    address indexed payer,
    address indexed merchant,
    address  token,
    uint256  amount, // Total amount
    uint256  fee     // Fee portion
);
```

**Frontend ethers.js example:**

```typescript
// 1. Approve first
const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
await usdcContract.approve(PAYMENT_CORE_ADDRESS, amount);

// 2. Initiate payment
const core = new ethers.Contract(PAYMENT_CORE_ADDRESS, PAYMENT_CORE_ABI, signer);
const tx = await core.pay(USDC_ADDRESS, merchantAddress, amount);
const receipt = await tx.wait();

// 3. Extract paymentId from event
const event = receipt.logs.find(/* PaymentProcessed */);
```

---

### 2. Query Transaction Fee `calculateFee()`

```solidity
// FeeManager contract
function calculateFee(uint256 amount) external view returns (uint256 fee);
```

**Purpose:** Allows the frontend to display estimated transaction fees and actual received amount in real time after user input.

```typescript
const fm = new ethers.Contract(FEE_MANAGER_ADDRESS, FEE_MANAGER_ABI, provider);
const fee = await fm.calculateFee(amount);
const netAmount = amount - fee;
```

---

### 3. Query Merchant Information `getMerchant()`

```solidity
function getMerchant(address merchant) external view returns (
    MerchantInfo memory // { registered, name, totalReceived, registeredAt }
);
```

```typescript
const info = await core.getMerchant(merchantAddress);
console.log(info.name, info.totalReceived.toString());
```

---

### 4. Check Whether Token Is Supported `isSupportedToken()`

```solidity
function isSupportedToken(address token) external view returns (bool);
```

```typescript
const supported = await core.isSupportedToken(USDC_ADDRESS); // true / false
```

---

### 5. Admin Operations (Requires `ADMIN_ROLE`)

```solidity
// Register merchant
function registerMerchant(address merchant, string calldata name) external;

// Deregister merchant
function deregisterMerchant(address merchant) external;

// Add supported token
function addSupportedToken(address token) external;

// Remove supported token
function removeSupportedToken(address token) external;

// Replace fee manager
function setFeeManager(address _feeManager) external;

// Update treasury address
function setTreasury(address _treasury) external;
```

---

### 6. Emergency Pause (Requires `PAUSER_ROLE`)

```solidity
function pause() external;   // Pause all payments
function unpause() external; // Resume payments
```

---

### ABI File Locations

After deployment, ABI files are automatically generated at:

```text
contracts/out/PaymentCore.sol/PaymentCore.json
contracts/out/FeeManager.sol/FeeManager.json
```

Frontend/middleware applications can directly read and use the `abi` field.
