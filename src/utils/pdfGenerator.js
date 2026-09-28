import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export function generate80CTaxProofPDF({
  agent = {},
  client = {},
  payments = [],
  financialYear = '2024-25'
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header Banner
  doc.setFillColor(13, 110, 253); // LIC primary blue
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LIFE INSURANCE CORPORATION OF INDIA', pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('ANNUAL PREMIUM PAID CERTIFICATE (FOR TAX EXEMPTION U/S 80C)', pageWidth / 2, 20, { align: 'center' });

  // Agent & Client Details Card
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('AGENT DETAILS', 14, 38);
  doc.text('POLICYHOLDER DETAILS', pageWidth / 2 + 10, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Name: ${agent.full_name || 'Rajesh Verma'}`, 14, 45);
  doc.text(`Agency Code: ${agent.license_number || 'LIC/2019/DEL/849201'}`, 14, 51);
  doc.text(`Contact: ${agent.phone || '+91 98765 43210'}`, 14, 57);

  doc.text(`Name: ${client.full_name || 'Ramesh Kumar'}`, pageWidth / 2 + 10, 45);
  doc.text(`PAN: ${client.pan_number || 'ABCPS1234F'}`, pageWidth / 2 + 10, 51);
  doc.text(`Financial Year: ${financialYear}`, pageWidth / 2 + 10, 57);
  doc.text(`Date of Issue: ${new Date().toLocaleDateString('en-IN')}`, pageWidth / 2 + 10, 63);

  // Divider Line
  doc.setDrawColor(220, 220, 220);
  doc.line(14, 68, pageWidth - 14, 68);

  // Table Data
  const tableRows = payments.map((p, index) => [
    index + 1,
    p.policy_number || '123456789',
    p.policy_name || 'LIC Jeevan Labh (Plan 936)',
    p.receipt_number || `REC-${Date.now().toString().slice(-6)}`,
    p.payment_date || new Date().toISOString().split('T')[0],
    `Rs. ${(parseFloat(p.amount_paid) || 0).toLocaleString('en-IN')}`
  ]);

  const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount_paid) || 0), 0);

  // AutoTable
  doc.autoTable({
    startY: 72,
    head: [['#', 'Policy Number', 'Plan Name', 'Receipt No', 'Payment Date', 'Premium Paid']],
    body: tableRows,
    foot: [['', '', '', '', 'Total 80C Deduction:', `Rs. ${totalAmount.toLocaleString('en-IN')}`]],
    theme: 'grid',
    headStyles: {
      fillColor: [13, 110, 253],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    footStyles: {
      fillColor: [240, 245, 255],
      textColor: [13, 110, 253],
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    }
  });

  const finalY = doc.lastAutoTable.finalY + 12;

  // Declaration
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Declaration & Section 80C Eligibility:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  
  const disclaimer = `This is to certify that the above life insurance premiums have been received for the policies held by the aforementioned policyholder during the Financial Year ${financialYear}. These premiums are eligible for deduction under Section 80C of the Income Tax Act, 1961, subject to the overall limits prescribed therein.\n\nNote: This is a system-generated provisional summary. Please retain original branch renewal receipts for official income tax filing records.`;
  
  const splitText = doc.splitTextToSize(disclaimer, pageWidth - 28);
  doc.text(splitText, 14, finalY + 6);

  // Signature Block
  const sigY = finalY + 38;
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorized LIC Agent Signature / Seal:', pageWidth - 70, sigY);
  doc.setFont('helvetica', 'normal');
  doc.text(agent.full_name || 'Rajesh Verma', pageWidth - 70, sigY + 10);
  doc.text(agent.license_number || 'LIC Agent', pageWidth - 70, sigY + 15);

  // Save / Download
  const clientSlug = (client.full_name || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`80C_TaxProof_${clientSlug}_${financialYear}.pdf`);
  return doc;
}
