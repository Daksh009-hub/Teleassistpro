import { describe, it, expect } from 'vitest';
import { summarizeCallNotes, extractFollowUpIntent, parseNaturalLanguageSearch, generateColdLeadMessage, analyzePolicyText } from '../src/utils/gemini';

describe('AI Features & Heuristic Fallbacks Tests', { timeout: 15000 }, () => {
  it('Feature A: summarizes call notes cleanly', async () => {
    const summary = await summarizeCallNotes('Client interested in 15L Jeevan Labh. Requested callback next Tuesday.', 'Sunil');
    expect(summary).toBeTruthy();
    expect(summary.length).toBeGreaterThan(10);
  });

  it('Feature B: extracts follow-up intent and dates accurately', async () => {
    const intentTomorrow = await extractFollowUpIntent('Call client tomorrow morning regarding proposal.');
    expect(intentTomorrow.needs_followup).toBe(true);
    expect(intentTomorrow.date).toBeTruthy();

    const intentFriday = await extractFollowUpIntent('Client asked to follow up this Friday.');
    expect(intentFriday.needs_followup).toBe(true);
    expect(intentFriday.date).toBeTruthy();

    const noIntent = await extractFollowUpIntent('Just saying hello.');
    expect(noIntent.needs_followup).toBe(false);
  });

  it('Feature D: converts natural language queries to CRM filters', async () => {
    const kycSearch = await parseNaturalLanguageSearch('Show me KYC pending clients');
    expect(kycSearch.kyc_status).toBe('pending');

    const overdueSearch = await parseNaturalLanguageSearch('List all overdue follow-ups');
    expect(overdueSearch.follow_up_due).toBe('overdue');

    const lapsedSearch = await parseNaturalLanguageSearch('Find lapsed policies');
    expect(lapsedSearch.policy_status).toBe('lapsed');
  });

  it('Feature G: analyzes policy text and answers Q&A', async () => {
    const policyDoc = 'LIC Jeevan Labh Plan 936. Sum Assured: 15 Lakhs. Grace period for premium payment is 30 days.';
    const analysis = await analyzePolicyText(policyDoc);
    expect(analysis).toBeTruthy();

    const qaAnswer = await analyzePolicyText(policyDoc, 'What is the grace period?');
    expect(qaAnswer).toContain('30 days');
  });

  it('Feature H: generates personalized cold lead re-activation messages', async () => {
    const msg = await generateColdLeadMessage('Ananya Roy', 'Child Future Plan');
    expect(msg).toBeTruthy();
    expect(msg).toContain('Ananya');
  });
});
