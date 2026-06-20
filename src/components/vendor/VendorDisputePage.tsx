import React from 'react';
import VendorDisputeForm from './VendorDisputeForm';

interface VendorDisputePageProps {
  escrowId: string;
}

const VendorDisputePage: React.FC<VendorDisputePageProps> = ({ escrowId }) => {
  return (
    <div className="max-w-xl mx-auto mt-10">
      <VendorDisputeForm escrowId={escrowId} />
    </div>
  );
};

export default VendorDisputePage;
