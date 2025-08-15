# 🚰 ETHCDM Faucet

Un faucet multi-red para distribuir tokens de prueba en diferentes blockchains. Desarrollado para la comunidad ETHCDM (Ethereum Cinco de Mayo).

## 🌟 Características

### 🔗 **Soporte Multi-Red**
- **Arbitrum One**: Distribuye 0.0001862 ETH
- **Base**: Distribuye 0.0001862 ETH  
- **Monad Testnet**: Distribuye 0.01862 MON

### 🛡️ **Sistema de Seguridad**
- **Captcha matemático**: Previene bots
- **Firma de mensaje**: Valida propiedad de la wallet
- **Rate limiting**: 48 horas de cooldown por usuario
- **Validación de fondos**: Solo permite claims si el faucet tiene suficientes fondos

### 📊 **Estadísticas en Tiempo Real**
- Total de claims por red
- Valor total distribuido en USD
- Precio actual de ETH (via CoinGecko)
- Fondos disponibles en cada red

### 🤝 **Sistema de Sponsors**
- Muestra donantes del faucet
- Integración con Google Sheets para datos dinámicos
- Enlaces a perfiles de X (Twitter)
- Transacciones verificables en exploradores

### 💰 **Validación de Balance**
- Verifica fondos disponibles en cada red
- Deshabilita opciones sin fondos suficientes
- Muestra estimación de claims posibles

## 🚀 Instalación

### Prerrequisitos
- Node.js 18+ 
- npm o yarn
- Cuenta en Supabase
- Wallets con fondos en las redes soportadas

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd ethcdm-faucet
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env.local` con las siguientes variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Wallets del Faucet
FAUCET_PRIVATE_KEY=0x... # Clave privada de la wallet del faucet

# Cantidad a distribuir (en wei)
CLAIM_AMOUNT_WEI=186200000000000

# RPC URLs (opcionales, usa públicos por defecto)
ARB_RPC_URL=https://arb1.arbitrum.io/rpc
BASE_RPC_URL=https://base-mainnet.public.blastapi.io
MONAD_TESTNET_RPC_URL=your_monad_rpc_url

# Google Sheets para sponsors
GOOGLE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/.../export?format=csv
```

### 4. Configurar base de datos Supabase

#### Tabla `claims`
```sql
CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  window_start timestamptz NOT NULL,
  next_eligible_at timestamptz NOT NULL,
  tx_hash text,
  ip text,
  network text,
  amount text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ON public.claims (address, window_start);
```

#### Tabla `captcha`
```sql
CREATE TABLE public.captcha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  expected_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 5. Ejecutar en desarrollo
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) para ver la aplicación.

## 📋 Uso

### Para Usuarios
1. **Conecta tu wallet** usando MetaMask o similar
2. **Selecciona una red** (Arbitrum, Base, o Monad Testnet)
3. **Resuelve el captcha** matemático
4. **Firma el mensaje** para verificar tu wallet
5. **Recibe los tokens** automáticamente

### Para Administradores
- **Monitorear claims**: Revisa la tabla `claims` en Supabase
- **Agregar fondos**: Envía tokens a las wallets del faucet
- **Actualizar sponsors**: Modifica la Google Sheet vinculada
- **Ver estadísticas**: Usa el endpoint `/api/stats`

## 🏗️ Arquitectura

### Frontend
- **Next.js 14** con App Router
- **TypeScript** para type safety
- **Tailwind CSS** para estilos
- **Viem** para interacción con blockchains

### Backend (API Routes)
- `/api/nonce` - Genera captcha y mensaje para firma
- `/api/claim` - Procesa claims y envía transacciones
- `/api/stats` - Estadísticas del faucet
- `/api/balances` - Verifica fondos disponibles
- `/api/sponsors` - Obtiene datos de sponsors

### Base de Datos
- **Supabase** (PostgreSQL)
- Row Level Security (RLS) habilitado
- Service Role Key para operaciones backend

## 🔧 Configuración Avanzada

### Agregar Nueva Red
1. Actualizar `NETWORKS` en `/api/claim/route.ts`
2. Agregar opción en `NETWORK_OPTIONS` en `page.tsx`
3. Configurar RPC y wallet para la nueva red

### Personalizar Cantidades
Modifica `CLAIM_AMOUNT_WEI` en las variables de entorno:
- Arbitrum: `186200000000000` (0.0001862 ETH)
- Base: `186200000000000` (0.0001862 ETH)
- Monad: `18620000000000000` (0.01862 MON)

### Integrar Google Sheets
1. Crea una hoja con columnas: `name`, `twitterHandle`, `donationAmount`, `network`, `txHash`, `avatar`
2. Comparte la hoja como CSV público
3. Configura `GOOGLE_SHEET_CSV_URL` en las variables de entorno

## 🚀 Despliegue

### Vercel (Recomendado)
1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Deploy automático en cada push

### Otros Proveedores
- **Netlify**: Compatible con Next.js
- **Railway**: Soporte nativo para Node.js
- **DigitalOcean App Platform**: Escalable y confiable

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🙏 Agradecimientos

- **ETHCDM y Frutero Community** por el apoyo


## 📞 Contacto

- **Twitter**: [@ETHCincoDeMayo](https://x.com/ETHCincoDeMayo)
- **GitHub**: [Issues del repositorio](https://github.com/ArturVargas/ethcdm-faucet)

---

**¡Gracias por usar ETHCDM Faucet! 🎉**
