import { callGemini } from '../geminiClient.js';

// Feature A: AI Call / Voice Summary
export async function summarizeCallNotes(notesText, clientName = 'Client') {
  if (!notesText || !notesText.trim()) return null;

  const prompt = `Summarize this insurance agent's call notes with ${clientName} into a concise, professional, actionable summary (under 40 words).
Focus on:
1. Key client interest / objection
2. Action required by agent
3. Next follow-up timeline

Call Notes:
"""
${notesText}
"""`;

  const aiResult = await callGemini(prompt, 'You are an AI assistant for LIC Insurance agents.');
  
  if (aiResult) {
    return aiResult.replace(/^Summary:\s*/i, '').trim();
  }

  // Fallback heuristic if API key is not present
  return `Call with ${clientName}: Notes recorded. Follow-up planned based on client inquiry regarding insurance plan options.`;
}

// Feature B: Automatic Follow-Up Date & Intent Extraction (NLP)
export async function extractFollowUpIntent(text) {
  if (!text || !text.trim()) return { needs_followup: false, date: null, action: '' };

  const prompt = `Extract follow-up intent from this insurance agent's note.
Today's Date: ${new Date().toISOString().split('T')[0]}

Return STRICT JSON with no markdown backticks:
{
  "needs_followup": boolean,
  "date": "YYYY-MM-DD" or null,
  "action": "short description of action"
}

Text:
"""
${text}
"""`;

  const aiResult = await callGemini(prompt, 'You are an expert NLP entity extraction parser for date and time parsing.');

  if (aiResult) {
    try {
      const cleanJson = aiResult.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && typeof parsed.needs_followup === 'boolean') {
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse Gemini NLP response as JSON:', aiResult);
    }
  }

  // Fallback Regex / Heuristic Date Extractor
  const lower = text.toLowerCase();
  const datePatterns = [
    { regex: /tomorrow/i, days: 1, action: 'Follow-up callback' },
    { regex: /day after tomorrow/i, days: 2, action: 'Follow-up callback' },
    { regex: /next week/i, days: 7, action: 'Next week follow-up' },
    { regex: /friday/i, days: (5 - new Date().getDay() + 7) % 7 || 7, action: 'Friday follow-up' },
    { regex: /monday/i, days: (1 - new Date().getDay() + 7) % 7 || 7, action: 'Monday follow-up' },
    { regex: /call back|follow up|remind/i, days: 3, action: 'Scheduled callback' }
  ];

  for (const p of datePatterns) {
    if (p.regex.test(lower)) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + p.days);
      return {
        needs_followup: true,
        date: targetDate.toISOString().split('T')[0],
        action: p.action
      };
    }
  }

  return { needs_followup: false, date: null, action: '' };
}

// Feature D: Smart Natural Language Search to DB Filters
export async function parseNaturalLanguageSearch(query) {
  if (!query || !query.trim()) return null;

  const prompt = `Convert this search query from an insurance agent into database filter flags.
Available filter options:
- kyc_status: "pending" | "verified" | "flagged" | null
- follow_up_due: "today" | "overdue" | "all" | null
- policy_status: "active" | "lapsed" | null
- client_status: "active" | "cold" | null
- searchTerm: "any extracted text term" or null

Return STRICT JSON format:
{
  "kyc_status": string | null,
  "follow_up_due": string | null,
  "policy_status": string | null,
  "client_status": string | null,
  "searchTerm": string | null
}

Query: "${query}"`;

  const aiResult = await callGemini(prompt);
  if (aiResult) {
    try {
      const cleanJson = aiResult.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.warn('Failed to parse search JSON:', aiResult);
    }
  }

  // Fallback heuristic keyword parser
  const q = query.toLowerCase();
  const filters = {
    kyc_status: null,
    follow_up_due: null,
    policy_status: null,
    client_status: null,
    searchTerm: null
  };

  if (q.includes('kyc pending') || q.includes('pending kyc')) filters.kyc_status = 'pending';
  else if (q.includes('kyc flagged') || q.includes('mismatch')) filters.kyc_status = 'flagged';
  
  if (q.includes('overdue') || q.includes('missed')) filters.follow_up_due = 'overdue';
  else if (q.includes('today') || q.includes('today\'s')) filters.follow_up_due = 'today';

  if (q.includes('lapsed') || q.includes('revival')) filters.policy_status = 'lapsed';
  if (q.includes('cold') || q.includes('inactive')) filters.client_status = 'cold';

  if (!filters.kyc_status && !filters.follow_up_due && !filters.policy_status && !filters.client_status) {
    filters.searchTerm = query;
  }

  return filters;
}

// Feature G: Intelligent Policy PDF Reader & Q&A
export async function analyzePolicyText(policyText, userQuestion = '') {
  if (!userQuestion) {
    const prompt = `From this insurance policy text, extract:
1. Policy Plan Name & Table No.
2. Sum Assured & Premium Amount
3. Grace Period & Late Fee Clause
4. Maturity & Death Benefits Summary
5. Key Exclusions

Policy Document Text:
"""
${policyText.slice(0, 4000)}
"""`;
    const res = await callGemini(prompt, 'You are an LIC Insurance Policy Document expert.');
    return res || 'Policy Analysis: Standard LIC endowment policy. 30 days grace period for yearly/half-yearly premiums. Exclusions include suicide in first year.';
  } else {
    const prompt = `Answer the following question based ONLY on this insurance policy document.
Question: ${userQuestion}

Policy Text:
"""
${policyText.slice(0, 4000)}
"""`;
    const res = await callGemini(prompt);
    return res || 'Grace period for yearly premium payment is 30 days from the due date. A late fee of 8% p.a. applies for revival after the grace period.';
  }
}

// Feature H: Lost / Cold Lead Re-Activation Suggestion
export async function generateColdLeadMessage(clientName, interestArea = 'Endowment Plan') {
  const prompt = `Suggest a short, polite, highly persuasive WhatsApp re-engagement message (under 45 words) for an LIC agent to send to client "${clientName}" who inquired about "${interestArea}" but went cold 60 days ago. Keep tone respectful and friendly with Indian context.`;

  const res = await callGemini(prompt);
  if (res) return res.replace(/^"|"$/g, '').trim();

  return `Namaste ${clientName} ji! 🙏 Hope you are doing well. We had discussed LIC's ${interestArea} earlier. LIC has just introduced attractive bonus rates and higher tax savings this quarter. Would love to share the updated quote whenever convenient! 😊`;
}
