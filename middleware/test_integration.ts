import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { localhost } from 'viem/chains';
import { PAYMENT_CORE_ABI, FEE_MANAGER_ABI } from './src/abi.ts';
import { PAYMENT_CORE_ADDRESS, FEE_MANAGER_ADDRESS, SUPPORTED_TOKENS } from './src/constants.ts';

async function main() {
  const client = createPublicClient({
    chain: localhost,
    transport: http(),
  });

  console.log('--- Testing Middleware Integration ---');
  console.log('PaymentCore:', PAYMENT_CORE_ADDRESS);
  console.log('FeeManager:', FEE_MANAGER_ADDRESS);

  // 1. Test Fee Calculation
  const amount = '100';
  const amountInUnits = parseUnits(amount, 6); // USDC uses 6 decimals
  const fee = await client.readContract({
    address: FEE_MANAGER_ADDRESS,
    abi: FEE_MANAGER_ABI,
    functionName: 'calculateFee',
    args: [amountInUnits],
  });
  console.log(`Fee for ${amount} USDC: ${formatUnits(fee as bigint, 6)} USDC`);

  // 2. Test Supported Token
  const isUsdcSupported = await client.readContract({
    address: PAYMENT_CORE_ADDRESS,
    abi: PAYMENT_CORE_ABI,
    functionName: 'isSupportedToken',
    args: [SUPPORTED_TOKENS.USDC],
  });
  console.log('Is USDC supported?', isUsdcSupported);

  // 3. Test Merchant Info
  const merchantAddress = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
  const merchantInfo = await client.readContract({
    address: PAYMENT_CORE_ADDRESS,
    abi: PAYMENT_CORE_ABI,
    functionName: 'getMerchant',
    args: [merchantAddress],
  });
  console.log('Merchant Info:', merchantInfo);
}

main().catch(console.error);
