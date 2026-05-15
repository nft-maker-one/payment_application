# Payment Appchain Application

This project implements a decentralized payment system with support for single payments and automated recurring subscriptions. It is designed for Topic 2 (Subscription/Recurring Payment) of the SC6019 project.

## Architecture

- **Contracts**: Solidity smart contracts managed with Foundry (Forge/Anvil).
- **Frontend**: Next.js 15+ application using Wagmi v2, Viem v2, and RainbowKit.
- **Middleware**: A custom abstraction layer in `frontend/src/middleware` that simplifies contract interactions.

## Core Features

1.  **Direct Payments**: Secure ERC20-based payments to registered merchants.
2.  **Recurring Subscriptions**: Users can authorize merchants to pull payments at specific intervals.
3.  **Real-time Analytics**: On-chain data tracking for total transaction volume and active subscriptions.
4.  **Merchant Verification**: Integrated merchant registry for security and transparency.
5.  **Transaction History**: Real-time event monitoring for recent payment activities.

## Smart Contract Interface (ABI)

The core logic resides in `PaymentCore.sol` at `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`.

### Key Functions

- `pay(address token, address merchant, uint256 amount)`: Initiates a one-time payment.
- `subscribe(address token, address merchant, uint256 amount, uint256 interval)`: Creates a new subscription.
- `executeSubscription(bytes32 subscriptionId)`: Allows authorized entities to process a recurring payment.
- `getGlobalStats()`: Returns total payments and active subscription counts.
- `getMerchant(address merchant)`: Returns registration details and total revenue for a merchant.

## Local Development & Testing

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Node.js](https://nodejs.org/)

### Step 1: Start Local Blockchain
```bash
cd contracts
anvil --chain-id 1337
```

### Step 2: Deploy & Setup
In a new terminal:
```bash
cd contracts
# Deploy Core Contracts
export DEPLOYER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Initialize Local Environment (Mint tokens, Register merchants)
export PAYMENT_CORE=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
forge script script/SetupLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### Step 3: Run Frontend
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000`.

## Testing Guide

### 1. MetaMask Setup (CRITICAL)
- **Network**: Connect to `Localhost 8545` (Chain ID 1337).
- **Reset Account**: Since Anvil is fresh, you **MUST** reset your MetaMask account to sync Nonces:
  `Settings` -> `Advanced` -> `Clear activity tab data` (or `Reset Account`).
- **Import Account**: Import Anvil Account #0 using private key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`.

### 2. Functional Verification
- **One-time Payment**: Select a merchant, enter an amount, and click "Pay Now". Confirm the "Approve" and "Pay" transactions in MetaMask.
- **Subscription**: Toggle "Enable Recurring Payment" and click "Pay Now". This will call the `subscribe` function.
- **Verification**: Check the "Real-time Metrics" panel on the right. "Total Transactions" and "Active Subscriptions" should update automatically.
- **History**: Check the "Recent Transactions" table at the bottom. It should list your real-time on-chain transactions.

## Technical Notes
- **Decimals**: All stablecoin amounts are handled with 6 decimals (USDC/USDT standard).
- **HMR Fix**: If the UI hangs, check the browser console. Some MetaMask/SDK warnings are suppressed in `next.config.js` for better local stability.
