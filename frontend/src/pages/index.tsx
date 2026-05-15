import { ConnectButton } from '@rainbow-me/rainbowkit';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { usePay, useApproveToken, useCalculateFee, SUPPORTED_TOKENS } from '../middleware';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';

export default function Home() {
  const { isConnected, address } = useAccount();

  // --- 1. 状态管理 (左侧支付表单) ---
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('USDC');
  const [isRecurring, setIsRecurring] = useState(false);

  const tokenAddress = SUPPORTED_TOKENS[tokenSymbol as keyof typeof SUPPORTED_TOKENS] as `0x${string}`;

  // --- 2. Middleware Hooks ---
  const { pay, isPending: isPayPending, isConfirming: isPayConfirming, isSuccess: isPaySuccess } = usePay();
  const { approve, isPending: isApprovePending, isConfirming: isApproveConfirming, isSuccess: isApproveSuccess } = useApproveToken();
  const { data: estimatedFee } = useCalculateFee(amount || '0');

  // --- 3. 模拟数据 (右侧性能监控) ---
  const stats = {
    tps: 150.5,
    latency: '1.2s',
    ethFee: '$0.85',
    appchainFee: '$0.002',
    saving: '99.7%'
  };

  // --- 3. 模拟数据 (底部交易记录) ---
  const mockTransactions = [
    { id: '0x1a2b...3c4d', type: '单次支付', amount: '50 USDC', status: '成功', time: '1分钟前' },
    { id: '0x5e6f...7g8h', type: '订阅扣款', amount: '10 USDT', status: '成功', time: '2小时前' },
    { id: '0x9i0j...1k2l', type: '单次支付', amount: '0.1 ETH', status: '处理中', time: '刚刚' },
  ];

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      alert("请先连接钱包！");
      return;
    }
    if (!amount || !recipient) {
      alert("请填写完整的支付信息！");
      return;
    }

    try {
      // 1. Approve (simplified for demo, usually check allowance first)
      console.log("Approving...");
      await approve(tokenAddress, amount);
      
      // 2. Pay
      console.log("Paying...");
      await pay(tokenAddress, recipient as `0x${string}`, amount);
    } catch (err) {
      console.error(err);
      alert("交易失败，请查看控制台。");
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
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">发起支付 / 订阅</h2>
              <p className="text-gray-500 mt-1">支持即时转账与商户订阅模式</p>
            </div>

            <form className="space-y-6" onSubmit={handlePay}>
              <div className="flex space-x-4">
                <div className="w-1/3">
                  <label className="block text-sm font-semibold text-gray-600 mb-2">代币</label>
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
                  <label className="block text-sm font-semibold text-gray-600 mb-2">支付金额</label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">商户 / 收款人地址</label>
                <input 
                  type="text" 
                  placeholder="0x..." 
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono text-sm"
                />
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
                    开启自动化定期支付 (Recurring)
                  </span>
                  <span className="text-xs text-blue-600/70">
                    基于智能合约，按设定周期自动扣款
                  </span>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isPayPending || isApprovePending || isPayConfirming || isApproveConfirming}
                className={`w-full py-5 px-4 rounded-2xl font-bold text-lg shadow-lg transition-all ${
                  isPayPending || isApprovePending || isPayConfirming || isApproveConfirming
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-95'
                }`}
              >
                {isApprovePending || isApproveConfirming ? '正在批准代币...' : 
                 isPayPending || isPayConfirming ? '正在发起支付...' : 
                 (isRecurring ? '授权并开启自动订阅 🔄' : '立即确认支付 🚀')}
              </button>

              {(isPaySuccess || isApproveSuccess) && (
                <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-2xl text-sm border border-green-100 text-center">
                  {isPaySuccess ? '✅ 支付成功！' : '✅ 代币批准成功，正在准备支付...'}
                </div>
              )}
            </form>
          </div>

          {/* 右侧：性能监控面板 */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-100 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <span className="mr-2">📊</span> 链上实时性能监控
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                  <p className="text-sm text-green-700 font-medium">当前 TPS</p>
                  <p className="text-3xl font-black text-green-800">{stats.tps}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                  <p className="text-sm text-purple-700 font-medium">确认延迟</p>
                  <p className="text-3xl font-black text-purple-800">{stats.latency}</p>
                </div>
              </div>

              <div className="mt-6 p-6 bg-slate-900 rounded-2xl text-white">
                <p className="text-sm text-slate-400 mb-4">平均每笔交易手续费对比</p>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Ethereum Mainnet</span>
                      <span>{stats.ethFee}</span>
                    </div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-red-400 h-full w-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1 text-blue-400 font-bold">
                      <span>Our Payment Appchain</span>
                      <span>{stats.appchainFee}</span>
                    </div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-400 h-full w-[2%]"></div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <span className="bg-blue-500/20 text-blue-400 text-xs px-3 py-1 rounded-full border border-blue-500/30">
                    节省率高达 {stats.saving}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- 下半部分：交易状态与商户记录 --- */}
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-100 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="mr-2">📝</span> 最近交易记录与状态
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium">交易哈希 (Tx Hash)</th>
                  <th className="pb-3 font-medium">交易类型</th>
                  <th className="pb-3 font-medium">金额</th>
                  <th className="pb-3 font-medium">时间</th>
                  <th className="pb-3 font-medium">状态</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {mockTransactions.map((tx, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 font-mono text-blue-600">{tx.id}</td>
                    <td className="py-4 text-gray-700">{tx.type}</td>
                    <td className="py-4 font-bold text-gray-800">{tx.amount}</td>
                    <td className="py-4 text-gray-500">{tx.time}</td>
                    <td className="py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        tx.status === '成功' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}