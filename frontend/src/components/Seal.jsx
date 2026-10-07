import React from "react";

// Shield mark used across the app
const Seal = ({ small = false }) => {
  const size = small ? 32 : 40;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 2L36 8V18C36 27.5 29.5 34.5 20 38C10.5 34.5 4 27.5 4 18V8L20 2Z" fill="#C9A227" stroke="#16213E" strokeWidth="1.5" />
      <path d="M20 2L36 8V18C36 27.5 29.5 34.5 20 38" fill="none" stroke="#16213E" strokeWidth="1.5" opacity="0.15" />
      <text x="20" y="25" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="15" fontWeight="600" fill="#16213E">H</text>
    </svg>
  );
};
export default Seal;
