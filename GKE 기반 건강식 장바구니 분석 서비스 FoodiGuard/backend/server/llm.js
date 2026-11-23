import './env.js';
import { GoogleGenAI } from '@google/genai';
import { buildAllergenNotices, removeGeneratedAllergyClaims } from './aiAllergenNotice.js';

const defaultModel = 'gemini-3.5-flash';
const maxItems = 8;
const maxReasons = 4;

let client;

function getClient() {
  if (!client) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
    if (!project) {
      throw new Error('GOOGLE_CLOUD_PROJECT is required to call Vertex AI.');
    }

    client = new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });
  }
  return client;
}

function compactText(value, maxLength = 240) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function compactNumber(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compactNutrients(nutrients = {}) {
  return {
    calories: compactNumber(nutrients.calories),
    carbs: compactNumber(nutrients.carbs),
    protein: compactNumber(nutrients.protein),
    sugar: compactNumber(nutrients.sugar),
    sodium: compactNumber(nutrients.sodium),
    saturatedFat: compactNumber(nutrients.saturatedFat),
    fiber: compactNumber(nutrients.fiber),
    cholesterol: compactNumber(nutrients.cholesterol),
  };
}

function compactProduct(product = {}) {
  return {
    name: compactText(product.name),
    category: compactText(product.category),
    brand: compactText(product.brand),
    maker: compactText(product.maker),
    price: compactNumber(product.price),
    score: compactNumber(product.analysis?.score ?? product.score),
    label: compactText(product.analysis?.label ?? product.label, 80),
    reasons: Array.isArray(product.analysis?.reasons)
      ? product.analysis.reasons.slice(0, maxReasons).map((reason) => compactText(reason, 160))
      : [],
    avoidMatches: Array.isArray(product.analysis?.avoidMatches)
      ? product.analysis.avoidMatches.slice(0, maxReasons).map((reason) => compactText(reason, 120))
      : [],
    nutrients: compactNutrients(product.nutrients),
    ingredients: compactText(product.ingredients, 320),
    matchStatus: compactText(product.matchStatus, 80),
  };
}

function compactRiskRows(rows = []) {
  return rows.slice(0, 8).map((row) => ({
    nutrient: compactText(row.label || row.key, 80),
    total: compactNumber(row.total),
    unit: compactText(row.unit, 20),
    target: compactText(row.targetLabel, 120),
    percent: compactNumber(row.percent),
    status: compactText(row.status || row.level, 80),
    reason: compactText(row.reason, 180),
  }));
}

function compactProfile(profile = {}) {
  return {
    sex: compactText(profile.sex, 40),
    age: compactNumber(profile.age),
    height: compactNumber(profile.height),
    weight: compactNumber(profile.weight),
    activity: compactText(profile.activity, 80),
    weightGoal: compactText(profile.weightGoal || profile.goal, 80),
    goalIntensity: compactText(profile.goalIntensity || profile.intensity, 80),
    contexts: Array.isArray(profile.contexts) ? profile.contexts.slice(0, 8).map((item) => compactText(item, 80)) : [],
    avoidIngredients: Array.isArray(profile.avoidIngredients)
      ? profile.avoidIngredients.slice(0, 10).map((item) => compactText(item, 80))
      : [],
    avoidCustom: compactText(profile.avoidCustom, 160),
    reduceTargets: Array.isArray(profile.reduceTargets) ? profile.reduceTargets.slice(0, 10).map((item) => compactText(item, 80)) : [],
  };
}

export function compactPayload(payload = {}) {
  const cart = payload.cart || {};
  const replacement = payload.replacement || {};

  return {
    profile: compactProfile(payload.profile),
    goal: {
      key: compactText(payload.goal?.key, 80),
      label: compactText(payload.goal?.label, 120),
      focus: compactText(payload.goal?.focus, 180),
    },
    cart: {
      score: compactNumber(cart.score),
      label: compactText(cart.label, 80),
      itemCount: compactNumber(cart.itemCount),
      scope: compactText(cart.scope, 80),
      totals: compactNutrients(cart.totals),
      warnings: Array.isArray(cart.warnings) ? cart.warnings.slice(0, maxReasons).map((warning) => compactText(warning, 180)) : [],
      riskReasons: Array.isArray(cart.riskReasons) ? cart.riskReasons.slice(0, maxReasons).map((reason) => compactText(reason, 180)) : [],
      riskRows: compactRiskRows(cart.riskRows),
      items: Array.isArray(cart.items) ? cart.items.slice(0, maxItems).map(compactProduct) : [],
    },
    replacement: {
      from: replacement.from ? compactProduct(replacement.from) : null,
      to: replacement.to ? compactProduct(replacement.to) : null,
      multiCriteriaScore: compactNumber(replacement.to?.replacementMeta?.multiCriteriaScore ?? replacement.multiCriteriaScore),
      compositionSimilarity: compactNumber(replacement.to?.replacementMeta?.composition?.similarity ?? replacement.compositionSimilarity),
      packageSimilarity: compactNumber(replacement.to?.replacementMeta?.packageSimilarity?.similarity ?? replacement.packageSimilarity),
    },
  };
}

function extractText(response) {
  if (typeof response.text === 'string') return response.text;
  const parts = response.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('\n').trim();
}

function stripJsonFence(text) {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseJsonResponse(text) {
  const stripped = stripJsonFence(text);
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw new Error('Gemini response was not valid JSON.');
  }
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => compactText(item, 240))
    .filter(Boolean)
    .slice(0, maxReasons);
}

function normalizeExplanation(value = {}) {
  return {
    summary: compactText(value.summary, 360),
    cartReasons: normalizeStringArray(value.cartReasons),
    replacement: {
      from: compactText(value.replacement?.from, 180),
      to: compactText(value.replacement?.to, 180),
      reasons: normalizeStringArray(value.replacement?.reasons),
    },
    cautions: normalizeStringArray(value.cautions),
  };
}

function missingNutritionNotice(totals = {}) {
  // 앱(App.js missingNutrition)과 같은 순서여야 한다. 순서가 다르면 같은 안내가
  // '당류·식이섬유'와 '식이섬유·당류'로 갈려 앱의 중복 제거를 통과하고 두 번 표시된다.
  const labels = {
    calories: '열량', protein: '단백질', sugar: '당류',
    sodium: '나트륨', saturatedFat: '포화지방', fiber: '식이섬유',
  };
  const missing = Object.entries(labels)
    .filter(([key]) => totals[key] == null)
    .map(([, label]) => label);
  return missing.length ? `${missing.join('·')} 정보 부족: 일부 식품의 영양값이 없어 정확한 합계를 계산할 수 없어요.` : '';
}

export function ensureMissingNutritionNotice(explanation, totals) {
  const notice = missingNutritionNotice(totals);
  if (notice && ![explanation.summary, ...explanation.cartReasons, ...explanation.cautions].some((text) => text.includes(notice))) {
    return { ...explanation, cautions: [notice, ...explanation.cautions].slice(0, maxReasons) };
  }
  return explanation;
}

export function buildPrompt(payload) {
  return `
You are FoodiGuard's cart explanation assistant.
Use only the JSON data provided by the backend. Do not invent nutrition facts, prices, allergies, diagnoses, or product availability.
Nutrition values that are null mean information is missing, not zero. State "정보 부족" for those nutrients; do not claim a precise total or interpret them as 0. A numeric 0 is a measured zero.
Explain why the current cart is reasonable for the user's profile and why the replacement candidate may be better.
If the replacement candidate is missing, say there is no reliable replacement candidate in the replacement reasons.
Do not provide medical diagnosis or treatment advice.
Do not make claims about allergens, ingredients, consumption safety, or whether a food is suitable for an allergy. The backend adds its own source-based allergy notice.
Write all user-facing text in Korean.
Return JSON only, with this exact shape:
{
  "summary": "one short cart-level summary",
  "cartReasons": ["reason 1", "reason 2"],
  "replacement": {
    "from": "current product name or empty string",
    "to": "replacement product name or empty string",
    "reasons": ["replacement reason 1", "replacement reason 2"]
  },
  "cautions": ["caution 1"]
}

Data:
${JSON.stringify(payload)}
`.trim();
}

export async function generateCartExplanation(payload, allergenEvidence = []) {
  const compacted = compactPayload(payload);
  if (!compacted.cart.items.length) {
    const error = new Error('At least one cart item is required.');
    error.status = 400;
    error.code = 'CART_ITEMS_REQUIRED';
    throw error;
  }

  const ai = getClient();
  const model = process.env.GEMINI_MODEL || defaultModel;
  const response = await ai.models.generateContent({
    model,
    contents: buildPrompt(compacted),
    config: {
      temperature: 0.25,
      responseMimeType: 'application/json',
    },
  });

  const explanation = removeGeneratedAllergyClaims(normalizeExplanation(parseJsonResponse(extractText(response))));
  return {
    ...ensureMissingNutritionNotice(explanation, compacted.cart.totals),
    allergenNotices: buildAllergenNotices(payload.profile, allergenEvidence),
  };
}
