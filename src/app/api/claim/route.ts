import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, createWalletClient, http, parseUnits, recoverMessageAddress, getAddress, erc20Abi } from 'viem';
import { arbitrum, optimism, base, monadTestnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts';

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PULPA = (process.env.NEXT_PUBLIC_OP_PULPA as `0x${string}`);
const WINDOW_HOURS = Number(process.env.WINDOW_HOURS || '48');

const opClient = createPublicClient({ chain: optimism, transport: http(process.env.OP_RPC_URL) });

// Configuración de redes soportadas
const NETWORKS = {
  arbitrum: {
    chain: arbitrum,
    privateKey: process.env.FAUCET_PRIVATE_KEY as `0x${string}`,
    amount: BigInt(process.env.CLAIM_AMOUNT_WEI || '186200000000000'), // 0.0001862 ETH
    symbol: 'ETH',
    name: 'Arbitrum One'
  },
  monadTestnet: {
    chain: monadTestnet,
    // rpcUrl: process.env.MONAD_TESTNET_RPC_URL, // Esta puede necesitar RPC custom
    privateKey: process.env.FAUCET_PRIVATE_KEY as `0x${string}`,
    amount: BigInt(process.env.CLAIM_AMOUNT_WEI || '18620000000000000'), // 0.01862 MON
    symbol: 'MON',
    name: 'Monad Testnet'
  },
  base: {
    chain: base,
    privateKey: process.env.FAUCET_PRIVATE_KEY as `0x${string}`,
    amount: BigInt(process.env.CLAIM_AMOUNT_WEI || '186200000000000'), // 0.0001862 ETH
    symbol: 'ETH',
    name: 'Base'
  }
};

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const { address, signature, captchaId, answer, network = 'arbitrum' } = await req.json();
    if (!address || !signature || !captchaId || !answer) {
      return NextResponse.json({ error: 'Campos incompletos' }, { status: 400 });
    }

    // Validar red soportada
    if (!NETWORKS[network as keyof typeof NETWORKS]) {
      return NextResponse.json({ error: 'Red no soportada' }, { status: 400 });
    }

    const networkConfig = NETWORKS[network as keyof typeof NETWORKS];
    const claimant = getAddress(address);

    // 1) Verificar captcha
    console.log('Buscando captcha con ID:', captchaId);
    const { data: captchaRow, error: captchaError } = await supa.from('captcha').select('*').eq('id', captchaId).single();
    
    if (captchaError) {
      console.error('Error consultando captcha:', captchaError);
    }
    console.log('Captcha encontrado:', captchaRow);
    
    if (!captchaRow) return NextResponse.json({ error: 'Captcha inválido' }, { status: 400 });
    if (new Date(captchaRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Captcha expirado' }, { status: 400 });
    }
    
    const providedHash = await hashAnswer(answer);
    if (providedHash !== captchaRow.expected_hash) {
      return NextResponse.json({ error: 'Respuesta incorrecta' }, { status: 400 });
    }

    // 2) Verificar firma - usar mensaje simple y consistente
    const message = `ETHCDM Faucet\nCaptcha ID: ${captchaId}`;
    console.log('Mensaje para verificar firma:', message);
    
    const signer = await recoverMessageAddress({ message, signature });
    console.log('Firmante recuperado:', signer, 'vs Claimant:', claimant);
    
    if (getAddress(signer) !== claimant) {
      return NextResponse.json({ error: 'Firma no corresponde al address' }, { status: 400 });
    }

    // Verificar el último claim del usuario
    const { data: lastClaim } = await supa
      .from('claims')
      .select('*')
      .eq('address', claimant)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastClaim) {
      const lastClaimTime = new Date(lastClaim.created_at).getTime();
      const now = Date.now();
      const timeDiff = now - lastClaimTime;
      const cooldownMs = WINDOW_HOURS * 60 * 60 * 1000; // 48 horas en ms

      if (timeDiff < cooldownMs) {
        const nextEligibleAt = new Date(lastClaimTime + cooldownMs).toISOString();
        const hoursLeft = Math.ceil((cooldownMs - timeDiff) / (60 * 60 * 1000));
        
        return NextResponse.json({ 
          error: `Debes esperar ${hoursLeft} horas desde tu último reclamo. Próximo reclamo disponible: ${nextEligibleAt}`,
          nextEligibleAt: nextEligibleAt,
          txHash: lastClaim.tx_hash
        }, { status: 429 });
      }
    }

    // Crear wallet client para la red seleccionada
    const wallet = createWalletClient({
      chain: networkConfig.chain,
      transport: http(), // Usa RPC público si no hay custom
      account: privateKeyToAccount(networkConfig.privateKey)
    });

    // Enviar fondos en la red seleccionada
    const hash = await wallet.sendTransaction({ to: claimant, value: networkConfig.amount });
    const txHash = hash as `0x${string}`;

    // Registrar el claim en la base de datos y limpiar captcha
    const now = new Date().toISOString();
    const nextEligibleAt = new Date(Date.now() + WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    
    // Mapear network key a valor del enum de Supabase
    const networkEnumMap: { [key: string]: string } = {
      'arbitrum': 'ARBITRUM',
      'base': 'BASE', 
      'monadTestnet': 'MONAD_TESTNET'
    };

    const [{ data: insertData, error: insertError }] = await Promise.all([
      supa.from('claims').insert({
        address: claimant,
        window_start: now,
        next_eligible_at: nextEligibleAt,
        tx_hash: txHash,
        network: networkEnumMap[network] || 'ARBITRUM', // Usar enum de Supabase
        amount: networkConfig.amount.toString(),
        ip: ip
      }),
      supa.from('captcha').delete().eq('id', captchaId) // Limpiar captcha usado
    ]);

    if (insertError) {
      console.error('Error al insertar en DB:', insertError);
      return NextResponse.json({ error: 'Error al registrar claim' }, { status: 500 });
    }

    console.log('Claim registrado exitosamente:', insertData);
    return NextResponse.json({ ok: true, txHash, nextEligibleAt });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Fallo inesperado' }, { status: 500 });
  }
}

async function hashAnswer(s: string){
  const enc = new TextEncoder().encode(s + (process.env.SERVER_HMAC_SECRET||''));
  const h = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
