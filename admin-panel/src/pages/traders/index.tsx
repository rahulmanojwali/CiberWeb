import React from "react";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "../../config/languages";
import { ParticipantDirectoryPage } from "../../components/participants/ParticipantDirectoryPage";
import { getTraders, updateTraderStatus } from "../../services/partyMastersApi";

export const Traders: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  return <ParticipantDirectoryPage title="Trader Directory" subtitle="View trader memberships, linked Mandis and account status." partyLabel="Trader" idField="trader_id" resourcePrefix="traders" language={language} getData={getTraders} updateStatus={updateTraderStatus} />;
};
