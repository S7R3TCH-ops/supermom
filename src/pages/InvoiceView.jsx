import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchInvoiceById } from '../data/invoicesRepo';
import { getSignedUrl } from '../lib/storage';
import { useAppTheme } from '../context/AppThemeContext';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export default function InvoiceView() {
  const { id } = useParams();
  const { T } = useAppTheme();
  const [invoice, setInvoice] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchInvoiceById(id);
        setInvoice(data);
        if (data.businesses?.logo_url) {
          const url = await getSignedUrl(data.businesses.logo_url);
          setLogoUrl(url);
        }
      } catch (err) {
        console.error('Failed to load invoice:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-ui)', color: 'var(--ink-muted)' }}>Loading Invoice...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-ui)', color: 'var(--red)' }}>Error: {error}</div>;
  if (!invoice) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-ui)', color: 'var(--ink-muted)' }}>Invoice not found.</div>;

  const biz = invoice.businesses || {};
  const client = invoice.clients || {};
  const job = invoice.invoice_jobs?.[0]?.jobs || {};

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ minHeight: '100svh', background: '#f9f9f9', padding: '20px 10px' }}>
      <style>{`
        @media print {
          body { background: white !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .invoice-box { box-shadow: none !important; border: none !important; width: 100% !important; max-width: none !important; padding: 0 !important; }
        }
        .invoice-box {
          background: white;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          border: 1px solid #eee;
          font-family: var(--font-ui);
          color: #1a1a1a;
        }
        .fraunces { font-family: var(--font-display); }
      `}</style>

      <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-muted)', fontWeight: 600 }}>✦ PREVIEW</div>
        <button 
          onClick={handlePrint}
          style={{ 
            background: 'var(--pink)', color: 'white', border: 'none', 
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.2)'
          }}
        >
          Download PDF / Print
        </button>
      </div>

      <div className="invoice-box">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: 100, height: 100, objectFit: 'contain', marginBottom: 20 }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--grad-pink)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 32 }}>🦸‍♀️</div>
          )}
          <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
            {biz.name || 'SUPERMOM FOR HIRE'}
          </h1>
        </div>

        {/* Info Blocks */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 60, fontSize: 13, lineHeight: 1.6 }}>
          <div>
            <div style={{ fontWeight: 800, letterSpacing: '1px', marginBottom: 8 }}>ISSUED TO:</div>
            <div style={{ fontWeight: 500 }}>{client.first_name} {client.last_name}</div>
            <div>{client.address || ''}</div>
            <div>{client.city || ''} {client.postal_code || ''}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 100px', gap: '8px 16px', textAlign: 'left' }}>
              <div style={{ fontWeight: 800, letterSpacing: '1px', textAlign: 'right' }}>INVOICE NO:</div>
              <div style={{ fontWeight: 500 }}>{invoice.invoice_number}</div>
              <div style={{ fontWeight: 800, letterSpacing: '1px', textAlign: 'right' }}>DATE:</div>
              <div style={{ fontWeight: 500 }}>{formatDate(invoice.invoice_date)}</div>
              <div style={{ fontWeight: 800, letterSpacing: '1px', textAlign: 'right' }}>DUE DATE:</div>
              <div style={{ fontWeight: 500 }}>{formatDate(invoice.due_date)}</div>
            </div>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 40 }}>
          <thead>
            <tr style={{ background: '#EAE2D8', fontSize: 11, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
              <th style={{ textAlign: 'left', padding: '12px 15px' }}>Description</th>
              <th style={{ textAlign: 'center', padding: '12px 15px', width: 100 }}>Cost</th>
              <th style={{ textAlign: 'center', padding: '12px 15px', width: 80 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '12px 15px', width: 100 }}>Total</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: 13, lineHeight: 1.5 }}>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '20px 15px' }}>
                <div style={{ fontWeight: 500 }}>{job.service_name || 'Professional Services'}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{formatDate(job.scheduled_date)}</div>
              </td>
              <td style={{ textAlign: 'center', padding: '20px 15px' }}>
                {job.pricing_type === 'Hourly' ? `$${Number(biz.hourly_rate || 40).toFixed(2)}/hr` : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '20px 15px' }}>
                {job.pricing_type === 'Hourly' ? `${(job.actual_duration || job.estimated_hours || 0).toFixed(1)} hrs` : '1'}
              </td>
              <td style={{ textAlign: 'right', padding: '20px 15px', fontWeight: 500 }}>
                ${Number(invoice.total_amount).toFixed(2)}
              </td>
            </tr>
            {(() => {
              const items = Array.isArray(job.additional_costs_json) && job.additional_costs_json.length > 0
                ? job.additional_costs_json.filter(c => Number(c.amount) > 0)
                : (Number(job.additional_cost) > 0 ? [{ amount: job.additional_cost, description: job.additional_cost_notes || 'Additional Costs' }] : []);
              return items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px 15px' }}>
                    <div style={{ fontWeight: 500 }}>{item.description || 'Additional Cost'}</div>
                  </td>
                  <td colSpan={2} style={{ textAlign: 'center', padding: '12px 15px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '12px 15px', fontWeight: 500 }}>
                    ${Number(item.amount).toFixed(2)}
                  </td>
                </tr>
              ));
            })()}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 60 }}>
          <div style={{ width: 300 }}>
            {Number(job.additional_cost) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 15px', fontSize: 13 }}>
                <div>Services</div>
                <div>${Number(invoice.total_amount).toFixed(2)}</div>
              </div>
            )}
            <div style={{ background: '#EAE2D8', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px' }}>TOTAL</div>
              <div className="fraunces" style={{ fontSize: 20, fontWeight: 600 }}>${(Number(invoice.total_amount) + Number(job.additional_cost || 0)).toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Payment & Thank You */}
        <div style={{ textAlign: 'center', fontSize: 13, color: '#444' }}>
          <div style={{ marginBottom: 60, fontWeight: 500 }}>
            Please e-transfer to {biz.email || 'the operator'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#1a1a1a' }}>
            Thank you for the opportunity to organize your home!
          </div>
        </div>
      </div>
    </div>
  );
}
