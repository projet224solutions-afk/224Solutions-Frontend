/**
 * Composant Honeypot invisible pour détecter les bots
 */

import React from 'react';

interface HoneypotFieldProps {
  name: string;
  onChange?: (value: string) => void;
  tabIndex?: number;
}

export const HoneypotField: React.FC<HoneypotFieldProps> = ({
  name,
  onChange,
  tabIndex = -1
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        opacity: 0,
        pointerEvents: 'none',
        height: 0,
        width: 0,
        overflow: 'hidden',
        zIndex: -1
      }}
      aria-hidden="true"
    >
      <label htmlFor={name} style={{ display: 'none' }}>
        Ne pas remplir
      </label>
      <input
        type="text"
        id={name}
        name={name}
        autoComplete="off"
        tabIndex={tabIndex}
        onChange={(e) => onChange?.(e.target.value)}
        style={{
          position: 'absolute',
          left: '-9999px',
          opacity: 0,
          height: 0,
          width: 0
        }}
      />
    </div>
  );
};

/**
 * Groupe de champs honeypot
 */
export const HoneypotFieldGroup: React.FC<{
  onBotDetected?: () => void;
  register?: (name: string) => any;
}> = ({ onBotDetected, register }) => {
  const honeypotNames = ['website_url', 'phone_confirm', 'email_verify', 'fax_number'];

  const handleChange = (value: string) => {
    if (value && value.trim() !== '') {
      console.warn('[Honeypot] Bot détecté!');
      onBotDetected?.();
    }
  };

  return (
    <>
      {honeypotNames.map(name => (
        <HoneypotField
          key={name}
          name={name}
          onChange={handleChange}
          {...(register ? register(name) : {})}
        />
      ))}
    </>
  );
};

export default HoneypotField;
