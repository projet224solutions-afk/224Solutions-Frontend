/**
 * Ticket de Transport Professionnel - Design Officiel Guinéen
 * Orientation PAYSAGE - Texte très visible - Drapeau discret
 */
import { formatCurrency } from '@/lib/formatters';

interface TicketConfig {
  syndicateName: string;
  commune: string;
  ticketType: string;
  amount: number;
  date: string;
  optionalMention: string;
  bureauStampUrl?: string; // URL du cachet du bureau syndicat
}

interface Props {
  ticketNumber: number;
  config: TicketConfig;
  ticketTypeLabel: string;
}

export default function SingleTransportTicket({ ticketNumber, config, ticketTypeLabel }: Props) {
  const formattedNumber = String(ticketNumber).padStart(2, '0');

  const formatAmount = (amount: number) => formatCurrency(amount);

  return (
    <div
      className="ticket-container relative overflow-hidden"
      style={{
        width: '100%',
        height: '100%',
        aspectRatio: '2.5 / 1', // Ratio paysage horizontal
        fontFamily: "'Arial', 'Helvetica', sans-serif",
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '2px solid #1e3a5f',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'row',
        boxSizing: 'border-box',
        boxShadow: 'inset 0 0 0 1px rgba(30, 58, 95, 0.1)',
      }}
    >
      {/* Petit drapeau Guinéen - coin supérieur gauche */}
      <div
        style={{
          position: 'absolute',
          top: '2px',
          left: '2px',
          width: '12px',
          height: '8px',
          display: 'flex',
          flexDirection: 'row',
          borderRadius: '1px',
          overflow: 'hidden',
          border: '0.5px solid rgba(0,0,0,0.2)',
          zIndex: 10,
        }}
      >
        <div style={{ flex: 1, background: '#CE1126' }} />
        <div style={{ flex: 1, background: '#FCD116' }} />
        <div style={{ flex: 1, background: '#009639' }} />
      </div>

      {/* Contenu principal - Layout horizontal */}
      <div
        style={{
          flex: 1,
          padding: '3px 5px 3px 18px', // Espace pour le drapeau
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        {/* Filigrane de sécurité */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.03,
            backgroundImage: `
              repeating-linear-gradient(45deg, #1e3a5f 0px, transparent 1px, transparent 8px),
              repeating-linear-gradient(-45deg, #1e3a5f 0px, transparent 1px, transparent 8px)
            `,
            pointerEvents: 'none',
          }}
        />

        {/* LIGNE 1: En-tête - République + Numéro */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div
              style={{
                fontSize: '8px',
                fontWeight: 'bold',
                letterSpacing: '0.5px',
                color: '#1e3a5f',
                textTransform: 'uppercase',
              }}
            >
              RÉPUBLIQUE DE GUINÉE
            </div>
            <div
              style={{
                fontSize: '6px',
                color: '#64748b',
                fontStyle: 'italic',
              }}
            >
              Travail • Justice • Solidarité
            </div>
          </div>

          {/* Numéro de ticket - TRÈS VISIBLE */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
              color: '#ffffff',
              padding: '3px 8px',
              borderRadius: '3px',
              fontSize: '10px',
              fontWeight: 'bold',
              fontFamily: "'Courier New', 'Consolas', monospace",
              letterSpacing: '1px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            N° {formattedNumber}
          </div>
        </div>

        {/* LIGNE 2: Commune - VISIBLE */}
        <div
          style={{
            fontSize: '9px',
            fontWeight: 'bold',
            color: '#CE1126',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            textAlign: 'center',
            padding: '2px 0',
            borderTop: '1px dashed #e2e8f0',
            borderBottom: '1px dashed #e2e8f0',
            margin: '2px 0',
          }}
        >
          COMMUNE DE {config.commune.toUpperCase()}
        </div>

        {/* LIGNE 3: Type + Montant + Cachet Syndicat */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: 1,
          }}
        >
          {/* Type de ticket */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '6px',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              TYPE
            </div>
            <div
              style={{
                fontSize: '9px',
                fontWeight: 'bold',
                color: '#1e3a5f',
                lineHeight: 1.2,
              }}
            >
              {ticketTypeLabel}
            </div>
          </div>

          {/* Montant - TRÈS VISIBLE */}
          <div
            style={{
              background: 'linear-gradient(135deg, #009639 0%, #00752c 100%)',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '4px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 'bold',
                lineHeight: 1.1,
              }}
            >
              {formatAmount(config.amount)}
            </div>
            <div style={{ fontSize: '6px', opacity: 0.9 }}>GNF</div>
          </div>

          {/* Zone cachet du bureau syndicat */}
          <div
            style={{
              width: '32px',
              height: '32px',
              marginLeft: '6px',
              border: '1.5px dashed #94a3b8',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: config.bureauStampUrl ? 'transparent' : 'rgba(248,250,252,0.8)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {config.bureauStampUrl ? (
              <img
                src={config.bureauStampUrl}
                alt="Cachet"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '50%',
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: '5px',
                  color: '#94a3b8',
                  textAlign: 'center',
                  lineHeight: 1.1,
                }}
              >
                CACHET
              </div>
            )}
          </div>
        </div>

        {/* LIGNE 4: Syndicat + Date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div
              style={{
                fontSize: '7px',
                color: '#475569',
                fontWeight: '500',
                maxWidth: '80%',
                lineHeight: 1.2,
              }}
            >
              {config.syndicateName}
            </div>
            {config.optionalMention && (
              <div
                style={{
                  fontSize: '5px',
                  color: '#94a3b8',
                  fontStyle: 'italic',
                }}
              >
                {config.optionalMention}
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: '7px',
              color: '#64748b',
              fontFamily: "'Courier New', monospace",
              background: '#f1f5f9',
              padding: '1px 4px',
              borderRadius: '2px',
            }}
          >
            {config.date}
          </div>
        </div>
      </div>

    </div>
  );
}
