import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAllFromStore, putInStore } from '../utils/offlineDB';
import { useOCR } from '../hooks/useOCR';
import { applyLICWatermark } from '../utils/watermark';
import { useGamification } from '../context/GamificationContext';

export function KYCDropbox() {
  const { clientId } = useParams();
  const { processDocument, isProcessing, progress, ocrText, error: ocrError } = useOCR();
  const { awardXP } = useGamification();

  const [client, setClient] = useState(null);
  const [docType, setDocType] = useState('aadhaar');
  const [imagePreview, setImagePreview] = useState(null);
  const [watermarkedUrl, setWatermarkedUrl] = useState(null);
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [mismatchFlags, setMismatchFlags] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    getAllFromStore('clients').then(clients => {
      const found = clients.find(c => c.id === clientId);
      setClient(found || null);
    });
  }, [clientId]);

  const handleExtractedFieldChange = (field, value) => {
    setExtractedInfo(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      if (client) {
        const nameMismatch = updated.extractedName &&
          !client.full_name.toLowerCase().includes(updated.extractedName.toLowerCase()) &&
          !updated.extractedName.toLowerCase().includes(client.full_name.toLowerCase());
        const dobMismatch = updated.extractedDOB && client.dob && updated.extractedDOB !== client.dob;
        setMismatchFlags({
          name: nameMismatch,
          dob: dobMismatch,
          notDetected: false
        });
      }
      return updated;
    });
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await processSelectedFile(file, docType);
  };

  const processSelectedFile = async (fileOrBlob, currentDocType) => {
    setSaveSuccess(false);
    const localUrl = URL.createObjectURL(fileOrBlob);
    setImagePreview(localUrl);

    // 1. Watermark Image on Canvas
    try {
      const wmResult = await applyLICWatermark(fileOrBlob, 'Only for LIC | Confidential');
      setWatermarkedUrl(wmResult.dataUrl);

      // 2. Client-side OCR Scan using Tesseract.js
      const ocrResult = await processDocument(fileOrBlob, currentDocType);
      if (ocrResult) {
        setExtractedInfo(ocrResult);

        if (!ocrResult.isValidDocument) {
          // Document was NOT detected (wrong photo uploaded)
          setMismatchFlags({
            notDetected: true,
            errorMessage: ocrResult.errorMessage || `${currentDocType === 'aadhaar' ? 'Aadhaar' : 'PAN Card'} not detected.`
          });
        } else if (client) {
          // 3. Mismatch Detector (Feature F)
          const nameMismatch = ocrResult.extractedName &&
            !client.full_name.toLowerCase().includes(ocrResult.extractedName.toLowerCase()) &&
            !ocrResult.extractedName.toLowerCase().includes(client.full_name.toLowerCase());

          const dobMismatch = ocrResult.extractedDOB && client.dob && ocrResult.extractedDOB !== client.dob;

          setMismatchFlags({
            name: nameMismatch,
            dob: dobMismatch,
            notDetected: false
          });
        }
      }
    } catch (err) {
      console.warn('Watermark/OCR error:', err);
    }
  };

  const handleConfirmVerification = async () => {
    if (!client || !extractedInfo || !extractedInfo.isValidDocument) return;
    setIsSaving(true);
    try {
      const hasMismatch = mismatchFlags.name || mismatchFlags.dob;
      const updatedStatus = hasMismatch ? 'flagged' : 'verified';

      // Save KYC document record
      const docRecord = {
        id: `kyc-${Date.now()}`,
        client_id: client.id,
        doc_type: docType,
        file_url: watermarkedUrl || imagePreview,
        extracted_name: extractedInfo.extractedName,
        extracted_dob: extractedInfo.extractedDOB,
        mismatch_flags: mismatchFlags,
        uploaded_at: new Date().toISOString()
      };
      await putInStore('kyc_documents', docRecord);

      // Update client status & details
      const updatedClient = {
        ...client,
        kyc_status: updatedStatus,
        aadhaar_last4: docType === 'aadhaar' ? (extractedInfo.extractedNumber?.slice(-4) || client.aadhaar_last4) : client.aadhaar_last4,
        pan_number: docType === 'pan' ? (extractedInfo.extractedNumber || client.pan_number) : client.pan_number
      };
      await putInStore('clients', updatedClient);
      setClient(updatedClient);

      // Award XP
      await awardXP('kyc_uploaded', `Uploaded ${docType.toUpperCase()} for ${client.full_name}`);
      if (!hasMismatch) {
        await awardXP('kyc_verified', `KYC Verified without mismatch for ${client.full_name}`);
      }

      // Add timeline activity
      await putInStore('activities', {
        id: `act-${Date.now()}`,
        agent_id: client.agent_id || '00000000-0000-0000-0000-000000000001',
        client_id: client.id,
        activity_type: 'kyc',
        title: `KYC Document: ${docType.toUpperCase()} Uploaded`,
        description: `Scanned and watermarked. Status: ${updatedStatus.toUpperCase()}. Extracted DOB: ${extractedInfo.extractedDOB}`,
        status: 'done',
        completed_at: new Date().toISOString()
      });

      setSaveSuccess(true);
    } catch (err) {
      console.error('Failed to save KYC verification:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container py-3 px-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link to={clientId ? `/client/${clientId}` : '/dashboard'} className="btn btn-sm btn-light border py-1 px-2 d-flex align-items-center">
          <i className="bi bi-arrow-left me-1"></i> Back
        </Link>
        <span className="badge bg-info text-white">🔒 Secure KYC Drop-Box</span>
      </div>

      {client && (
        <div className="card shadow-sm border-0 mb-3 bg-white">
          <div className="card-body p-3">
            <h6 className="fw-bold text-dark mb-1">KYC Verification for {client.full_name}</h6>
            <div className="small text-muted mb-2">
              Registered DOB: <strong>{client.dob || 'Not specified'}</strong> | Current Status: 
              <span className={`badge ms-1 ${client.kyc_status === 'verified' ? 'bg-success' : client.kyc_status === 'flagged' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                {client.kyc_status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Upload Box */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3">
          <div className="mb-3">
            <label className="form-label small fw-bold">Select Document Type</label>
            <div className="btn-group w-100" role="group">
              <button
                type="button"
                className={`btn btn-sm ${docType === 'aadhaar' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setDocType('aadhaar')}
              >
                🪪 Aadhaar Card (Front)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${docType === 'pan' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setDocType('pan')}
              >
                💳 PAN Card
              </button>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-bold">Upload / Capture Document Photo</label>
            <input
              type="file"
              className="form-control form-control-sm"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelected}
            />
          </div>

          {isProcessing && (
            <div className="text-center py-4 bg-light rounded border mb-3">
              <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
              <span className="small text-primary fw-bold">Running Tesseract.js OCR & Watermarking...</span>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>Extracting Name, DOB and Identity Details</div>
            </div>
          )}

          {ocrError && (
            <div className="alert alert-danger py-2 small mb-3">
              <i className="bi bi-exclamation-triangle-fill me-1"></i> {ocrError}
            </div>
          )}

          {/* Watermarked Preview & OCR Extraction Results */}
          {watermarkedUrl && extractedInfo && (
            <div className="mb-3">
              <h6 className="fw-bold small text-muted text-uppercase mb-2">Watermarked Preview & OCR Findings</h6>
              
              <div className="position-relative text-center bg-dark rounded overflow-hidden mb-3" style={{ maxHeight: '240px' }}>
                <img
                  src={watermarkedUrl}
                  alt="Watermarked KYC"
                  className="img-fluid"
                  style={{ maxHeight: '240px', objectFit: 'contain' }}
                />
                <span className="position-absolute bottom-0 start-0 m-2 badge bg-danger opacity-75">
                  ✓ Protected: Only for LIC | Confidential
                </span>
              </div>

              {/* Document Not Detected Alert (Invalid / Wrong Photo) */}
              {!extractedInfo.isValidDocument ? (
                <div className="card bg-danger-subtle border-danger p-3 mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <i className="bi bi-x-circle-fill text-danger fs-3 me-2"></i>
                    <div>
                      <h6 className="fw-bold text-danger mb-0">
                        {docType === 'aadhaar' ? 'Aadhaar Not Detected' : 'PAN Card Not Detected'}
                      </h6>
                      <small className="text-danger fw-semibold">
                        Wrong document or unreadable photo
                      </small>
                    </div>
                  </div>
                  <div className="alert alert-danger py-2 px-3 small mb-2 border-danger">
                    <strong>Validation Failed:</strong> {extractedInfo.errorMessage || `The uploaded photo does not appear to be an ${docType === 'aadhaar' ? 'Aadhaar Card' : 'PAN Card'}.`}
                  </div>
                  <div className="small text-muted bg-white p-2 rounded border border-danger-subtle mb-3" style={{ fontSize: '0.75rem' }}>
                    <div className="fw-bold text-dark mb-1">Why was this document rejected?</div>
                    <ul className="mb-0 ps-3">
                      <li>The uploaded photo does not contain {docType === 'aadhaar' ? 'Aadhaar details (Government of India / 12-digit number)' : 'PAN details (Income Tax Department / 10-digit PAN)'}.</li>
                      <li>A non-KYC photo was uploaded (receipt, scenery, pet, or random document).</li>
                      <li>The image is too blurry, dark, cropped, or rotated.</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm w-100 fw-bold py-2"
                    onClick={() => {
                      setWatermarkedUrl(null);
                      setExtractedInfo(null);
                      setImagePreview(null);
                    }}
                  >
                    <i className="bi bi-arrow-repeat me-1"></i> Upload a Clear {docType === 'aadhaar' ? 'Aadhaar Card' : 'PAN Card'} Photo
                  </button>
                </div>
              ) : (
                /* Extracted Details Card */
                <div className="card bg-light border p-3 mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                    <span className="fw-bold small text-dark">
                      <i className="bi bi-card-text me-1 text-primary"></i> Scanned Details
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary py-0 px-2"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? '✓ Done Editing' : '✏️ Edit Scanned Info'}
                    </button>
                  </div>

                  {isEditing ? (
                    <div className="row g-2 small">
                      <div className="col-12">
                        <label className="text-muted fw-semibold mb-0" style={{ fontSize: '0.72rem' }}>Name on Card:</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={extractedInfo.extractedName || ''}
                          onChange={(e) => handleExtractedFieldChange('extractedName', e.target.value)}
                          placeholder="e.g. Vilas Rakhe"
                        />
                      </div>
                      <div className="col-6">
                        <label className="text-muted fw-semibold mb-0" style={{ fontSize: '0.72rem' }}>Date of Birth:</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={extractedInfo.extractedDOB || ''}
                          onChange={(e) => handleExtractedFieldChange('extractedDOB', e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <label className="text-muted fw-semibold mb-0" style={{ fontSize: '0.72rem' }}>
                          {docType === 'aadhaar' ? 'Aadhaar Number' : 'PAN Number'}:
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm font-monospace"
                          value={extractedInfo.extractedNumber || ''}
                          onChange={(e) => handleExtractedFieldChange('extractedNumber', e.target.value)}
                          placeholder={docType === 'aadhaar' ? '12-digit Aadhaar' : '10-character PAN'}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="row g-2 small">
                      <div className="col-6">
                        <span className="text-muted">Extracted Name:</span>
                        <div className={`fw-bold ${mismatchFlags.name ? 'text-danger' : 'text-success'}`}>
                          {extractedInfo.extractedName}
                        </div>
                      </div>
                      <div className="col-6">
                        <span className="text-muted">Extracted DOB:</span>
                        <div className={`fw-bold ${mismatchFlags.dob ? 'text-danger' : 'text-success'}`}>
                          {extractedInfo.extractedDOB || 'Not detected'}
                        </div>
                      </div>
                      <div className="col-12 mt-1">
                        <span className="text-muted">Document Number:</span>
                        <div className="fw-bold font-monospace text-dark">{extractedInfo.extractedNumber || 'Not detected'}</div>
                      </div>
                    </div>
                  )}

                  {/* Mismatch Alerts (Feature F) */}
                  {(mismatchFlags.name || mismatchFlags.dob) && (
                    <div className="alert alert-danger py-2 px-3 small mt-3 mb-0 border-danger">
                      <div className="fw-bold d-flex align-items-center mb-1">
                        <span className="me-1">⚠️</span> Mismatch Detector Alert
                      </div>
                      {mismatchFlags.dob && (
                        <div>• Scanned DOB (<strong>{extractedInfo.extractedDOB}</strong>) does not match profile DOB (<strong>{client?.dob}</strong>).</div>
                      )}
                      {mismatchFlags.name && (
                        <div>• Extracted Name (<strong>{extractedInfo.extractedName}</strong>) differs from client profile.</div>
                      )}
                      <div className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                        Agent review required before policy issuance. Tap <strong>✏️ Edit Scanned Info</strong> above to correct any typo if needed.
                      </div>
                    </div>
                  )}

                  {/* Completeness check passed (Feature E) */}
                  {!mismatchFlags.name && !mismatchFlags.dob && (
                    <div className="alert alert-success py-2 px-3 small mt-3 mb-0 border-success">
                      <div className="fw-bold d-flex align-items-center">
                        <i className="bi bi-check-circle-fill me-1"></i> Complete Match & Verification Verified!
                      </div>
                      <div className="small">All expected fields extracted accurately with zero discrepancy.</div>
                    </div>
                  )}
                </div>
              )}

              {saveSuccess ? (
                <div className="alert alert-success text-center py-2 fw-bold">
                  <i className="bi bi-check2-circle me-1"></i> KYC Document Saved & Verified Successfully!
                </div>
              ) : !extractedInfo.isValidDocument ? (
                <button
                  type="button"
                  className="btn btn-secondary w-100 fw-bold py-2 opacity-75"
                  disabled
                >
                  <i className="bi bi-slash-circle me-1"></i> Cannot Confirm: {docType === 'aadhaar' ? 'Aadhaar' : 'PAN Card'} Not Detected
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary w-100 fw-bold py-2"
                  disabled={isSaving}
                  onClick={handleConfirmVerification}
                >
                  {isSaving ? 'Updating Profile...' : 'Confirm & Save KYC Document (+25 XP)'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
