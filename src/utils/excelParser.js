import * as XLSX from 'xlsx';

export async function parseClientExcel(file) {
  let arrayBuffer;
  if (file && typeof file.arrayBuffer === 'function') {
    arrayBuffer = await file.arrayBuffer();
  } else {
    arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rawJson || rawJson.length === 0) {
    throw new Error('The uploaded sheet is empty');
  }

  const clients = [];
  const policies = [];

  rawJson.forEach((row, index) => {
    const keys = Object.keys(row);
    const findVal = (patterns) => {
      const matchedKey = keys.find(k => patterns.some(p => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p)));
      return matchedKey ? String(row[matchedKey]).trim() : '';
    };

    const fullName = findVal(['name', 'client', 'customer', 'fullname']);
    const phone = findVal(['phone', 'mobile', 'contact', 'tel']);
    const email = findVal(['email', 'mail']);
    const dob = findVal(['dob', 'birth', 'dateofbirth']);
    const policyNo = findVal(['policyno', 'policy', 'policynumber']);
    const policyName = findVal(['policyname', 'plan', 'planname']) || 'LIC Jeevan Labh (Plan 936)';
    const premium = parseFloat(findVal(['premium', 'amount', 'premiumamount'])) || 25000;
    const dueDate = findVal(['due', 'duedate', 'nextdue']) || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    if (fullName || phone) {
      const clientId = `import-${Date.now()}-${index}`;
      clients.push({
        id: clientId,
        full_name: fullName || `Client ${index + 1}`,
        phone: phone || '9800000000',
        email: email || '',
        dob: dob || '1990-01-01',
        aadhaar_last4: '0000',
        pan_number: 'ABCDE1234F',
        kyc_status: 'pending',
        status: 'active',
        lead_source: 'excel_import',
        tags: ['Excel Imported']
      });

      if (policyNo || premium) {
        policies.push({
          id: `pol-${clientId}`,
          client_id: clientId,
          policy_number: policyNo || `LIC${Math.floor(100000000 + Math.random() * 900000000)}`,
          policy_name: policyName,
          plan_type: 'Endowment',
          sum_assured: premium * 15,
          premium_amount: premium,
          premium_frequency: 'yearly',
          next_due_date: dueDate,
          status: 'active'
        });
      }
    }
  });

  return {
    totalRows: rawJson.length,
    clientsCount: clients.length,
    policiesCount: policies.length,
    clients,
    policies
  };
}
