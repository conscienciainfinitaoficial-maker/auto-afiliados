# Auto-Afiliados: Bot Autónomo de Marketing de Afiliados

*Un agente de IA que encuentra productos digitales, genera copies, cierra ventas y te deposita el 80% de las ganancias.*

---

Este proyecto es un **fork modificado** de [Conway-Research/automaton](https://github.com/Conway-Research/automaton) (MIT License) convertido en un **generador de ingresos autónomo** para marketing de afiliados.

## Diferencias clave con el original

| Original | Auto-Afiliados |
|---|---|
| Agente soberano que trabaja para sí mismo | Agente que trabaja para **tu billetera** |
| Muere si no tiene créditos | **Nunca muere** — entra en modo campaña agresiva |
| 100% de ganancias para su propia infra | **80% para ti**, 20% para infraestructura |
| Sin pipeline de ventas | Pipeline completo: caza → copia → cierre |
| Sin sistema de tesorería | **Profit sweep** automático cada 12h a tu Master Wallet |

## Cómo funciona

```
1. CAZA → Filtra productos con comisión >60% y demanda caliente
2. COPIA → Genera copies AIDA/PAS con IA
3. CIERRE → Distribuye por WhatsApp/Telegram 
4. BARRIDO → 80% a tu wallet, 20% para infraestructura
5. ESCALA → Si es rentable, se replica automáticamente
```

## Profit Split

- **80%** → Transferido automáticamente a tu Master Wallet cada 12 horas
- **20%** → Retenido para costos de infraestructura (Conway Cloud, inferencia, APIs)

## Modos de Campaña

- **NORMAL**: Operación completa. Caza productos, genera copies, optimiza conversión.
- **AGRESIVO** (low compute): Pausa búsqueda de nuevos productos. Enfoca todo en cerrar leads existentes.
- **EMERGENCIA** (crítico): Usa modelo económico. Solo cierre directo. Sin experimentos.

## Instalación Rápida

```bash
git clone <tu-repo>/auto-afiliados.git
cd auto-afiliados
npm install && npm run build
node dist/index.js --run
```

En la primera ejecución, el setup wizard te pedirá:
1. Tipo de chain (EVM o Solana)
2. Nombre del agente
3. Genesis prompt (instrucción semilla)
4. **Tu Master Wallet** (donde recibirás el 80%)
5. Split percentage y sweep interval
6. Límites financieros de seguridad

## Arquitectura

```
src/
  agent/            # System prompt, ReAct loop (modificado: Affiliate Bot directives)
  identity/         # Wallet management (modificado: Master/Worker wallets)
  identity/treasury.ts  # NUEVO: Profit sweep logic, split management
  survival/         # Resource monitor (modificado: no death, campaign modes)
  heartbeat/        # Cron daemon (modificado: retargeting, sweep tasks)
  replication/      # Child spawning (modificado: profitability checks)
  skills/           # NUEVO: hotmart_sniper.json skill
  setup/            # Setup wizard (modificado: Master Wallet config)
```

## Licencia

MIT (igual que el proyecto original)
