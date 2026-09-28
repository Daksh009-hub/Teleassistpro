import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseClientExcel } from '../src/utils/excelParser';

describe('Excel Parser Bulk Import Tests', () => {
  it('parses valid Excel sheet with client and policy rows', async () => {
    // Generate dummy Excel binary in-memory
    const testData = [
      { 'Client Name': 'Amit Shah', 'Mobile No': '9899887766', 'Email': 'amit@test.com', 'Policy No': '112233445', 'Premium': 30000, 'Next Due': '2025-06-15' },
      { 'Client Name': 'Meena Gupta', 'Mobile No': '9877665544', 'Email': 'meena@test.com', 'Policy No': '998877665', 'Premium': 45000, 'Next Due': '2025-07-20' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(testData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    // Create mock File object
    const file = new File([excelBuffer], 'clients.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const result = await parseClientExcel(file);
    expect(result.totalRows).toBe(2);
    expect(result.clientsCount).toBe(2);
    expect(result.policiesCount).toBe(2);

    expect(result.clients[0].full_name).toBe('Amit Shah');
    expect(result.clients[0].phone).toBe('9899887766');
    expect(result.policies[0].policy_number).toBe('112233445');
    expect(result.policies[0].premium_amount).toBe(30000);
  });
});
