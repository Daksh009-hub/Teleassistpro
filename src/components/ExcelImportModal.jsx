import React, { useState } from 'react';
import { parseClientExcel } from '../utils/excelParser';
import { putInStore } from '../utils/offlineDB';
import { useGamification } from '../context/GamificationContext';

export function ExcelImportModal({ onClose, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedSummary, setParsedSummary] = useState(null);
  const [error, setError] = useState(null);
  const { awardXP } = useGamification();

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    setIsProcessing(true);

    try {
      const result = await parseClientExcel(selected);
      setParsedSummary(result);
    } catch (err) {
      setError(err.message || 'Could not parse Excel/CSV file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedSummary) return;
    setIsProcessing(true);
    try {
      for (const client of parsedSummary.clients) {
        await putInStore('clients', client);
      }
      for (const policy of parsedSummary.policies) {
        await putInStore('policies', policy);
      }

      await awardXP('bulk_import', `Imported ${parsedSummary.clientsCount} clients via Excel`);
      if (onImportSuccess) onImportSuccess(parsedSummary);
      onClose();
    } catch (err) {
      setError('Failed to save imported records: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSampleData = () => {
    setParsedSummary({
      totalRows: 3,
      clientsCount: 3,
      policiesCount: 3,
      clients: [
        {
          id: `c-imp-${Date.now()}-1`,
          agent_id: '00000000-0000-0000-0000-000000000001',
          full_name: 'Harish Chandra Gupta',
          phone: '9871122334',
          email: 'harish.gupta@example.com',
          dob: '1982-06-15',
          kyc_status: 'pending',
          status: 'active',
          lead_source: 'excel_import',
          tags: ['Excel Import', 'Endowment'],
          created_at: new Date().toISOString()
        },
        {
          id: `c-imp-${Date.now()}-2`,
          agent_id: '00000000-0000-0000-0000-000000000001',
          full_name: 'Meenakshi Sundaram',
          phone: '9840123456',
          email: 'meenakshi.s@example.com',
          dob: '1989-10-22',
          kyc_status: 'verified',
          status: 'active',
          lead_source: 'excel_import',
          tags: ['Excel Import', 'Doctor', 'Term Plan'],
          created_at: new Date().toISOString()
        },
        {
          id: `c-imp-${Date.now()}-3`,
          agent_id: '00000000-0000-0000-0000-000000000001',
          full_name: 'Gurpreet Singh Kohli',
          phone: '9815987654',
          email: 'gurpreet.k@example.com',
          dob: '1976-03-30',
          kyc_status: 'pending',
          status: 'active',
          lead_source: 'excel_import',
          tags: ['Excel Import', 'Businessman'],
          created_at: new Date().toISOString()
        }
      ],
      policies: [
        {
          id: `pol-imp-${Date.now()}-1`,
          client_id: `c-imp-${Date.now()}-1`,
          agent_id: '00000000-0000-0000-0000-000000000001',
          policy_number: '665544332',
          policy_name: 'LIC Jeevan Labh (Plan 936)',
          sum_assured: 2000000,
          premium_amount: 55000,
          premium_frequency: 'yearly',
          next_due_date: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
          status: 'active',
          created_at: new Date().toISOString()
        },
        {
          id: `pol-imp-${Date.now()}-2`,
          client_id: `c-imp-${Date.now()}-2`,
          agent_id: '00000000-0000-0000-0000-000000000001',
          policy_number: '887766554',
          policy_name: 'LIC Tech Term (Plan 854)',
          sum_assured: 15000000,
          premium_amount: 28000,
          premium_frequency: 'yearly',
          next_due_date: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
          status: 'active',
          created_at: new Date().toISOString()
        },
        {
          id: `pol-imp-${Date.now()}-3`,
          client_id: `c-imp-${Date.now()}-3`,
          agent_id: '00000000-0000-0000-0000-000000000001',
          policy_number: '998877665',
          policy_name: 'LIC Jeevan Umang (Plan 945)',
          sum_assured: 3000000,
          premium_amount: 85000,
          premium_frequency: 'yearly',
          next_due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
          status: 'active',
          created_at: new Date().toISOString()
        }
      ]
    });
    setError(null);
  };

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title fs-6 fw-bold d-flex align-items-center">
              <i className="bi bi-file-earmark-spreadsheet-fill me-2"></i>
              Bulk Import Clients (Excel / CSV)
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            <p className="small text-muted mb-3">
              Upload client lists from LIC portal exports, branch sheets, or Excel (.xlsx/.csv). We automatically detect Name, Phone, Policy Number, Premium, and Due Dates.
            </p>

            <div className="mb-3">
              <label className="form-label small fw-bold">Select File</label>
              <input
                type="file"
                className="form-control form-control-sm mb-2"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline-success w-100 py-1"
                style={{ fontSize: '0.75rem' }}
                onClick={handleLoadSampleData}
              >
                ⚡ Load Sample Sheet Data (3 Clients + 3 Policies)
              </button>
            </div>

            {isProcessing && (
              <div className="text-center py-3">
                <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                <span className="small text-muted">Analyzing sheet columns...</span>
              </div>
            )}

            {error && (
              <div className="alert alert-danger py-2 small mb-3">
                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                {error}
              </div>
            )}

            {parsedSummary && (
              <div className="card bg-light border-success p-3 mb-3">
                <div className="fw-bold text-success small mb-2 d-flex align-items-center">
                  <i className="bi bi-check-circle-fill me-1"></i> Ready to Import!
                </div>
                <ul className="list-unstyled small mb-0">
                  <li><strong>Total Records:</strong> {parsedSummary.totalRows}</li>
                  <li><strong>Clients to Import:</strong> {parsedSummary.clientsCount} ({parsedSummary.clients.map(c => c.full_name.split(' ')[0]).join(', ')})</li>
                  <li><strong>Policies to Link:</strong> {parsedSummary.policiesCount}</li>
                </ul>
              </div>
            )}
          </div>

          <div className="modal-footer bg-light p-2 d-flex justify-content-between">
            <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-success px-4 fw-bold"
              disabled={!parsedSummary || isProcessing}
              onClick={handleConfirmImport}
            >
              Confirm Import (+30 XP)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
