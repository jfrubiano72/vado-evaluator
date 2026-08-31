# VADO Evaluator · Behavioral Intelligence Lab

Aplicación web para evaluar estímulos publicitarios bajo la metodología **VADO** (Ver · Activar · Decidir · Operar), desarrollada por Javier Rubiano para la cátedra de Neuromarketing del posgrado en la Universidad de La Salle.

**Demo en vivo:** [https://jfrubiano72.github.io/vado-evaluator/](https://jfrubiano72.github.io/vado-evaluator/)

---

## ¿Qué hace?

Permite a los estudiantes evaluar una idea de campaña, una imagen publicitaria o una landing page bajo los cuatro ejes del framework VADO. Para cada estímulo entrega:

- **Score global** (0–100) con veredicto
- **Puntaje por eje** (V·A·D·O) con barras y insights
- **Fortalezas detectadas** y **áreas de riesgo**
- **Mapa de activación neural** (Occipital · Temporal · Límbico · Parietal · Frontal)
- **Recomendaciones accionables** priorizadas por impacto

---

## Metodología VADO

| Eje | Pregunta clave | Zona cerebral |
|-----|---------------|---------------|
| **V**er | ¿Gana la atención antes que el competidor? | Lóbulo occipital |
| **A**ctivar | ¿Emociona, conecta, se siente humano? | Sistema límbico + hemisferio derecho |
| **D**ecidir | ¿Da razones defendibles para decidir? | Lóbulo frontal + hemisferio izquierdo |
| **O**perar | ¿Facilita la acción sin carga cognitiva? | Lóbulo parietal-frontal |

Metodología desarrollada por Javier Rubiano como parte del Behavioral Intelligence Lab.

---

## Arquitectura

```
 Estudiante (navegador)
        │
        ▼
 GitHub Pages (HTML estático)
        │
        ▼  fetch POST
 Cloudflare Worker proxy
 (GEMINI_API_KEY como secret)
        │
        ▼
 generativelanguage.googleapis.com
        │
        ▼
 Gemini 2.5 Flash Lite (multimodal)
```

La API key **nunca** viaja al navegador del estudiante. El Worker aplica rate-limiting por IP (20 evaluaciones/hora) para proteger la cuenta.

---

## Cómo desplegar (si clonas este repo)

### 1. Deployar el Worker de Cloudflare

```bash
# Instalar wrangler (CLI de Cloudflare Workers)
npm install -g wrangler

# Autenticarse con tu cuenta de Cloudflare
wrangler login

# Guardar la API key como secret
wrangler secret put GEMINI_API_KEY
# (pega tu key cuando pregunte)

# Deploy
wrangler deploy
```

El worker quedará en `https://vado-evaluator.<tu-subdominio>.workers.dev`.

### 2. Editar `index.html`

Cambia la línea:
```js
const API_ENDPOINT = 'https://vado-evaluator.jfrubiano.workers.dev';
```
por tu URL de Worker.

### 3. Habilitar GitHub Pages

En Settings → Pages del repo, selecciona branch `main` y carpeta `/root`.

---

## Estructura del repositorio

```
vado-evaluator/
├── index.html          ← app frontend (GitHub Pages)
├── worker.js           ← proxy Cloudflare Worker
├── wrangler.toml       ← configuración del Worker
└── README.md
```

---

## Uso en clase

Los estudiantes pueden usar la app en tres modos:

1. **Idea / Brief** — describen la campaña en texto (120-500 palabras)
2. **Imagen / Aviso** — suben una pieza gráfica (JPG, PNG, WEBP hasta 5MB)
3. **URL / Landing** — pegan el enlace de una página web a evaluar

Opcionalmente pueden agregar la audiencia objetivo para análisis más preciso.

---

## Ejercicio sugerido para estudiantes

1. Escojan una campaña publicitaria reciente (su marca favorita o una que critican)
2. Evalúenla con VADO Evaluator en los tres modos disponibles
3. Comparen los scores con su propia intuición: ¿coincide?
4. Aplica las recomendaciones: rediseñen la pieza y vuelvan a evaluarla
5. Presenten el antes/después en clase

---

## Créditos

- **Autor:** Javier Fernando Rubiano Espinosa — [javierrubiano.com](https://javierrubiano.com)
- **Cátedra:** Neuromarketing · Posgrado · Universidad de La Salle
- **Lab:** Behavioral Intelligence Lab · VISORIA Intelligence
- **Tecnología:** Gemini 2.5 Flash Lite (Google), Cloudflare Workers, GitHub Pages

---

## Licencia

Uso educativo. Para uso comercial, contactar al autor.
