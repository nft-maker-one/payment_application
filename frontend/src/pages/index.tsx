import { ConnectButton } from '@rainbow-me/rainbowkit';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { 
  usePay, 
  useApproveToken, 
  useCalculateFee, 
  useTokenAddresses, 
  REGISTERED_MERCHANTS, 
  SUPPORTED_TOKENS, 
  useSubscribe, 
  useGlobalStats, 
  useMerchantInfo,
  useExecuteSubscription 
} from '../middleware';
import { PAYMENT_CORE_ADDRESS } from '../middleware/constants';
import { useAccount, useConfig, useDisconnect } from 'wagmi';
import * as viem from 'viem';
import { waitForTransactionReceipt } from 'wagmi/actions';

export default function Home() {
  const { isConnected, address } = useAccount();
  const config = useConfig();
  const { disconnect } = useDisconnect();
  
  // --- 1. 状态管理 (左侧支付表单) ---
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<`0x${string}`>(REGISTERED_MERCHANTS[0].address);
  const [tokenSymbol, setTokenSymbol] = useState('USDC');
  const [isRecurring, setIsRecurring] = useState(false);

  const { USDC, USDT } = useTokenAddresses();
  const tokenAddress = tokenSymbol === 'USDC' ? USDC : USDT;

  const { pay, isPending: isPayPending, isConfirming: isPayConfirming, isSuccess: isPaySuccess } = usePay();
  const { subscribe, isPending: isSubPending, isConfirming: isSubConfirming, isSuccess: isSubSuccess } = useSubscribe();
  const { approve, isPending: isApprovePending, isConfirming: isApproveConfirming, isSuccess: isApproveSuccess } = useApproveToken();
  const { execute: executeSub } = useExecuteSubscription();
  const { data: estimatedFee } = useCalculateFee(amount || '0');
  const { data: globalStats } = useGlobalStats();
  const { data: merchantData } = useMerchantInfo(recipient as `0x${string}`);

  const merchantStats = merchantData ? {
    registered: (merchantData as any)[0],
    name: (merchantData as any)[1],
    totalReceived: Number((merchantData as any)[2]) / 1000000,
  } : null;

  // --- 3. 交易历史逻辑 ---
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState<any[]>([]);

  // 模拟从合约获取真实历史 (由于本地环境复杂，我们使用 useEffect + getLogs)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const fetchHistory = async () => {
      try {
        const provider = (window as any).ethereum;
        if (!provider) return;

        const paymentTopic = viem.keccak256(viem.toHex("PaymentProcessed(bytes32,address,address,address,uint256,uint256)"));
        const subCreatedTopic = viem.keccak256(viem.toHex("SubscriptionCreated(bytes32,address,address,address,uint256,uint256)"));
        
        // 1. 获取支付历史
        const payLogs = await provider.request({
          method: 'eth_getLogs',
          params: [{
            address: PAYMENT_CORE_ADDRESS,
            fromBlock: '0x0',
            toBlock: 'latest',
            topics: [paymentTopic]
          }]
        });

        const formattedPay = payLogs.map((log: any) => {
          const amountHex = log.data.slice(0, 66);
          const amount = parseInt(amountHex, 16) / 1000000;
          return {
            id: log.topics[1].slice(0, 10) + '...',
            type: 'One-time Payment',
            amount: `${amount} USDC`,
            status: 'Success',
            time: 'Confirmed'
          };
        });

        // 2. 获取订阅历史
        const subLogs = await provider.request({
          method: 'eth_getLogs',
          params: [{
            address: PAYMENT_CORE_ADDRESS,
            fromBlock: '0x0',
            toBlock: 'latest',
            topics: [subCreatedTopic]
          }]
        });

        const formattedSubHistory = subLogs.map((log: any) => ({
          id: log.topics[1].slice(0, 10) + '...',
          type: 'Subscription Created',
          amount: '-',
          status: 'Success',
          time: 'Activated'
        }));

        setTransactions([...formattedPay, ...formattedSubHistory].reverse());

        // 3. 更新活跃订阅列表 (用于验证/演示执行)
        const currentSubs = subLogs.map((log: any) => {
          const subId = log.topics[1];
          // 解析 data 部分: token, amount, interval
          // 实际生产应使用 viem.decodeEventLog
          return {
            id: subId,
            displayId: subId.slice(0, 10) + '...',
            merchant: 'Test Merchant',
            status: 'Active'
          };
        });
        setActiveSubscriptions(currentSubs);

      } catch (e) {
        console.error("Fetch History Error:", e);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- 4. 统计数据 ---
  const stats = {
    totalPayments: globalStats ? Number((globalStats as any)[0]) : 0,
    totalSubscriptions: globalStats ? Number((globalStats as any)[1]) : 0,
    ethFee: '$0.85',
    appchainFee: '$0.002',
    saving: '99.7%'
  };

  const [balance, setBalance] = useState<string>('0');

  const checkBalance = async () => {
    try {
      if (typeof window === 'undefined') return;
      const provider = (window as any).ethereum;
      if (!provider) return;
      
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (accounts.length === 0) return;
      
      const usdcAddr = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
      // balanceOf(address) selector: 0x70a08231
      const data = `0x70a08231${accounts[0].slice(2).padStart(64, '0')}`;
      const res = await provider.request({
        method: 'eth_call',
        params: [{ to: usdcAddr, data }, 'latest']
      });
      setBalance((parseInt(res, 16) / 1000000).toString());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    checkBalance();
    const timer = setInterval(checkBalance, 5000);
    return () => clearInterval(timer);
  }, []);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      console.warn("Wallet not connected");
      alert("Please connect Wallet");
      return;
    }
    
    console.log("Starting payment process...", { amount, recipient, isRecurring });

    try {
      // 1. Approve
      console.log("Step 1: Approving token...", { tokenAddress, amount });
      if (!approve) {
        throw new Error("Approve function not initialized");
      }
      
      const approveHash = await approve(tokenAddress, amount);
      console.log("Approve transaction sent:", approveHash);
      
      // 等待授权交易被确认
      console.log("Waiting for approval confirmation...");
      const receipt = await waitForTransactionReceipt(config, {
        hash: approveHash,
      });
      console.log("Approval confirmed in block:", receipt.blockNumber);
      
      // 2. Pay or Subscribe
      if (isRecurring) {
        console.log("Creating subscription...", { tokenAddress, recipient, amount });
        const subHash = await subscribe(tokenAddress, recipient as `0x${string}`, amount, 3600);
        console.log("Subscription transaction sent:", subHash);
        alert("Subscription has been created. Please check your list.");
      } else {
        console.log("Initiating payment...", { tokenAddress, recipient, amount });
        const payHash = await pay(tokenAddress, recipient as `0x${string}`, amount);
        console.log("Payment transaction sent:", payHash);
        alert("Payment is successful.");
      }
    } catch (err: any) {
      console.error("Full Payment Error Object:", err);
      const message = err.shortMessage || err.message || "Transaction failed";
      alert(`Error: ${message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans pb-12">
      <Head>
        <title>Payment Appchain Dashboard</title>
      </Head>

      {/* --- 顶部导航栏 --- */}
      <nav className="flex justify-between items-center bg-white px-8 py-4 shadow-sm border-b border-gray-100 mb-8">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <span className="text-white text-xl">⚡</span>
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            Payment Appchain
          </h1>
        </div>
        <ConnectButton showBalance={false} />
      </nav>

      <main className="max-w-7xl mx-auto px-8">
        {/* --- 上半部分：支付与性能监控 --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* 左侧：支付操作卡片 */}
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-100/50 border border-gray-100">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Initiate Payment / Subscription</h2>
                <p className="text-gray-500 mt-1">Instant Transfer and Merchant Subscription Supported</p>
              </div>
              {isConnected && (
                <div className="bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100">
                  <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">USDC Balance</p>
                  <p className="text-lg font-black text-blue-700">{balance} <span className="text-xs font-normal">USDC</span></p>
                </div>
              )}
            </div>

            <form className="space-y-6" onSubmit={handlePay}>
              <div className="flex space-x-4">
                <div className="w-1/3">
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Token Symbol</label>
                  <select 
                    value={tokenSymbol} 
                    onChange={(e) => setTokenSymbol(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
                  >
                    <option value="USDC">USDC (Stable)</option>
                    <option value="USDT">USDT (Stable)</option>
                  </select>
                </div>
                <div className="w-2/3">
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Payment Amount</label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Receiving merchant</label>
                <select 
                  value={recipient} 
                  onChange={(e) => setRecipient(e.target.value as `0x${string}`)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
                >
                  {REGISTERED_MERCHANTS.map((merchant) => (
                    <option key={merchant.address} value={merchant.address}>
                      {merchant.name} ({merchant.address.slice(0, 6)}...{merchant.address.slice(-4)})
                    </option>
                  ))}
                </select>
                {merchantStats && merchantStats.registered && (
                  <p className="mt-2 text-xs text-gray-500 ml-2">
                    This merchant has been verified. Cumulative receipts: <span className="font-bold text-blue-600">{merchantStats.totalReceived} USDC</span>
                  </p>
                )}
              </div>

              <div className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center ${isRecurring ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}
                   onClick={() => setIsRecurring(!isRecurring)}>
                <input 
                  type="checkbox" 
                  checked={isRecurring}
                  onChange={() => {}} 
                  className="h-5 w-5 text-blue-600 rounded cursor-pointer" 
                />
                <div className="ml-4">
                  <span className={`block font-bold ${isRecurring ? 'text-blue-700' : 'text-gray-700'}`}>
                    Enable Recurring Payment (Automated)
                  </span>
                  <span className="text-xs text-blue-600/70">
                    Deducted periodically based on the contract schedule
                  </span>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isPayPending || isApprovePending || isPayConfirming || isApproveConfirming || isSubPending || isSubConfirming}
                className={`w-full py-5 px-4 rounded-2xl font-bold text-lg shadow-lg transition-all ${
                  isPayPending || isApprovePending || isPayConfirming || isApproveConfirming || isSubPending || isSubConfirming
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-95'
                }`}
              >
                {isApprovePending || isApproveConfirming ? 'Approving token...' : 
                 isPayPending || isPayConfirming ? 'Initiating payment...' : 
                 isSubPending || isSubConfirming ? 'Creating subscription transaction...' :
                 (isRecurring ? 'Enable recurring payment (automated)' : 'Confirm payment now')}
              </button>

                {(isPaySuccess || isApproveSuccess || isSubSuccess) && (
                <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-2xl text-sm border border-green-100 text-center">
                  {isPaySuccess ? 'Payment is successful.' : 
                   isSubSuccess ? 'Subscription is created.' :
                   'Token approval is successful, payment is ready.'} 
                </div>
              )}
            </form>
          </div>

          {/* 右侧：性能监控与统计 */}
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-100/50 border border-gray-100">
              <h3 className="text-xl font-bold mb-6 flex items-center">
                Performance Monitoring
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                  <p className="text-sm text-green-700 font-medium">Total Payments</p>
                  <p className="text-3xl font-black text-green-800">{stats.totalPayments}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                  <p className="text-sm text-purple-700 font-medium">Active Subscriptions</p>
                  <p className="text-3xl font-black text-purple-800">{stats.totalSubscriptions}</p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                  <span className="text-gray-600">Estimated transaction fees for Ethereum L1</span>
                  <span className="font-bold text-gray-400 line-through">{stats.ethFee}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <span className="text-blue-700 font-medium">Application chain  Actual handling fee</span>
                  <span className="font-bold text-blue-700">{stats.appchainFee}</span>
                </div>
                <div className="text-center">
                  <span className="inline-block px-4 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wider">
                    Save {stats.saving} value
                  </span>
                </div>
              </div>
            </div>

            {/* 活跃订阅管理面板 */}
            {activeSubscriptions.length > 0 && (
              <div className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-100/50 border border-indigo-50">
                <h3 className="text-xl font-bold mb-6 flex items-center">
                  My Active Subscriptions
                </h3>
                <div className="space-y-3">
                  {activeSubscriptions.map((sub) => (
                    <div key={sub.id} className="flex justify-between items-center p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <div>
                        <p className="font-bold text-indigo-900">ID: {sub.displayId}</p>
                        <p className="text-xs text-indigo-600">Merchant: {sub.merchant}</p>
                      </div>
                      <button 
                        onClick={async () => {
                          try {
                            console.log("Simulating merchant execution for sub:", sub.id);
                            await executeSub(sub.id);
                            alert("Simulate successfully!");
                          } catch (e: any) {
                            alert("Error: " + (e.shortMessage || "It might be that the time interval has not yet elapsed."));
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                      >
                        Merchant deduction
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- 下半部分：交易状态与商户记录 --- */}
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-100 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            Latest Trade and State
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium">Transaction Hash (Tx Hash)</th>
                  <th className="pb-3 font-medium">Trade Type</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">State</th>
                </tr>
              </thead>
                <tbody className="text-sm">
                {transactions.map((tx, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 font-mono text-xs text-blue-600">{tx.id}</td>
                    <td className="py-4 font-medium">{tx.type}</td>
                    <td className="py-4 font-bold">{tx.amount}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        tx.status === 'Success' || tx.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-4 text-gray-500 text-xs text-right">{tx.time}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 italic">
                      No on-chain transactions yet. Please initiate your first payment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}