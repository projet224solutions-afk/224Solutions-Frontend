import React, { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { buildEscrowDisputePayload } from '@/lib/escrow/disputePayload';

interface VendorDisputeFormProps {
  escrowId: string;
  onSubmit?: () => void;
}

const VendorDisputeForm: React.FC<VendorDisputeFormProps> = ({ escrowId, onSubmit }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Appel API pour ouvrir le litige côté vendeur
      const res = await fetch(`/api/escrow/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEscrowDisputePayload(escrowId, reason, description, 'vendor'))
      });
      if (!res.ok) throw new Error('Erreur lors de l’ouverture du litige');
      if (onSubmit) onSubmit();
      // Redirige vers le dashboard ou confirmation
      navigate('/escrow/disputes');
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold">{t('vendorDisputeForm.justificationDuLitigeVendeur')}</h2>
      <div>
        <label className="block font-semibold">{t('vendorDisputeForm.motifDuLitige')}</label>
        <input
          type="text"
          className="w-full border p-2 rounded"
          value={reason}
          onChange={e => setReason(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block font-semibold">{t('vendorDisputeForm.explicationDetaillee')}</label>
        <textarea
          className="w-full border p-2 rounded"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={5}
          required
        />
      </div>
      {error && <div className="text-[#ff4000]">{error}</div>}
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? 'Envoi...' : 'Soumettre le litige'}
      </button>
    </form>
  );
};

export default VendorDisputeForm;
