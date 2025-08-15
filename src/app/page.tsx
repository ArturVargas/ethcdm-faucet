'use client';
import { useEffect, useMemo, useState } from 'react';
import { createPublicClient, http, getAddress } from 'viem';
import { optimism } from 'viem/chains';
import { erc20Abi } from 'viem';


const PULPA = process.env.NEXT_PUBLIC_OP_PULPA as `0x${string}`;

export default function Home() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [status, setStatus] = useState<string>('');
  const [question, setQuestion] = useState<{ id: string; text: string; message: string } | null>(null);
  const [answer, setAnswer] = useState<string>('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('arbitrum');
  const [stats, setStats] = useState<any>(null);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [balances, setBalances] = useState<any>(null);
  const [loadingBalances, setLoadingBalances] = useState<boolean>(false);
  const [sponsors, setSponsors] = useState<any>(null);
  const [loadingSponsors, setLoadingSponsors] = useState<boolean>(false);

  const [isClaiming, setIsClaiming] = useState(false);
  const [pulpaInfo, setPulpaInfo] = useState<{ decimals: number; balance: bigint } | null>(null);

  const opClient = useMemo(() => createPublicClient({ chain: optimism, transport: http(process.env.NEXT_PUBLIC_OP_RPC || '') }), []);

  const NETWORK_OPTIONS = [
    { id: 'arbitrum', name: 'Arbitrum One', amount: '0.0001862', symbol: 'ETH' },
    { id: 'monadTestnet', name: 'Monad Testnet', amount: '0.01862', symbol: 'MON' },
    { id: 'base', name: 'Base', amount: '0.0001862', symbol: 'ETH' }
  ];

  const currentNetwork = NETWORK_OPTIONS.find(n => n.id === selectedNetwork) || NETWORK_OPTIONS[0];

  useEffect(() => {
    // Cargar captcha inicial, verificar saldos y cargar sponsors
    loadNewCaptcha();
    checkBalances();
    loadSponsors();
  }, []);

  async function checkBalances() {
    setLoadingBalances(true);
    try {
      const response = await fetch('/api/balances');
      const data = await response.json();
      setBalances(data);
      
      // Si no hay fondos en la red seleccionada, cambiar a una que sí tenga
      if (data.networks && !data.networks[selectedNetwork]?.hasEnoughFunds) {
        const networkWithFunds = Object.keys(data.networks).find(net => data.networks[net].hasEnoughFunds);
        if (networkWithFunds) {
          setSelectedNetwork(networkWithFunds);
        }
      }
    } catch (e) {
      console.error('Error cargando saldos:', e);
    } finally {
      setLoadingBalances(false);
    }
  }

  async function loadNewCaptcha() {
    try {
      const response = await fetch('/api/nonce', { method: 'POST' });
      const data = await response.json();
      setQuestion(data);
      setAnswer('');
    } catch (e) {
      console.error('Error cargando captcha:', e);
    }
  }

  async function loadStats() {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
      setShowStats(true);
    } catch (e) {
      console.error('Error cargando estadísticas:', e);
    }
  }

  async function loadSponsors() {
    setLoadingSponsors(true);
    try {
      const response = await fetch('/api/sponsors');
      const data = await response.json();
      setSponsors(data);
    } catch (e) {
      console.error('Error cargando sponsors:', e);
    } finally {
      setLoadingSponsors(false);
    }
  }



  async function connect() {
    if (!(window as any).ethereum) {
      alert('Instala MetaMask para continuar');
      return;
    }
    const [addr] = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
    setAccount(addr);

    // fetch PULPA balance preview (client-side informational only; server re-checks!)
    try {
      const decimals = Number(await opClient.readContract({ address: PULPA, abi: erc20Abi, functionName: 'decimals' }));
      const balance = await opClient.readContract({ address: PULPA, abi: erc20Abi, functionName: 'balanceOf', args: [getAddress(addr)] });
      setPulpaInfo({ decimals, balance: balance as bigint });
    } catch (e) { /* ignore preview errors */ }
  }

  async function claim() {
    if (!account || !question || !answer) {
      setStatus('Conecta tu wallet y responde el captcha');
      return;
    }
    
    setIsClaiming(true);
    setStatus('Firmando mensaje…');
    
    try {
      // 1) Firmar mensaje
      const signature = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [question.message, account]
      });

      setStatus('Verificando y enviando ETH…');

      // 2) Enviar claim con captcha y firma
      const r = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: account, 
          signature,
          captchaId: question.id,
          answer,
          network: selectedNetwork
        })
      });
      
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 429) {
          setStatus(`⏰ ${data.error}`);
        } else {
          throw new Error(data.error || 'Error al reclamar');
        }
      } else {
        setStatus(`Listo ✅ Tx: ${data.txHash}`);
        // Cargar nuevo captcha para próximo uso
        loadNewCaptcha();
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
      // Cargar nuevo captcha en caso de error
      loadNewCaptcha();
    } finally {
      setIsClaiming(false);
    }
  }

  const hasPulpa = useMemo(() => {
    if (!pulpaInfo) return undefined;
    const threshold = BigInt(25) * (10n ** BigInt(18));
    return pulpaInfo.balance >= threshold;
  }, [pulpaInfo]);

  return (
    <main className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Faucet ETHCDM · Multi-Chain</h1>
        <p className="text-sm text-neutral-300">Reclama criptomonedas gratis en múltiples redes. Cooldown global de 48 horas.</p>
      </div>
      <button 
        onClick={loadStats}
        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm"
      >
        📊 Estadísticas
      </button>
    </div>

    <button onClick={connect} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20">{account ? `Conectado: ${account.slice(0,6)}…${account.slice(-4)}` : 'Conectar MetaMask'}</button>

    {pulpaInfo && (
      <div className="text-sm text-neutral-300">
        Balance PULPA: {(Number(pulpaInfo.balance) / 10**pulpaInfo.decimals).toFixed(2)} {hasPulpa !== undefined && (hasPulpa ? '✅ cumple' : '❌ insuficiente')}
      </div>
    )}

    <div className="space-y-2">
      <label className="block text-sm font-medium">Selecciona la red:</label>
      <select 
        value={selectedNetwork} 
        onChange={e => setSelectedNetwork(e.target.value)}
        className="px-3 py-2 rounded bg-white/10 border border-white/10 text-sm w-full"
        disabled={isClaiming || loadingBalances}
      >
        {NETWORK_OPTIONS.map(network => {
          const networkBalance = balances?.networks?.[network.id];
          const hasEnoughFunds = networkBalance?.hasEnoughFunds ?? true; // Asumir disponible si no se ha cargado
          const estimatedClaims = networkBalance?.estimatedClaims ?? 0;
          
          return (
            <option 
              key={network.id} 
              value={network.id} 
              className="bg-black"
              disabled={!hasEnoughFunds}
            >
              {network.name} - {network.amount} {network.symbol}
              {networkBalance && (
                hasEnoughFunds 
                  ? ` (${estimatedClaims} claims disponibles)`
                  : ' (Sin fondos)'
              )}
            </option>
          );
        })}
      </select>
      
      {loadingBalances && (
        <p className="text-xs text-gray-400">🔄 Verificando saldos...</p>
      )}
    </div>

    <div className="space-y-2">
      <label className="block text-sm font-medium">Responde para verificar que eres humano:</label>
      <div className="flex items-center gap-2">
        <span className="px-3 py-2 bg-white/10 rounded text-sm">{question?.text || 'Cargando…'}</span>
        <input 
          className="px-3 py-2 rounded bg-white/5 border border-white/10 text-sm w-20" 
          placeholder="?" 
          value={answer} 
          onChange={e => setAnswer(e.target.value)}
          disabled={isClaiming}
        />
        <button 
          onClick={loadNewCaptcha} 
          className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-sm"
          disabled={isClaiming}
        >
          Nueva
        </button>
      </div>
    </div>

    {/* Mensaje cuando no hay fondos */}
    {balances && !balances.hasAnyFunds && (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
        <h3 className="font-medium text-red-400 mb-2">⛽ Sin fondos disponibles</h3>
        <p className="text-sm text-red-300">
          El faucet no tiene fondos suficientes en ninguna red en este momento. 
          Por favor regresa más tarde o contacta al administrador.
        </p>
        <div className="mt-2 text-xs text-gray-400">
          Dirección del faucet: {balances.faucetAddress}
        </div>
      </div>
    )}

    <button 
      disabled={!account || !answer || isClaiming || (balances && !balances.hasAnyFunds) || !balances?.networks?.[selectedNetwork]?.hasEnoughFunds} 
      onClick={claim} 
      className="px-4 py-2 rounded-xl bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isClaiming ? 'Reclamando…' : 
       balances && !balances.hasAnyFunds ? 'Sin fondos disponibles' :
       balances && !balances.networks?.[selectedNetwork]?.hasEnoughFunds ? `Sin fondos en ${currentNetwork.name}` :
       `Reclamar ${currentNetwork.amount} ${currentNetwork.symbol} en ${currentNetwork.name}`}
    </button>

    {status && <p className="text-sm text-neutral-300">{status}</p>}

    {/* Modal de Estadísticas */}
    {showStats && stats && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">📊 Estadísticas del Faucet</h2>
            <button 
              onClick={() => setShowStats(false)}
              className="text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          <div className="grid gap-4">
            {/* Resumen general */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium mb-2">Resumen General</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Total Claims:</span>
                  <span className="ml-2 font-mono">{stats.totalClaims}</span>
                </div>
                <div>
                  <span className="text-gray-400">Precio ETH:</span>
                  <span className="ml-2 font-mono">${stats.ethPrice?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Stats por red */}
            {Object.entries(stats.networks).map(([network, data]: [string, any]) => (
              <div key={network} className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium mb-2 capitalize">
                  {network.toLowerCase().replace('_', ' ')}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Claims:</span>
                    <span className="ml-2 font-mono">{data.totalClaims}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Total {data.symbol}:</span>
                    <span className="ml-2 font-mono">{data.totalAmountETH?.toFixed(6)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">Valor USD:</span>
                    <span className="ml-2 font-mono text-green-400">
                      ${data.totalAmountUSD?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Total en USD */}
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <h3 className="font-medium text-green-400 mb-2">💰 Total Distribuido</h3>
              <div className="text-2xl font-mono text-green-400">
                ${Object.values(stats.networks).reduce((acc: number, data: any) => acc + (data.totalAmountUSD || 0), 0).toFixed(2)} USD
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Actualizado: {new Date(stats.lastUpdated).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Sección de Sponsors */}
    <section className="bg-gray-900/50 rounded-xl p-6 mt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            🤝 Sponsors del Faucet
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Gracias a quienes mantienen este faucet funcionando
          </p>
        </div>
      </div>

      {/* Loading state */}
      {loadingSponsors && (
        <div className="text-center py-8 text-gray-400">
          <p>🔄 Cargando sponsors...</p>
        </div>
      )}

      {/* Lista de sponsors */}
      <div className="grid gap-4 md:grid-cols-2">
        {sponsors?.sponsors?.length > 0 ? (
          sponsors.sponsors.map((sponsor: any) => (
            <SponsorCard key={sponsor.id} sponsor={sponsor} />
          ))
        ) : !loadingSponsors ? (
          <div className="col-span-2 text-center py-8 text-gray-400">
            <p>🙏 Sé el primer sponsor del faucet</p>
            <p className="text-sm mt-2">
              Las donaciones ayudan a mantener el faucet funcionando para todos
            </p>
          </div>
        ) : null}

        {/* Tarjeta para convertirse en sponsor */}
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-4">
          <h3 className="font-medium mb-2 text-green-400">💝 ¿Quieres ser sponsor?</h3>
          <p className="text-sm text-gray-400 mb-3">
            Dona ETH a la wallet del faucet y aparecerás aquí con tu perfil de X
          </p>
          
          <div className="space-y-2 text-xs">
            <p className="text-xs text-gray-500 mt-2">
              Envía un DM a <a href="https://x.com/ETHCincoDeMayo" target="_blank" rel="noopener noreferrer" className="text-blue-400">@ETHCincoDeMayo</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>
  );
}

// Componente para mostrar cada sponsor
function SponsorCard({ sponsor }: { sponsor: any }) {
  const getNetworkInfo = (network: string) => {
    const networks: { [key: string]: { name: string; color: string; explorer: string; symbol: string } } = {
      arbitrum: { name: 'Arbitrum', color: 'text-blue-400', explorer: 'https://arbiscan.io/tx/', symbol: 'ETH' },
      base: { name: 'Base', color: 'text-blue-500', explorer: 'https://basescan.org/tx/', symbol: 'ETH' },
      monadTestnet: { name: 'Monad', color: 'text-purple-400', explorer: 'https://explorer.monad.xyz/tx/', symbol: 'MON' }
    };
    return networks[network] || { name: network, color: 'text-gray-400', explorer: '#', symbol: 'ETH' };
  };

  const networkInfo = getNetworkInfo(sponsor.network);

  return (
    <div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
          {sponsor.avatar ? (
            <img 
              src={sponsor.avatar}
              alt={sponsor.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
              }}
            />
          ) : null}
          <div className="w-full h-full flex items-center justify-center text-xl" style={{display: sponsor.avatar ? 'none' : 'flex'}}>
            🤝
          </div>
        </div>

        {/* Info del sponsor */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium">{sponsor.name}</h3>
            <a 
              href={`https://x.com/${sponsor.twitterHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              @{sponsor.twitterHandle}
            </a>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>
              💎 <span className="text-green-400 font-mono">
                {sponsor.donationAmount} {networkInfo.symbol}
              </span>
            </span>
            <span className={networkInfo.color}>
              📡 {networkInfo.name}
            </span>
          </div>

          {/* Hash de transacción */}
          {sponsor.txHash && (
            <div className="mt-2">
              <a 
                href={`${networkInfo.explorer}${sponsor.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-400 font-mono"
              >
                🔗 {sponsor.txHash.slice(0, 10)}...{sponsor.txHash.slice(-8)}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
