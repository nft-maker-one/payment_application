export const PAYMENT_CORE_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "address", "name": "merchant", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "pay",
    "outputs": [{ "internalType": "bytes32", "name": "paymentId", "type": "bytes32" }],
    "stateMutability": "external",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "merchant", "type": "address" },
      { "internalType": "string", "name": "name", "type": "string" }
    ],
    "name": "registerMerchant",
    "outputs": [],
    "stateMutability": "external",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "merchant", "type": "address" }],
    "name": "getMerchant",
    "outputs": [
      {
        "components": [
          { "internalType": "bool", "name": "registered", "type": "bool" },
          { "internalType": "string", "name": "name", "type": "string" },
          { "internalType": "uint256", "name": "totalReceived", "type": "uint256" },
          { "internalType": "uint256", "name": "registeredAt", "type": "uint256" }
        ],
        "internalType": "struct IPaymentCore.MerchantInfo",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "token", "type": "address" }],
    "name": "isSupportedToken",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const FEE_MANAGER_ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "calculateFee",
    "outputs": [{ "internalType": "uint256", "name": "fee", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const ERC20_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "external",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
