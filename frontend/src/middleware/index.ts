import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { PAYMENT_CORE_ABI, ERC20_ABI, FEE_MANAGER_ABI } from './abi';
import { PAYMENT_CORE_ADDRESS, FEE_MANAGER_ADDRESS, SUPPORTED_TOKENS, REGISTERED_MERCHANTS } from './constants';
import { parseUnits } from 'viem';

// --- Hooks for PaymentCore ---

/**
 * Hook to pay a merchant
 */
export function usePay() {
  const { writeContractAsync, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const pay = async (tokenAddress: `0x${string}`, merchantAddress: `0x${string}`, amount: string, decimals: number = 6) => {
    const amountInUnits = parseUnits(amount, decimals);
    
    return writeContractAsync({
      address: PAYMENT_CORE_ADDRESS,
      abi: PAYMENT_CORE_ABI,
      functionName: 'pay',
      args: [tokenAddress, merchantAddress, amountInUnits],
    });
  };

  return { pay, hash, error, isPending, isConfirming, isSuccess };
}

/**
 * Hook to create a subscription
 */
export function useSubscribe() {
  const { writeContractAsync, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const subscribe = async (tokenAddress: `0x${string}`, merchantAddress: `0x${string}`, amount: string, intervalSeconds: number = 3600, decimals: number = 6) => {
    const amountInUnits = parseUnits(amount, decimals);
    
    return writeContractAsync({
      address: PAYMENT_CORE_ADDRESS,
      abi: PAYMENT_CORE_ABI,
      functionName: 'subscribe',
      args: [tokenAddress, merchantAddress, amountInUnits, BigInt(intervalSeconds)],
    });
  };

  return { subscribe, hash, error, isPending, isConfirming, isSuccess };
}

/**
 * Hook to execute a subscription payment
 */
export function useExecuteSubscription() {
  const { writeContractAsync, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const execute = async (subscriptionId: `0x${string}`) => {
    return writeContractAsync({
      address: PAYMENT_CORE_ADDRESS,
      abi: PAYMENT_CORE_ABI,
      functionName: 'executeSubscription',
      args: [subscriptionId],
    });
  };

  return { execute, hash, error, isPending, isConfirming, isSuccess };
}

/**
 * Hook to get global stats
 */
export function useGlobalStats() {
  return useReadContract({
    address: PAYMENT_CORE_ADDRESS,
    abi: PAYMENT_CORE_ABI,
    functionName: 'getGlobalStats',
  });
}

/**
 * Hook to get merchant info
 */
export function useMerchantInfo(merchantAddress: `0x${string}`) {
  return useReadContract({
    address: PAYMENT_CORE_ADDRESS,
    abi: PAYMENT_CORE_ABI,
    functionName: 'getMerchant',
    args: [merchantAddress],
  });
}

/**
 * Hook to check if a token is supported
 */
export function useIsSupportedToken(tokenAddress: `0x${string}`) {
  return useReadContract({
    address: PAYMENT_CORE_ADDRESS,
    abi: PAYMENT_CORE_ABI,
    functionName: 'isSupportedToken',
    args: [tokenAddress],
  });
}

// --- Hooks for FeeManager ---

/**
 * Hook to calculate fee
 */
export function useCalculateFee(amount: string, decimals: number = 6) {
  const amountInUnits = parseUnits(amount, decimals);
  
  return useReadContract({
    address: FEE_MANAGER_ADDRESS,
    abi: FEE_MANAGER_ABI,
    functionName: 'calculateFee',
    args: [amountInUnits],
  });
}

// --- Hooks for ERC20 ---

/**
 * Hook to approve token spending
 */
export function useApproveToken() {
  const { writeContractAsync, data: hash, error, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = async (tokenAddress: `0x${string}`, amount: string, decimals: number = 6) => {
    const amountInUnits = parseUnits(amount, decimals);
    
    return writeContractAsync({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [PAYMENT_CORE_ADDRESS, amountInUnits],
    });
  };

  return { approve, hash, error, isPending, isConfirming, isSuccess };
}

/**
 * Hook to get token addresses
 */
export function useTokenAddresses() {
  return {
    USDC: SUPPORTED_TOKENS.USDC,
    USDT: SUPPORTED_TOKENS.USDT,
  };
}

export * from './abi';
export * from './constants';
