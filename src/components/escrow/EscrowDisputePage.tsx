import React from 'react';
import EscrowDisputeForm from './EscrowDisputeForm';

interface EscrowDisputePageProps {
  escrowId: string;
}

const EscrowDisputePage: React.FC<EscrowDisputePageProps> = ({ escrowId }) => {
  return (
    <div className="max-w-xl mx-auto mt-10">
      <EscrowDisputeForm escrowId={escrowId} />
    </div>
  );
};

export default EscrowDisputePage;
