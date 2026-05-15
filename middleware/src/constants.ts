// Default Anvil local addresses (from README or standard local deployment)
export const PAYMENT_CORE_ADDRESS = (process.env.NEXT_PUBLIC_PAYMENT_CORE_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3') as `0x${string}`;
export const FEE_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_FEE_MANAGER_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as `0x${string}`;

export const SUPPORTED_TOKENS = {
  USDC: (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0') as `0x${string}`,
  USDT: (process.env.NEXT_PUBLIC_USDT_ADDRESS || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9') as `0x${string}`,
};
