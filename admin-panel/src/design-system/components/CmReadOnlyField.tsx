import React from "react";

export const CmReadOnlyField: React.FC<{ label: React.ReactNode; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="cm-readonly-field">
    <div className="cm-field-label">{label}</div>
    <div className="cm-readonly-value">{value === null || value === undefined || value === "" ? "—" : value}</div>
  </div>
);

export default CmReadOnlyField;
