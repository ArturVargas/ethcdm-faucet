import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Configuración de monedas y decimales
const NETWORK_CONFIG = {
  ARBITRUM: { symbol: 'ETH', decimals: 18 },
  BASE: { symbol: 'ETH', decimals: 18 },
  MONAD_TESTNET: { symbol: 'MON', decimals: 18 }
};

export async function GET(req: NextRequest) {
  try {
    // 1) Obtener precio actual de ETH
    const ethPrice = await fetchETHPrice();
    
    // 2) Obtener estadísticas de claims por red
    const { data: claims, error } = await supa
      .from('claims')
      .select('network, amount, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching claims:', error);
      return NextResponse.json({ error: 'Error fetching stats' }, { status: 500 });
    }

    // 3) Calcular totales por red
    const stats = calculateStats(claims || [], ethPrice);
    
    return NextResponse.json({
      ethPrice,
      totalClaims: claims?.length || 0,
      networks: stats,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in stats endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function fetchETHPrice(): Promise<number> {
  try {
    // Usar CoinGecko API (gratuita)
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    return data.ethereum.usd;
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    return 2000; // Fallback price si falla la API
  }
}

function calculateStats(claims: any[], ethPrice: number) {
  const networkStats: { [key: string]: any } = {};

  // Inicializar stats para cada red
  Object.keys(NETWORK_CONFIG).forEach(network => {
    networkStats[network] = {
      totalClaims: 0,
      totalAmountWei: BigInt(0),
      totalAmountETH: 0,
      totalAmountUSD: 0,
      symbol: NETWORK_CONFIG[network as keyof typeof NETWORK_CONFIG].symbol
    };
  });

  // Agregar claims a las estadísticas
  claims.forEach(claim => {
    const network = claim.network;
    if (networkStats[network]) {
      networkStats[network].totalClaims++;
      const amountWei = BigInt(claim.amount || '0');
      networkStats[network].totalAmountWei += amountWei;
    }
  });

  // Convertir wei a ETH y calcular USD
  Object.keys(networkStats).forEach(network => {
    const config = NETWORK_CONFIG[network as keyof typeof NETWORK_CONFIG];
    const amountETH = Number(networkStats[network].totalAmountWei) / Math.pow(10, config.decimals);
    
    // Eliminar BigInt y solo guardar valores serializables
    networkStats[network] = {
      totalClaims: networkStats[network].totalClaims,
      totalAmountETH: amountETH,
      totalAmountUSD: amountETH * ethPrice,
      symbol: config.symbol
    };
  });

  return networkStats;
}
