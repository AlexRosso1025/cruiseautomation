# RCL Price Tracker

Monitorea el precio de un crucero puntual de Royal Caribbean (Grandeur of
the Seas, 7 noches Southern Caribbean desde Cartagena) en **dos mercados a
la vez** — LAC (Argentina) y US — y te avisa por email cuando alguno
cambia. Corre en GitHub Actions, gratis.

## Cómo funciona

Royal Caribbean sirve los precios de cada itinerario desde un endpoint
REST **público, sin auth y sin Akamai**:

```
GET https://www.royalcaribbean.com/itinerary/api/v1/sailings
    ?packageCode=GR7IP220
    &groupId=GR07CTG-1478956324
    &sailDate=2026-10-18
    &adults=2&children=0
    &countryCode=ARG          ← el parámetro que cambia el precio por mercado
    &currencyCode=USD
    &languageCode=es
```

Devuelve, para cada fecha de zarpada del paquete, las 4 categorías de
camarote con su precio:

```jsonc
{
  "sailings": [{
    "sailDate": "2026-10-18",
    "status": "OPEN",
    "includesTaxesAndFees": true,
    "rooms": [
      { "code": "INTERIOR", "pricing": { "amount": 3218.75, "total": 6437.5 } },
      { "code": "OUTSIDE",  "pricing": { "amount": 1989.25, "total": 3978.5 } },
      { "code": "BALCONY",  "pricing": { "amount": 3170.75, "total": 6341.5 } },
      { "code": "DELUXE",   "pricing": { "amount": 3056.25, "total": 6112.5 } }
    ]
  }]
}
```

`amount` = precio por persona · `total` = precio para 2 pax. Si una
categoría está agotada en ese mercado, viene sin `pricing` → se guarda
como `null`.

El script:

1. Pega al endpoint una vez por mercado (`countryCode=ARG` y `=USA`).
2. Busca el `sailing` con el `sailDate` objetivo y arma los 4 precios.
3. Guarda **ambos mercados** en `data/price-history.json` con timestamp.
4. Compara contra la corrida anterior; si algún precio cambió (o es la
   primera corrida), manda un email con la tabla comparativa lado a lado.

No usa navegador. `npm ci` + un `fetch` — la corrida entera son segundos.

> **Si algún día el endpoint empieza a tirar 403** (Akamai endureciendo),
> hay que agregar un warm-up: abrir una página de RC con un navegador
> real para juntar las cookies y reintentar el fetch con esas cookies.
> Hoy no hace falta.

## Uso local

```bash
npm install

# Ver los dos mercados sin tocar nada (genera un report.html):
npm run debug

# Corrida real (guarda historial, manda email si cambió):
npm run check

# Chequeo de tipos:
npm run typecheck
```

### Correr cada hora en Windows (sin GitHub)

1. Copiá `.env.example` a `.env` y completá el email.
2. Doble clic en `scripts\schedule-hourly.bat` → crea una tarea programada
   que corre cada hora **sin abrir ventana**. Resultado en `data\run.log`.
3. Para sacarla: `scripts\unschedule.bat`.

Otros scripts:

- `scripts\run-check.bat` — un chequeo suelto (lo usa la tarea).
- `scripts\loop-hourly.bat` — si preferís dejar una ventana abierta en
  loop en vez de la tarea programada.
- `npm run check:local` — un chequeo leyendo `.env` (equivale a
  `run-check.bat` pero por consola).

La tarea sólo corre con la compu prendida y tu usuario logueado. Si querés
que corra siempre, usá GitHub Actions.

---

`npm run debug` deja en `data/debug/<timestamp>/`:

- `report.html` — tabla comparativa LAC vs US, se abre con doble clic
- `<mercado>/response-body.json` — la respuesta cruda del endpoint
- `<mercado>/summary.json` — precios parseados + fechas disponibles
- `comparison.json` — resumen

### Configuración

Todo por variable de entorno (ver `.env.example`). Lo mínimo:

| Var | Default | Qué es |
|-----|---------|--------|
| `TARGET_SAIL_DATE` | `2026-10-18` | fecha de zarpada a trackear (`YYYY-MM-DD`) |
| `EMAIL_TO` / `EMAIL_FROM` | — | tu Gmail |
| `GMAIL_APP_PASSWORD` | — | contraseña de aplicación de Gmail (2FA → Contraseñas de aplicaciones) |

Opcionales: `PACKAGE_CODE`, `GROUP_ID`, `SHIP_CODE`, `ADULTS`, `CHILDREN`,
`LAC_COUNTRY_CODE` (ARG/COL/CHL/…), `US_ENABLED=false` (trackea sólo LAC),
`FORCE_EMAIL=true`, `FETCH_RETRIES`.

## Dónde desplegar gratis

| Opción | Gratis | Notas |
|---|---|---|
| **GitHub Actions** (recomendado, ya está) | ✅ ilimitado en repos públicos; 2000 min/mes privados | Cron cada hora, commitea el historial, manda el mail. No hay que mantener nada prendido. **Es el deploy** — sólo hay que hacer `git push`. |
| **Tu PC con Task Scheduler** | ✅ | `scripts\schedule-hourly.bat`. Corre sólo cuando la compu está prendida y tu usuario logueado. Útil si no querés subir a GitHub. |
| Cloudflare Workers (cron) | ✅ | Habría que portar: los Workers no hacen SMTP → mandar el mail con una API (Resend/MailChannels) y guardar el historial en KV en vez de un archivo. |
| Val Town / Deno Deploy (cron) | ✅ | Igual que arriba: reescribir el envío de mail y el storage. |
| Render / Railway / Fly.io cron | ⚠️ | Free tiers recortados o con tarjeta. No vale la pena para esto. |

Para un tracker de una fecha puntual, **GitHub Actions es la respuesta**.
El resto sólo tiene sentido si ya vivís en esa plataforma.

## GitHub Actions

`.github/workflows/check-price.yml` corre cada hora (`cron: "0 * * * *"`)
y también a mano desde **Actions → Check Royal Caribbean price → Run
workflow**.

**Settings → Secrets and variables → Actions:**

- *Secrets*: `EMAIL_TO`, `EMAIL_FROM`, `GMAIL_APP_PASSWORD`
- *Variables* (opcional): `TARGET_SAIL_DATE`, `PACKAGE_CODE`, `GROUP_ID`,
  `LAC_COUNTRY_CODE`, `US_ENABLED`, `FORCE_EMAIL`

El workflow commitea `data/price-history.json` de vuelta al repo en cada
corrida (necesita `permissions: contents: write`, ya está en el yml).

## Notas

- **Los precios cambian por categoría, no en bloque.** Puede que US esté
  más barato en Interior pero LAC tenga una promo en Exterior. Por eso el
  email muestra las 4 categorías de los dos mercados.
- El historial suma una entrada por corrida (4/día). El JSON es chico;
  si molesta el ruido en git, se puede pasar a "guardar sólo si cambió".
- Datos públicos que el propio sitio le muestra a cualquiera. Sin bypass
  de auth ni de paywall. 6 h es un intervalo tranquilo.
