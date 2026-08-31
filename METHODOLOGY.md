# Metodología de VADO Evaluator

**Qué hace esta herramienta, qué no hace, y qué habría que hacer para que hiciera más.**

Versión de este documento: 31 de agosto de 2026.

---

## 1 · Lo primero, porque es lo que se malinterpreta

**VADO Evaluator no mide actividad cerebral.** No hay electrodos, no hay resonancia, no hay
seguimiento ocular y no hay una persona mirando el estímulo mientras se genera el resultado.

Lo que hace es **evaluar una pieza publicitaria con una rúbrica propia, asistida por
inteligencia artificial**, y devolver un perfil por las cuatro dimensiones del método VADO.
El resultado son **hipótesis de diseño**, no hallazgos: dicen dónde mirar, no qué ocurrió.

La figura tridimensional de la interfaz es una **simulación de cómo podría responder un
lector**, no una representación de lo que sucede en un cerebro concreto. Se conserva porque
comunica bien el perfil de las cuatro dimensiones, y lleva esa aclaración dentro de la propia
pieza.

---

## 2 · Las cuatro dimensiones

| | Qué evalúa |
|---|---|
| **Ver** | Saliencia visual, jerarquía y contraste: si la pieza gana la mirada en el primer segundo |
| **Activar** | Emoción, relato y personajes: si mueve algo antes de que el lector razone |
| **Decidir** | Claridad de la propuesta, argumento y credibilidad |
| **Operar** | Facilidad de la acción: qué tiene que hacer el lector y qué tan fácil se lo ponen |

Son **dimensiones funcionales del estímulo**, no regiones anatómicas. Cualquier lectura que
las traduzca a partes del cerebro está añadiendo una afirmación que la herramienta no
sostiene.

---

## 3 · Cómo funciona por dentro

```
GitHub Pages (HTML estático)
        │  fetch POST
        ▼
Cloudflare Worker proxy      (GEMINI_API_KEY como secret)
        │  traduce el formato
        ▼
generativelanguage.googleapis.com
        │
        ▼
Gemini 2.5 Flash Lite (multimodal)
```

**El modelo es Gemini 2.5 Flash Lite, de Google.** Conviene decirlo con claridad porque hasta
el 31 de agosto de 2026 este repositorio afirmaba usar Claude Sonnet 4 de Anthropic, y no era
cierto: el Worker acepta cargas con formato de Anthropic —que es lo que envía el frontend— y
las traduce a Gemini. Esa traducción explica el equívoco, pero el modelo que evalúa es Gemini.

La clave nunca viaja al navegador. El Worker limita a veinte evaluaciones por hora y por
dirección IP.

---

## 4 · Qué NO se puede concluir de un resultado

- **Que una pieza «activa» una zona del cerebro.** No se midió ninguna.
- **Que una pieza va a funcionar mejor que otra.** El modelo puntúa una rúbrica; no predice
  ventas, recordación ni conversión.
- **Que dos evaluaciones son comparables como una medición.** Un modelo generativo puede dar
  resultados distintos ante la misma entrada.
- **Que el resultado sustituye una prueba con personas.** Es lo contrario: sirve para decidir
  qué vale la pena probar.

---

## 5 · Dónde encaja en el laboratorio

VISORIA Behavioral Lab trabaja en dos capas, y VADO está en la primera:

| Capa | Qué la compone | Qué produce |
|---|---|---|
| **Predicción computacional** | VADO, EyeRubi Web, Color Lab | Hipótesis, antes del laboratorio y sin participantes |
| **Medición experimental** | EyeRubi Studio con el eye tracker MyGaze, EvalNI, análisis facial | Datos registrados de personas reales |

La distinción no es de calidad sino de naturaleza. Lo barato y rápido descarta y prioriza; lo
caro y lento comprueba. **VADO propone lo que la otra capa puede validar.**

---

## 6 · Deuda declarada, para una versión 2

El código conserva nombres de campo con lenguaje anatómico (`frontal`, `parietal`,
`temporal`, `occipital`, y el orden de lóbulos en la figura). **No se han renombrado a
propósito**: forman parte del contrato de datos, y cambiarlos rompería los resultados ya
guardados y cualquier integración.

Se dejan anotados aquí para una migración formal con `schema_version`, donde la versión 1
quede como legado y la 2 use nombres que digan lo que miden. Mientras tanto, la interfaz los
traduce a la etiqueta correcta y el usuario no ve anatomía en ninguna parte.

Tampoco se han tocado los prompts, los pesos, los umbrales ni la temperatura del modelo. Esta
intervención fue de lenguaje y documentación: **la herramienta hace exactamente lo mismo que
antes y lo cuenta bien.**
