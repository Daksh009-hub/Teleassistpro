import { describe, it, expect } from 'vitest';
import { TEMPLATES, buildWhatsAppURL } from '../src/utils/whatsappTemplates';

describe('WhatsApp Templates Engine Unit Tests', () => {
  const sampleData = {
    clientName: 'Ramesh Kumar',
    agentName: 'Rajesh Verma',
    agentPhone: '+91 98765 43210',
    policyName: 'LIC Jeevan Labh (Plan 936)',
    premiumAmount: '45,000',
    dueDate: '2025-05-10',
    docList: 'Aadhaar and PAN copy',
    kycLink: 'https://teleassist.app/kyc/123',
    quoteLink: 'https://teleassist.app/view/quote-123',
    interestArea: 'Term Plan',
    netPayable: '48,000',
    lateFee: '3,000'
  };

  it('renders all 7 templates correctly', () => {
    const keys = Object.keys(TEMPLATES);
    expect(keys.length).toBe(7);

    keys.forEach(key => {
      const template = TEMPLATES[key];
      expect(template.label).toBeTruthy();
      expect(template.icon).toBeTruthy();
      const rendered = template.template(sampleData);
      expect(typeof rendered).toBe('string');
      expect(rendered).toContain('Ramesh Kumar');
      expect(rendered).toContain('Rajesh Verma');
    });
  });

  it('builds valid WhatsApp URL with encoded message and 91 phone prefix', () => {
    const url = buildWhatsAppURL('9811223344', 'renewal_reminder', sampleData);
    expect(url).toBeTruthy();
    expect(url).toContain('https://wa.me/919811223344?text=');
    expect(url).toContain(encodeURIComponent('Ramesh Kumar'));
    expect(url).toContain(encodeURIComponent('₹45,000'));
  });

  it('returns null for non-existent template key', () => {
    const url = buildWhatsAppURL('9811223344', 'invalid_key', sampleData);
    expect(url).toBeNull();
  });
});
