import React from "react";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "../../config/languages";
import { ParticipantApprovalPage } from "../../components/participants/ParticipantApprovalPage";
import { approveTrader, getTraderApprovals, rejectTrader, requestMoreInfoForTrader } from "../../services/traderApprovalsApi";

export const TraderApprovals: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  return (
    <ParticipantApprovalPage
      title="Trader Membership Approvals"
      subtitle="Review and action trader requests to join an organisation and Mandi."
      partyLabel="Trader"
      usernameField="trader_username"
      nameField="trader_name"
      resourcePrefix="trader_approvals"
      language={language}
      api={{
        list: getTraderApprovals,
        approve: ({ username, language: lang, row, mandiId }) => approveTrader({ username, language: lang, trader_username: row.trader_username, org_id: row.org_id, mandi_id: mandiId }),
        reject: ({ username, language: lang, row, mandiId, reason }) => rejectTrader({ username, language: lang, trader_username: row.trader_username, org_id: row.org_id, mandi_id: mandiId, reason, status: "REJECTED" }),
        requestInfo: ({ username, language: lang, row, mandiId, reason }) => requestMoreInfoForTrader({ username, language: lang, trader_username: row.trader_username, org_id: row.org_id, mandi_id: mandiId, reason }),
      }}
    />
  );
};
