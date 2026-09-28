import { calculateRevival } from '../src/utils/revivalCalc.js';
import { calculateLevel, calculateProgress } from '../src/utils/xp.js';
import { calculateDailyStreak as calcStreak } from '../src/utils/streak.js';
import { TEMPLATES, buildWhatsAppURL } from '../src/utils/whatsappTemplates.js';
import { summarizeCallNotes, extractFollowUpIntent, parseNaturalLanguageSearch, generateColdLeadMessage, analyzePolicyText } from '../src/utils/gemini.js';
import * as XLSX from 'xlsx';
import { parseClientExcel } from '../src/utils/excelParser.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('\n=== TEST SUITE 1: AUTO-REVIVAL CALCULATOR (Screen 7) ===');
  const eightMonthsAgo = new Date(Date.now() - 240 * 86400000).toISOString().split('T')[0];
  const rev = calculateRevival({ premiumAmount: 72000, lastPaidDate: eightMonthsAgo, interestRateAnnual: 8.0 });
  assert(rev.isLapsed === true, 'Policy identified as lapsed after 30-day grace period');
  assert(rev.lateFee > 3500 && rev.lateFee < 4000, `Late fee correctly calculated: ₹${rev.lateFee}`);
  assert(rev.netPayable === 72000 + rev.lateFee, `Net payable includes original premium + late fee: ₹${rev.netPayable}`);

  console.log('\n=== TEST SUITE 2: GAMIFICATION & STREAKS (Section 15) ===');
  const lvl1 = calculateLevel(0);
  const lvl3 = calculateLevel(640);
  const lvl8 = calculateLevel(6000);
  assert(lvl1.level === 1 && lvl1.name === 'Rookie Agent', '0 XP maps to Level 1 Rookie Agent');
  assert(lvl3.level === 3 && lvl3.name === 'Rising Star', '640 XP maps to Level 3 Rising Star');
  assert(lvl8.level === 8 && lvl8.name === 'Elite Agent', '6000 XP maps to Level 8 Elite Agent');

  const prog = calculateProgress(640);
  assert(prog.percentage === 60, `Progress is 60% towards Level 4 (got ${prog.percentage}%)`);
  assert(prog.neededXP === 160, `Needed XP is 160 (got ${prog.neededXP})`);

  const streak = calcStreak(new Date(Date.now() - 86400000).toISOString().split('T')[0], 4);
  assert(streak.streak === 5, 'Yesterday active -> streak increments to 5');
  assert(streak.streakEarnedXP === true, 'Streak award XP flag set to true');

  console.log('\n=== TEST SUITE 3: WHATSAPP TEMPLATES ENGINE (Section 16) ===');
  const templateKeys = Object.keys(TEMPLATES);
  assert(templateKeys.length === 7, `All 7 WhatsApp templates present (found ${templateKeys.length})`);
  
  const sampleData = {
    clientName: 'Ramesh Sharma',
    agentName: 'Rajesh Verma',
    agentPhone: '+91 98765 43210',
    policyName: 'Jeevan Labh 936',
    premiumAmount: '45,000',
    dueDate: '2025-05-10',
    docList: 'Aadhaar copy',
    kycLink: 'https://teleassist.app/kyc/1',
    quoteLink: 'https://teleassist.app/view/quote-1',
    interestArea: 'Term Plan',
    netPayable: '48,000',
    lateFee: '3,000'
  };

  for (const key of templateKeys) {
    const rendered = TEMPLATES[key].template(sampleData);
    assert(rendered.includes('Ramesh Sharma') && rendered.includes('Rajesh Verma'), `Template ${key} interpolates client and agent info`);
  }

  const waUrl = buildWhatsAppURL('9811223344', 'renewal_reminder', sampleData);
  assert(waUrl.startsWith('https://wa.me/919811223344?text='), 'WhatsApp URL generated with 91 prefix and encoded payload');

  console.log('\n=== TEST SUITE 4: GEMINI AI & NLP ENGINE (Section 6) ===');
  const summary = await summarizeCallNotes('Met with Ramesh. He agreed to 15L Jeevan Labh. Wants to sign forms next Friday.', 'Ramesh');
  assert(summary && summary.length > 10, `Feature A: AI Call Summary generated: "${summary}"`);

  const nlpIntent = await extractFollowUpIntent('Call back Ramesh next Friday to collect cheque.');
  assert(nlpIntent.needs_followup === true, 'Feature B: NLP detected follow-up intent');
  assert(nlpIntent.date !== null, `Feature B: NLP extracted date: ${nlpIntent.date}`);

  const searchKyc = await parseNaturalLanguageSearch('KYC pending clients');
  assert(searchKyc.kyc_status === 'pending', 'Feature D: NL Search converted "KYC pending clients" to kyc_status: "pending"');

  const policyQa = await analyzePolicyText('LIC Jeevan Labh Plan 936. Grace period is 30 days.', 'What is the grace period?');
  assert(policyQa.includes('30 days'), `Feature G: Policy Q&A answered with grounded context: "${policyQa}"`);

  const coldMsg = await generateColdLeadMessage('Ananya Roy', 'Jeevan Umang');
  assert(coldMsg && coldMsg.includes('Ananya'), `Feature H: Cold lead re-engagement suggestion created: "${coldMsg}"`);

  console.log('\n=== TEST SUITE 5: EXCEL BULK IMPORT (Screen 2C) ===');
  const testData = [
    { 'Customer Name': 'Deepak Verma', 'Phone': '9899112233', 'Policy': '998877665', 'Premium Amount': 35000 },
    { 'Customer Name': 'Shweta Rao', 'Phone': '9877445566', 'Policy': '112244556', 'Premium Amount': 50000 }
  ];
  const ws = XLSX.utils.json_to_sheet(testData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const mockFile = new File([buf], 'clients.xlsx');
  const excelResult = await parseClientExcel(mockFile);
  assert(excelResult.clientsCount === 2, `Parsed 2 clients from Excel sheet`);
  assert(excelResult.clients[0].full_name === 'Deepak Verma', `Client 1 Name mapped accurately: ${excelResult.clients[0].full_name}`);
  assert(excelResult.policies[0].premium_amount === 35000, `Policy 1 Premium mapped: ${excelResult.policies[0].premium_amount}`);

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
