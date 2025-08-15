import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, getAddress } from 'viem';
import { arbitrum, base, monadTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Configuración de redes
const NETWORKS = {
  arbitrum: {
    chain: arbitrum,
    rpcUrl: process.env.ARB_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    amount: BigInt(process.env.CLAIM_AMOUNT_WEI || '186200000000000'), // 0.0001862 ETH
    symbol: 'ETH',
    name: 'Arbitrum One'
  },
  monadTestnet: {
    chain: monadTestnet,
    rpcUrl: process.env.MONAD_TESTNET_RPC_URL,
    amount: BigInt(process.env.CLAIM_AMOUNT_WEI || '18620000000000000'), // 0.01862 MON
    symbol: 'MON',
    name: 'Monad Testnet'
  },
  base: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL || 'https://base-mainnet.public.blastapi.io',
    amount: BigInt(process.env.CLAIM_AMOUNT_WEI || '186200000000000'), // 0.0001862 ETH
    symbol: 'ETH',
    name: 'Base'
  }
};

export async function GET(req: NextRequest) {
  try {
    const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY as `0x${string}`;
    
    if (!faucetPrivateKey) {
      return NextResponse.json({ error: 'Faucet not configured' }, { status: 500 });
    }

    const faucetAccount = privateKeyToAccount(faucetPrivateKey);
    const faucetAddress = faucetAccount.address;

    // Verificar saldos en paralelo
    const balanceChecks = await Promise.allSettled(
      Object.entries(NETWORKS).map(async ([networkKey, config]) => {
        try {
          // Crear client para la red
          const client = createPublicClient({
            chain: config.chain,
            transport: config.rpcUrl ? http(config.rpcUrl) : http()
          });

          // Obtener balance
          console.log(`Checking balance for ${networkKey} on ${config.rpcUrl || 'default RPC'}`);
          const balance = await client.getBalance({ address: faucetAddress });
          console.log(`${networkKey} balance:`, balance.toString(), 'wei');
          
          // Verificar si tiene suficiente para al menos 1 claim
          const minRequired = config.amount; // Solo necesita 1 claim como mínimo
          const hasEnoughFunds = balance >= minRequired;
          const estimatedClaims = balance > 0n ? Number(balance / config.amount) : 0;
          
          console.log(`${networkKey} hasEnoughFunds:`, hasEnoughFunds, `(${balance.toString()} >= ${minRequired.toString()})`);
          console.log(`${networkKey} estimated claims:`, estimatedClaims);

          return {
            network: networkKey,
            name: config.name,
            symbol: config.symbol,
            balance: balance.toString(),
            balanceFormatted: Number(balance) / 1e18,
            claimAmount: config.amount.toString(),
            claimAmountFormatted: Number(config.amount) / 1e18,
            hasEnoughFunds,
            estimatedClaims
          };
        } catch (error) {
          console.error(`Error checking balance for ${networkKey}:`, error);
          return {
            network: networkKey,
            name: config.name,
            symbol: config.symbol,
            balance: '0',
            balanceFormatted: 0,
            claimAmount: config.amount.toString(),
            claimAmountFormatted: Number(config.amount) / 1e18,
            hasEnoughFunds: false,
            estimatedClaims: 0,
            error: 'Error checking balance'
          };
        }
      })
    );

    // Procesar resultados
    const balances: { [key: string]: any } = {};
    let totalNetworksWithFunds = 0;

    balanceChecks.forEach((result, index) => {
      const networkKey = Object.keys(NETWORKS)[index];
      if (result.status === 'fulfilled') {
        balances[networkKey] = result.value;
        if (result.value.hasEnoughFunds) {
          totalNetworksWithFunds++;
        }
      } else {
        balances[networkKey] = {
          network: networkKey,
          name: NETWORKS[networkKey as keyof typeof NETWORKS].name,
          hasEnoughFunds: false,
          error: 'Failed to check balance'
        };
      }
    });

    return NextResponse.json({
      faucetAddress,
      networks: balances,
      totalNetworksWithFunds,
      hasAnyFunds: totalNetworksWithFunds > 0,
      lastChecked: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in balances endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
