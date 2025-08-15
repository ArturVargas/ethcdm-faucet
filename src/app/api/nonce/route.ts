import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function randInt(min:number,max:number){return Math.floor(Math.random()*(max-min+1))+min}

export async function POST(_req: NextRequest) {
  const a = randInt(7, 19), b = randInt(6, 18);
  const text = `¿Cuánto es ${a} + ${b}?`;
  const expected = String(a + b);

  // store captcha with TTL
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (Number(process.env.CAPTCHA_TTL_MIN||'7')*60*1000)).toISOString();
  const message = `ETHCDM Faucet\nCaptcha ID: ${id}`;
  
  // Insertar captcha primero
  const { data: captchaData, error: captchaError } = await supabase.from('captcha').insert({ 
    id, 
    expected_hash: await hash(expected), 
    expires_at: expiresAt
  });

  if (captchaError) {
    console.error('Error insertando captcha:', captchaError);
    return NextResponse.json({ error: 'Error creando captcha' }, { status: 500 });
  }

  // Luego insertar nonce (ya no lo necesitamos para este flujo simplificado)
  console.log('Captcha creado:', { id });

  return NextResponse.json({ id, text, message });
}

async function hash(s: string){
  const enc = new TextEncoder().encode(s + (process.env.SERVER_HMAC_SECRET||''));
  const h = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
