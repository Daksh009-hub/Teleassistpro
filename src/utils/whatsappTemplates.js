// WhatsApp Message Templates Engine for LIC Agents

export const TEMPLATES = {
  renewal_reminder: {
    key: 'renewal_reminder',
    label: 'Renewal Reminder',
    icon: '🔔',
    useCases: 'Use 7–14 days before premium due date',
    template: (data) =>
      `Hello ${data.clientName || 'Valued Customer'}! 🙏\n\nThis is a friendly reminder that your *${data.policyName || 'LIC Policy'}* premium of *₹${data.premiumAmount || '0'}* is due on *${data.dueDate || 'due date'}*.\n\nTimely payment ensures your policy stays active and your family stays protected. 💙\n\nFor any assistance or hassle-free payment, feel free to call me.\n\n— ${data.agentName || 'Your LIC Advisor'}\nLIC Agent | ${data.agentPhone || ''}`
  },

  document_request: {
    key: 'document_request',
    label: 'Document Request',
    icon: '📄',
    useCases: 'Use after KYC is flagged incomplete',
    template: (data) =>
      `Dear ${data.clientName || 'Client'},\n\nTo proceed with your *${data.policyName || 'LIC Policy'}* application/KYC update, I need the following documents:\n\n📌 ${data.docList || 'Aadhaar Card front/back & PAN card'}\n\nPlease upload them securely here (watermarked for LIC use only):\n${data.kycLink || 'https://teleassist.app'}\n\nAll documents are strictly confidential and encrypted. 🔒\n\n— ${data.agentName || 'Your LIC Advisor'} | ${data.agentPhone || ''}`
  },

  quote_followup: {
    key: 'quote_followup',
    label: 'Quote Follow-Up',
    icon: '📊',
    useCases: 'Use after sharing policy PDF',
    template: (data) =>
      `Hi ${data.clientName || 'there'}! 👋\n\nI shared a personalized LIC policy quotation for you recently. Here is the link in case you missed it:\n${data.quoteLink || 'https://teleassist.app'}\n\nI would be happy to walk you through the maturity returns and life cover on a quick 2-minute call! Let me know a convenient time. ⏰\n\n— ${data.agentName || 'Your LIC Advisor'}\nLIC Agent | ${data.agentPhone || ''}`
  },

  quote_nudge: {
    key: 'quote_nudge',
    label: 'Quote Not Opened Nudge',
    icon: '⏰',
    useCases: 'Auto-suggested when quote not opened in 3 days',
    template: (data) =>
      `Hello ${data.clientName || 'there'}! 😊\n\nJust checking in — I had shared the *${data.policyName || 'LIC Plan'}* quote for you a few days ago. Here is the quick view link again:\n${data.quoteLink || 'https://teleassist.app'}\n\nIt takes less than 2 minutes to review. Do let me know if you have any questions or would like adjustments! 🙏\n\n— ${data.agentName || 'Your LIC Advisor'} | ${data.agentPhone || ''}`
  },

  cold_reactivation: {
    key: 'cold_reactivation',
    label: 'Re-connect (Cold Lead)',
    icon: '🤝',
    useCases: 'Use for cold/lost leads older than 60 days',
    template: (data) =>
      `Hi ${data.clientName || 'there'}! Hope you and your family are doing well. 🙏\n\nWe had spoken about *${data.interestArea || 'financial planning and LIC plans'}* some time back. LIC has introduced exciting new guaranteed return plans and enhanced tax benefits.\n\nWould love to catch up for 5 minutes whenever convenient! 😊\n\n— ${data.agentName || 'Your LIC Advisor'}\nLIC Agent | ${data.agentPhone || ''}`
  },

  birthday_greeting: {
    key: 'birthday_greeting',
    label: 'Birthday Greeting',
    icon: '🎂',
    useCases: "Auto-suggested on client's birthday",
    template: (data) =>
      `Dear ${data.clientName || 'Friend'},\n\n🎂 Wishing you a very Happy Birthday! 🎉\n\nMay this year bring great health, happiness, success, and prosperity for you and your family. 🌟\n\nAs your LIC advisor, I am always here to assist you and protect your family's future.\n\n— ${data.agentName || 'Your LIC Advisor'}\nLIC Agent | ${data.agentPhone || ''}`
  },

  revival_reminder: {
    key: 'revival_reminder',
    label: 'Policy Revival Alert',
    icon: '⚠️',
    useCases: 'Use for lapsed policies with revival calculator result',
    template: (data) =>
      `Dear ${data.clientName || 'Policyholder'},\n\n⚠️ Your policy *${data.policyName || 'LIC Policy'}* is currently lapsed. But the good news is — it can still be *revived* easily!\n\nEstimated revival amount: *₹${data.netPayable || '0'}*\n(includes estimated late fee of ₹${data.lateFee || '0'})\n\nPlease reach out soon before the special revival window closes. I am here to help you restore full life cover! 🤝\n\n— ${data.agentName || 'Your LIC Advisor'}\nLIC Agent | ${data.agentPhone || ''}`
  }
};

export function formatIndianPhone(phone) {
  const clean = (phone || '').replace(/\D/g, '');
  if (!clean) return '919811223344';
  if (clean.length === 10) return `91${clean}`;
  if (clean.startsWith('91') && clean.length >= 12) return clean;
  if (clean.startsWith('0') && clean.length === 11) return `91${clean.slice(1)}`;
  return clean.length >= 10 ? clean : `91${clean}`;
}

export function buildWhatsAppURL(phone, templateKey, data = {}) {
  const templateObj = TEMPLATES[templateKey];
  if (!templateObj) return null;
  const message = templateObj.template(data);
  return buildDirectWhatsAppURL(phone, message);
}

export function buildWhatsAppWebURL(phone, templateKey, data = {}) {
  const templateObj = TEMPLATES[templateKey];
  if (!templateObj) return null;
  const message = templateObj.template(data);
  return buildDirectWhatsAppWebURL(phone, message);
}

export function buildDirectWhatsAppURL(phone, messageText) {
  const targetPhone = formatIndianPhone(phone);
  const encoded = encodeURIComponent(messageText || '');
  return `https://wa.me/${targetPhone}?text=${encoded}`;
}

export function buildDirectWhatsAppWebURL(phone, messageText) {
  const targetPhone = formatIndianPhone(phone);
  const encoded = encodeURIComponent(messageText || '');
  return `https://web.whatsapp.com/send?phone=${targetPhone}&text=${encoded}`;
}
