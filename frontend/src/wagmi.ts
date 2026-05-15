import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { localhost } from 'wagmi/chains';
import { http } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'Payment App',
  projectId: 'YOUR_PROJECT_ID',
  chains: [localhost],
  transports: {
    [localhost.id]: http(),
  },
  ssr: true,
  // 强制禁用 WalletConnect 以减少依赖报错
  // 如果需要，可以在这里指定更具体的 connectors
});
