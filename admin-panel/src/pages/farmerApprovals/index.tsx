import React from "react";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "../../config/languages";
import { ParticipantApprovalPage } from "../../components/participants/ParticipantApprovalPage";
import { approveFarmerForMandis, listFarmerApprovalRequests, rejectFarmerApproval, requestMoreInfoFarmer } from "../../services/farmerApprovalsApi";

export const FarmerApprovals: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  return (
    <ParticipantApprovalPage
      title="Farmer Membership Approvals"
      subtitle="Review and action farmer requests to join an organisation and Mandi."
      partyLabel="Farmer"
      usernameField="farmer_username"
      nameField="farmer_name"
      resourcePrefix="farmer_approvals"
      language={language}
      api={{
        list: listFarmerApprovalRequests,
        approve: ({ username, language: lang, row, mandiId }) => approveFarmerForMandis({ username, language: lang, payload: { org_id: row.org_id, farmer_username: row.farmer_username, mandi_id: mandiId } }),
        reject: ({ username, language: lang, row, mandiId, reason }) => rejectFarmerApproval({ username, language: lang, payload: { org_id: row.org_id, farmer_username: row.farmer_username, mandi_id: mandiId, reason } }),
        requestInfo: ({ username, language: lang, row, mandiId, reason }) => requestMoreInfoFarmer({ username, language: lang, payload: { org_id: row.org_id, farmer_username: row.farmer_username, mandi_id: mandiId, reason } }),
      }}
    />
  );
};
