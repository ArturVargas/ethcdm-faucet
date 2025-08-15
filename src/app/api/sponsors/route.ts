import { NextRequest, NextResponse } from 'next/server';

interface SponsorData {
  id: string;
  name: string;
  twitterHandle: string;
  donationAmount: string;
  network: string;
  txHash?: string;
  avatar?: string;
}

export async function GET(req: NextRequest) {
  try {
    const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_CSV_URL;

    if (!GOOGLE_SHEET_URL) {
      return NextResponse.json({ error: 'Google Sheets CSV URL not configured' }, { status: 500 });
    }

    console.log('Fetching sponsors from Google Sheets CSV...');
    
    const response = await fetch(GOOGLE_SHEET_URL);
    
    if (!response.ok) {
      console.error('Error fetching from Google Sheets:', response.status, response.statusText);
      return NextResponse.json({ error: 'Failed to fetch sponsors data' }, { status: 500 });
    }

    const csvText = await response.text();
    
    if (!csvText || csvText.trim().length === 0) {
      return NextResponse.json({ sponsors: [] });
    }

    // Convertir CSV a array de arrays
    const rows = parseCSV(csvText);
    
    if (rows.length === 0) {
      return NextResponse.json({ sponsors: [] });
    }

    // Convertir datos de CSV a formato de sponsors
    const sponsors = parseSponsorsData(rows);
    
    console.log(`Successfully fetched ${sponsors.length} sponsors`);
    
    return NextResponse.json({
      sponsors,
      lastUpdated: new Date().toISOString(),
      totalSponsors: sponsors.length,
      totalDonated: sponsors.reduce((acc, sponsor) => acc + parseFloat(sponsor.donationAmount || '0'), 0)
    });

  } catch (error) {
    console.error('Error in sponsors endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseCSV(csvText: string): string[][] {
  const lines = csvText.trim().split('\n');
  const result: string[][] = [];
  
  for (const line of lines) {
    // Simple CSV parsing - maneja comas dentro de comillas
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Agregar el último campo
    row.push(current.trim());
    
    // Limpiar comillas de los campos
    const cleanedRow = row.map(field => field.replace(/^"|"$/g, ''));
    result.push(cleanedRow);
  }
  
  return result;
}

function parseSponsorsData(rows: string[][]): SponsorData[] {
  // Asumiendo que la primera fila son los headers:
  // [Name, Twitter Handle, Donation Amount, Network, TX Hash, Avatar URL]
  
  const headers = rows[0];
  const dataRows = rows.slice(1);
  
  console.log('Headers found:', headers);
  console.log(`Processing ${dataRows.length} sponsor rows`);
  
  return dataRows
    .filter(row => row.length > 0 && row[0]) // Filtrar filas vacías
    .map((row, index) => {
      const sponsor: SponsorData = {
        id: `sponsor-${index + 1}`,
        name: row[0] || '',
        twitterHandle: (row[1] || '').replace('@', ''), // Remover @ si existe
        donationAmount: row[2] || '0',
        network: normalizeNetwork(row[3] || ''),
        txHash: row[4] || undefined,
        avatar: row[5] || undefined
      };

      // Si no hay avatar, generar uno automáticamente basado en el handle de Twitter
      if (!sponsor.avatar && sponsor.twitterHandle) {
        sponsor.avatar = `https://unavatar.io/x/${sponsor.twitterHandle}`;
      }

      return sponsor;
    })
    .filter(sponsor => sponsor.name && sponsor.twitterHandle); // Solo sponsors válidos
}

function normalizeNetwork(network: string): string {
  const normalized = network.toLowerCase().trim();
  
  const networkMap: { [key: string]: string } = {
    'arbitrum': 'arbitrum',
    'arbitrum one': 'arbitrum',
    'arb': 'arbitrum',
    'base': 'base',
    'base mainnet': 'base',
    'monad': 'monadTestnet',
    'monad testnet': 'monadTestnet',
    'monad test': 'monadTestnet'
  };
  
  return networkMap[normalized] || normalized;
}
